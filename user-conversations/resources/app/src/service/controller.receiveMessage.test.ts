// @vitest-environment jsdom
import { expect, test } from 'vitest'

import { Activity } from "../as/activity"
import * as vocab from "../as/vocab"
import { makeController, FakeDatabase } from "./testHarness"
import { NewGroup } from "../model/group"

// These tests drive the real receive pipeline (controller.receiveActivity → the
// real CodecPlaintext → the create/update message handlers) and assert that the
// HTML actually persisted to the database is sanitized. They guard the security
// boundary itself, not just the sanitizeHTML helper in isolation.

const ME = "https://example.test/users/me"
const ALICE = "https://alice.test/users/alice"
const GROUP_ID = "https://example.test/groups/abc"

// makeCreateActivity builds a plaintext "Create" activity carrying a Note whose
// content is the supplied HTML. attributedTo == actor so it passes the controller's
// attribution guard.
function makeCreateActivity(messageId: string, content: string): Activity {
	return new Activity({
		"@context": "https://www.w3.org/ns/activitystreams",
		type: vocab.ActivityTypeCreate,
		actor: ALICE,
		context: GROUP_ID,
		to: [ME],
		object: {
			id: messageId,
			type: vocab.ObjectTypeNote,
			attributedTo: ALICE,
			context: GROUP_ID,
			content: content,
		},
	})
}

// makeUpdateActivity builds a plaintext "Update" activity that edits an existing
// message (same id, same sender) with new HTML content.
function makeUpdateActivity(messageId: string, content: string): Activity {
	return new Activity({
		"@context": "https://www.w3.org/ns/activitystreams",
		type: vocab.ActivityTypeUpdate,
		actor: ALICE,
		context: GROUP_ID,
		to: [ME],
		object: {
			id: messageId,
			type: vocab.ObjectTypeNote,
			attributedTo: ALICE,
			context: GROUP_ID,
			content: content,
		},
	})
}

const MALICIOUS = 'Hello <script>alert(1)</script><img src=x onerror="alert(2)"> <a href="javascript:alert(3)">x</a>'

test('receiving a Create message sanitizes the content before saving', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	await controller.receiveActivity(makeCreateActivity("msg-1", MALICIOUS))

	// Find the message the controller persisted
	const saved = database.savedMessages.find(message => message.id == "msg-1")
	expect(saved).toBeDefined()

	const content = saved!.content
	expect(content).not.toContain("<script>")
	expect(content).not.toContain("alert(1)")
	expect(content).not.toContain("onerror")
	expect(content).not.toContain("alert(2)")
	expect(content).not.toContain("javascript:")
	expect(content).toContain("Hello")
})

test('receiving a Create message preserves allowed Mastodon markup', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	const good = '<p>Hi <strong>there</strong> <a href="https://x.test" class="mention">@bob</a></p>'
	await controller.receiveActivity(makeCreateActivity("msg-good", good))

	const saved = database.savedMessages.find(message => message.id == "msg-good")
	expect(saved).toBeDefined()
	expect(saved!.content).toContain("<strong>there</strong>")
	expect(saved!.content).toContain('class="mention"')
	expect(saved!.content).toContain('rel="noopener noreferrer nofollow"')
})

test('receiving a Create message stores group.lastMessage as plain text', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	await controller.receiveActivity(makeCreateActivity("msg-2", "<p>Hello <strong>world</strong></p>"))

	const group = await database.loadGroup(GROUP_ID)
	expect(group).toBeDefined()
	expect(group!.lastMessage).not.toContain("<")
	expect(group!.lastMessage).toContain("Hello world")
})

test('receiving an Update (edit) sanitizes the new content before saving', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	// First receive a clean message so there is something to edit
	await controller.receiveActivity(makeCreateActivity("msg-edit", "original"))
	expect(database.savedMessages.some(m => m.id == "msg-edit")).toBe(true)

	// Now receive an edit of that message with malicious HTML
	await controller.receiveActivity(makeUpdateActivity("msg-edit", MALICIOUS))

	// The most recent save for this id holds the edited content
	const edited = [...database.savedMessages].reverse().find(message => message.id == "msg-edit")
	expect(edited).toBeDefined()

	const content = edited!.content
	expect(content).not.toContain("<script>")
	expect(content).not.toContain("onerror")
	expect(content).not.toContain("javascript:")
	expect(content).toContain("Hello")
})

test('receiving an Update of a group context applies the new metadata', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	// Seed the group that the context update will modify
	const group = NewGroup("PLAINTEXT")
	group.id = GROUP_ID
	group.name = "Old Name"
	group.stateId = "ACTIVE"
	database.groups.set(GROUP_ID, group)

	// An Update activity whose embedded object is an emissary:Context for this group
	const activity = new Activity({
		type: vocab.ActivityTypeUpdate,
		actor: ALICE,
		context: GROUP_ID,
		object: {
			id: GROUP_ID,
			type: vocab.ObjectTypeEmissaryContext,
			context: GROUP_ID,
			name: "New Name",
			summary: "An updated summary",
			tag: ["news", "updates"],
			unread: true,
			lastMessage: "the latest message",
			lastMessageId: "https://example.test/messages/latest",
			stateId: "IMPORTANT",
		},
	})

	await controller.receiveActivity(activity)

	const updated = await database.loadGroup(GROUP_ID)
	expect(updated!.name).toBe("New Name")
	expect(updated!.summary).toBe("An updated summary")
	expect(updated!.tags).toEqual(["news", "updates"])
	expect(updated!.lastMessage).toBe("the latest message")
	expect(updated!.lastMessageId).toBe("https://example.test/messages/latest")
	expect(updated!.stateId).toBe("IMPORTANT")
	// NOTE: "unread" is intentionally not asserted here — saveGroup reloads and
	// reconciles the selection, and selecting this (only) group marks it read.
})
