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

		// RULE: Only resolve plain fully-qualified domain handles. The host comes from
		// (attacker-influenced) message/mention text and is fetched directly from the browser
		// (not via the SSRF-guarded proxy), so reject anything that could target an internal
		// service: IP literals, ports, and non-FQDN / internal hostnames. This limits the
		// handle-controlled-host request-forgery surface.
		if (!isResolvableWebFingerHost(host)) {
			this.#cache.set(normalized, "")
			return ""
		}

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

// A plain fully-qualified domain name: two or more dot-separated labels of letters, digits, and
// hyphens, with a non-numeric (so not an IP-literal) final label. No ports, no colons, no
// userinfo, no IPv6 brackets.
const FQDN_PATTERN = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/

// isResolvableWebFingerHost reports whether `host` is safe to use as the target of a direct
// (non-proxied) WebFinger request. It accepts only plain FQDNs, rejecting IP-literals, ports,
// and single-label / internal hostnames that could point at an internal service.
function isResolvableWebFingerHost(host: string): boolean {
	return FQDN_PATTERN.test(host)
}
