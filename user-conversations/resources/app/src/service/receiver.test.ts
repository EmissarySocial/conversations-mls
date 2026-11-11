import { afterEach, describe, expect, test, vi } from "vitest"

import { Actor } from "../as/actor"
import { type Activity } from "../as/activity"
import { Receiver } from "./receiver"

const MESSAGES = "https://example.test/users/me/pub/inbox/direct-messages"

// stubInbox serves a two-item inbox: the bare collection points at a first page, and
// any "after" request returns the single item that follows the cursor.
function stubInbox() {

	const fetchSpy = vi.fn(async (url: string) => {

		let body: object = {
			type: "OrderedCollection",
			first: MESSAGES + "?after=FIRST",
		}

		if (url == MESSAGES + "?after=FIRST") {
			body = {
				type: "OrderedCollectionPage",
				orderedItems: [
					{ id: "https://example.test/activity/1", type: "Create" },
					{ id: "https://example.test/activity/2", type: "Create" },
				],
			}
		}

		if (url == MESSAGES + "?after=" + encodeURIComponent("https://example.test/activity/2")) {
			body = {
				type: "OrderedCollectionPage",
				orderedItems: [
					{ id: "https://example.test/activity/3", type: "Create" },
				],
			}
		}

		return { ok: true, status: 200, text: async () => JSON.stringify(body) }
	})

	vi.stubGlobal("fetch", fetchSpy)
	return fetchSpy
}

// poll starts a Receiver at the given cursor and resolves once that poll has saved its new cursor.
async function poll(cursor: string) {

	const received: { id: string, isHistory: boolean }[] = []
	const saved: string[] = []

	const receiver = new Receiver()
	receiver.setActor(new Actor({ "emissary:messages": MESSAGES }))

	await receiver.start(
		"generator-1",
		async (activity: Activity, isHistory: boolean) => {
			received.push({ id: activity.id(), isHistory })
		},
		async (messageId?: string) => {
			if (messageId != undefined) {
				saved.push(messageId)
			}
			return cursor
		},
		() => { },
	)

	await vi.waitFor(() => { expect(saved).toHaveLength(1) })
	receiver.stop()

	return { received, saved }
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("Receiver history replay", () => {

	test("an empty cursor reads the inbox from the beginning, flagged as history", async () => {

		stubInbox()
		const { received, saved } = await poll("")

		expect(received).toEqual([
			{ id: "https://example.test/activity/1", isHistory: true },
			{ id: "https://example.test/activity/2", isHistory: true },
		])
		expect(saved).toEqual(["https://example.test/activity/2"])
	})

	test("a saved cursor reads only what follows it, flagged as live", async () => {

		stubInbox()
		const { received, saved } = await poll("https://example.test/activity/2")

		expect(received).toEqual([
			{ id: "https://example.test/activity/3", isHistory: false },
		])
		expect(saved).toEqual(["https://example.test/activity/3"])
	})
})
