import { test, expect, describe, afterEach, vi } from 'vitest'

import { WebFinger } from "./webfinger"

const SELF_LINK = { rel: "self", type: "application/activity+json", href: "https://example.social/users/alice" }

// mockFetch installs a fetch stub. The handler receives the requested URL and
// returns either a JRD object (200) or an { status } to simulate an error. It
// records every requested URL.
function mockFetch(handler: (url: string) => { jrd?: any, status?: number }): { requested: string[] } {
	const requested: string[] = []

	vi.stubGlobal("fetch", async (url: string) => {
		requested.push(url)
		const result = handler(url)

		if (result.status != undefined) {
			return { ok: false, status: result.status, statusText: "Error" }
		}

		return { ok: true, status: 200, json: async () => result.jrd }
	})

	return { requested }
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("WebFinger.resolveActorURL", () => {

	test("requests the correct WebFinger URL directly (not via a proxy)", async () => {
		const { requested } = mockFetch(() => ({ jrd: { links: [SELF_LINK] } }))
		await new WebFinger().resolveActorURL("@alice@example.social")

		expect(requested[0]).toBe("https://example.social/.well-known/webfinger?resource=acct:alice@example.social")
	})

	test("returns the self link href (application/activity+json)", async () => {
		mockFetch(() => ({ jrd: { links: [SELF_LINK] } }))
		const url = await new WebFinger().resolveActorURL("@alice@example.social")
		expect(url).toBe("https://example.social/users/alice")
	})

	test("accepts a handle without a leading @", async () => {
		mockFetch(() => ({ jrd: { links: [SELF_LINK] } }))
		const url = await new WebFinger().resolveActorURL("alice@example.social")
		expect(url).toBe("https://example.social/users/alice")
	})

	test("recognizes the activitystreams-profiled ld+json self link", async () => {
		const link = {
			rel: "self",
			type: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
			href: "https://example.social/users/alice",
		}
		mockFetch(() => ({ jrd: { links: [link] } }))
		expect(await new WebFinger().resolveActorURL("@alice@example.social")).toBe("https://example.social/users/alice")
	})

	test("returns '' when there is no self link", async () => {
		mockFetch(() => ({ jrd: { links: [{ rel: "http://webfinger.net/rel/avatar", href: "x" }] } }))
		expect(await new WebFinger().resolveActorURL("@alice@example.social")).toBe("")
	})

	test("returns '' when the JRD has no links at all", async () => {
		mockFetch(() => ({ jrd: { subject: "acct:alice@example.social" } }))
		expect(await new WebFinger().resolveActorURL("@alice@example.social")).toBe("")
	})

	test("returns '' for a malformed handle without making a request", async () => {
		const { requested } = mockFetch(() => ({ jrd: { links: [SELF_LINK] } }))
		const webfinger = new WebFinger()

		expect(await webfinger.resolveActorURL("not-a-handle")).toBe("")
		expect(await webfinger.resolveActorURL("@only-user@")).toBe("")
		expect(await webfinger.resolveActorURL("@@host.test")).toBe("")
		expect(requested.length).toBe(0)
	})

	test("returns '' when the server responds with an error status", async () => {
		mockFetch(() => ({ status: 404 }))
		expect(await new WebFinger().resolveActorURL("@alice@example.social")).toBe("")
	})

	test("caches the result and does not re-request", async () => {
		const { requested } = mockFetch(() => ({ jrd: { links: [SELF_LINK] } }))
		const webfinger = new WebFinger()

		await webfinger.resolveActorURL("@alice@example.social")
		await webfinger.resolveActorURL("@alice@example.social")

		expect(requested.length).toBe(1)
	})
})
