// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest"

import { Activity } from "../as/activity"
import * as vocab from "../as/vocab"
import { NewGroup } from "../model/group"
import { type IHost } from "./interfaces"
import { FakeDatabase, makeController } from "./testHarness"

const ME = "https://example.test/users/me"
const ALICE = "https://alice.test/users/alice"
const GROUP_ID = "https://example.test/groups/abc"

// makeNote builds a plaintext "Create" from ALICE, as a Mastodon direct message arrives.
function makeNote(messageId: string): Activity {
	return new Activity({
		"@context": "https://www.w3.org/ns/activitystreams",
		type: vocab.ActivityTypeCreate,
		actor: ALICE,
		to: [ME],
		object: {
			id: messageId,
			type: vocab.ObjectTypeNote,
			attributedTo: ALICE,
			context: GROUP_ID,
			content: "<p>Howdy</p>",
		},
	})
}

// seedForeignGroup stores GROUP_ID as an encrypted group, so a plaintext message
// addressed to it makes the plaintext codec throw.
async function seedForeignGroup(database: FakeDatabase) {
	const group = NewGroup("MLS")
	group.id = GROUP_ID
	await database.saveGroup(group)
}

// makeHost returns a host whose notify() calls can be counted.
function makeHost() {
	const notify = vi.fn()
	const host: IHost = {
		notify,
		reload: () => { },
		viewActor: () => { },
		viewBlockActor: () => { },
		viewKeyPackages: () => { },
	}
	return { host, notify }
}

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

describe("replayed history", () => {

	test("a history message is stored like any other", async () => {

		const database = new FakeDatabase()
		const { controller } = makeController({ database })

		await controller.receiveActivity(makeNote("msg-old"), 0, true)

		const saved = database.savedMessages.find(message => message.id == "msg-old")
		expect(saved).toBeDefined()
		expect(saved!.type).toBe("RECEIVED")
		expect(saved!.groupId).toBe(GROUP_ID)
	})

	test("a history message raises no desktop notification", async () => {

		const { host, notify } = makeHost()
		const { controller } = makeController({ host })
		controller.config.isDesktopNotifications = true
		controller.isWindowFocused = false

		await controller.receiveActivity(makeNote("msg-old"), 0, true)
		expect(notify).not.toHaveBeenCalled()

		await controller.receiveActivity(makeNote("msg-new"), 0, false)
		expect(notify).toHaveBeenCalledTimes(1)
	})

	test("a history message that fails is dropped without a retry", async () => {

		vi.useFakeTimers()
		const database = new FakeDatabase()
		await seedForeignGroup(database)
		const { controller } = makeController({ database })

		await controller.receiveActivity(makeNote("msg-old"), 0, true)

		expect(vi.getTimerCount()).toBe(0)
		expect(database.savedMessages).toHaveLength(0)
	})

	test("a live message that fails is scheduled for a retry", async () => {

		vi.useFakeTimers()
		const database = new FakeDatabase()
		await seedForeignGroup(database)
		const { controller } = makeController({ database })

		await controller.receiveActivity(makeNote("msg-new"), 0, false)

		expect(vi.getTimerCount()).toBe(1)
		expect(database.savedMessages).toHaveLength(0)
	})
})
