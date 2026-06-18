import type { IWebFinger } from "./interfaces"

// WebFinger resolves fediverse handles (@user@host) into the actor's canonical
// profile URL, using the standard WebFinger protocol:
//   GET https://{host}/.well-known/webfinger?resource=acct:{user}@{host}
// and reading the "self" link (the ActivityPub actor URL) from the returned JRD.
//
// WebFinger is a plain, unauthenticated request, so it is fetched directly from
// the remote server — NOT through the ActivityStreams proxy (which signs requests
// and expects to fetch AP documents). Results (hits and misses) are cached for the
// session.
export class WebFinger implements IWebFinger {

	readonly #cache = new Map<string, string>()

	// resolveActorURL returns the actor URL for a "@user@host" handle, or "" if the
	// handle is malformed or cannot be resolved.
	async resolveActorURL(handle: string): Promise<string> {

		// Normalize: tolerate a leading "@" (i.e. "@user@host" or "user@host")
		const normalized = handle.startsWith("@") ? handle.slice(1) : handle

		// RULE: a resolvable handle must be "user@host"
		const parts = normalized.split("@")
		if (parts.length != 2 || parts[0] == "" || parts[1] == "") {
			return ""
		}

		const user = parts[0]!
		const host = parts[1]!

		// Return the cached result (including a cached "not found")
		const cached = this.#cache.get(normalized)
		if (cached != undefined) {
			return cached
		}

		const url = `https://${host}/.well-known/webfinger?resource=acct:${user}@${host}`

		let actorUrl = ""
		try {
			// WebFinger is unauthenticated — fetch it directly from the remote server.
			const response = await fetch(url, {
				headers: { Accept: "application/jrd+json" },
			})

			if (!response.ok) {
				throw new Error(`WebFinger request failed: ${response.status} ${response.statusText}`)
			}

			const jrd = await response.json()
			actorUrl = this.#findSelfLink(jrd?.links ?? [])
		} catch (error) {
			console.warn(`WebFinger: unable to resolve handle '${handle}':`, error)
			actorUrl = ""
		}

		this.#cache.set(normalized, actorUrl)
		return actorUrl
	}

	// findSelfLink returns the href of the WebFinger "self" link that points at the
	// ActivityPub actor document, or "" if none is present.
	#findSelfLink(links: any[]): string {

		const selfLink = links.find((link) =>
			link != null &&
			link.rel == "self" &&
			(link.type == "application/activity+json" || link.type == 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
		)

		return (selfLink?.href as string) ?? ""
	}
}
