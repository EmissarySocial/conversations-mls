// @vitest-environment jsdom
import { expect, test, afterEach, vi } from 'vitest'

import { Activity } from "../as/activity"
import * as vocab from "../as/vocab"
import { makeController, FakeDatabase } from "./testHarness"
import { NewGroup } from "../model/group"
import { NewMessage } from "../model/message"

// stubObjectFetch makes the dispatcher's eager `activity.object()` resolve without
// a real network call. Activities whose "object" is a bare URL (Like/Delete/Undo,
// which reference a message/activity by id) trigger a fetch at the top of
// receiveActivity; this returns a minimal JSON document for any such fetch so the
// activity can route to its handler, which resolves the real target from the
// database via objectId().
function stubObjectFetch(json?: object) {
	const body = json ?? { id: "https://example.test/stub", type: vocab.ObjectTypeNote }
	vi.stubGlobal("fetch", async () => ({
		ok: true,
		status: 200,
		text: async () => JSON.stringify(body),
	}))
}

// stubFailingFetch makes every fetch reject, simulating an unreachable / rejected
// object URL (e.g. a reflected "Leave" whose group collection the server now 400s).
// Returns the spy so tests can assert whether a fetch was attempted at all.
function stubFailingFetch() {
	const fetchSpy = vi.fn(async () => ({
		ok: false,
		status: 400,
		statusText: "Bad Request",
	}))
	vi.stubGlobal("fetch", fetchSpy)
	return fetchSpy
}

afterEach(() => {
	vi.unstubAllGlobals()
})

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

test('receiving a message in an ARCHIVED group revives it to ACTIVE', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	// Seed an archived group so the incoming message must revive it
	const group = NewGroup("PLAINTEXT")
	group.id = GROUP_ID
	group.stateId = "ARCHIVED"
	group.members = [ME, ALICE]
	database.groups.set(GROUP_ID, group)

	await controller.receiveActivity(makeCreateActivity("msg-revive", "hi again"))

	const updated = await database.loadGroup(GROUP_ID)
	expect(updated!.stateId).toBe("ACTIVE")
})

test('receiving a message does not change a non-archived group state', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	// An IMPORTANT group should keep its state when a new message arrives
	const group = NewGroup("PLAINTEXT")
	group.id = GROUP_ID
	group.stateId = "IMPORTANT"
	group.members = [ME, ALICE]
	database.groups.set(GROUP_ID, group)

	await controller.receiveActivity(makeCreateActivity("msg-keep", "still important"))

	const updated = await database.loadGroup(GROUP_ID)
	expect(updated!.stateId).toBe("IMPORTANT")
})

test('receiving a message from someone else marks the (unselected) group unread', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	// Seed a second group and select it, so the group receiving the message is NOT
	// the selected group (otherwise reconciliation would mark it read).
	const other = NewGroup("PLAINTEXT")
	other.id = "https://example.test/groups/other"
	database.groups.set(other.id, other)
	controller.selectGroup(other.id)

	await controller.receiveActivity(makeCreateActivity("msg-unread", "ping"))

	const group = await database.loadGroup(GROUP_ID)
	expect(group!.unread).toBe(true)
})

test('receiving a message records lastMessage (as text) and lastMessageId', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	await controller.receiveActivity(makeCreateActivity("msg-last", "<p>Hello <strong>world</strong></p>"))

	const group = await database.loadGroup(GROUP_ID)
	expect(group!.lastMessageId).toBe("msg-last")
	expect(group!.lastMessage).toBe("Hello world")
})

test('receiving a message does not duplicate the sender already in the member list', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	// Group already contains ALICE (the sender) and ME
	const group = NewGroup("PLAINTEXT")
	group.id = GROUP_ID
	group.members = [ME, ALICE]
	database.groups.set(GROUP_ID, group)

	await controller.receiveActivity(makeCreateActivity("msg-dup", "hello"))

	const updated = await database.loadGroup(GROUP_ID)
	// ALICE (actor + recipient via the activity) must not be added a second time
	expect(updated!.members.filter(m => m == ALICE).length).toBe(1)
	expect(updated!.members.filter(m => m == ME).length).toBe(1)
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

// seedMessage stores a message authored by `sender` in GROUP_ID.
function seedMessage(database: FakeDatabase, id: string, sender: string) {
	database.messages.set(id, NewMessage({
		id,
		groupId: GROUP_ID,
		sender,
		content: "hello",
	}))
}

test('receiving a Like adds the actor reaction to the target message', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })
	seedMessage(database, "msg-like", ME)
	stubObjectFetch()

	const like = new Activity({
		type: vocab.ActivityTypeLike,
		actor: ALICE,
		content: "🎉",
		object: "msg-like",
	})

	await controller.receiveActivity(like)

	const saved = database.savedMessages.find(m => m.id == "msg-like")
	expect(saved).toBeDefined()
	expect(saved!.reactions["🎉"]).toEqual([ALICE])
})

test('receiving a Like for a missing message is a no-op (no save)', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })
	stubObjectFetch()

	const like = new Activity({
		type: vocab.ActivityTypeLike,
		actor: ALICE,
		object: "msg-missing",
	})

	await controller.receiveActivity(like)
	expect(database.savedMessages.length).toBe(0)
})

test('receiving a Like from a non-member does not change group membership', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	// A group whose only members are ME and BOB
	const group = NewGroup("PLAINTEXT")
	group.id = GROUP_ID
	group.members = [ME, "https://bob.test/users/bob"]
	database.groups.set(GROUP_ID, group)

	seedMessage(database, "msg-likemember", ME)
	stubObjectFetch()

	// ALICE (not a member) likes the message
	const like = new Activity({
		type: vocab.ActivityTypeLike,
		actor: ALICE,
		content: "👍",
		object: "msg-likemember",
	})

	await controller.receiveActivity(like)

	const updated = await database.loadGroup(GROUP_ID)
	expect(updated!.members).toEqual([ME, "https://bob.test/users/bob"])
})

test('receiving a Delete from the message sender removes the message', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })
	seedMessage(database, "msg-del", ALICE)
	stubObjectFetch()

	const del = new Activity({
		type: vocab.ActivityTypeDelete,
		actor: ALICE, // same as the message sender
		object: "msg-del",
	})

	await controller.receiveActivity(del)
	expect(database.messages.has("msg-del")).toBe(false)
})

test('receiving a Delete from someone other than the sender is ignored', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })
	seedMessage(database, "msg-keep", ME) // authored by ME
	stubObjectFetch()

	const del = new Activity({
		type: vocab.ActivityTypeDelete,
		actor: ALICE, // NOT the sender
		object: "msg-keep",
	})

	await controller.receiveActivity(del)
	expect(database.messages.has("msg-keep")).toBe(true)
})

test('receiving a Delete for a message we do not have is a safe no-op', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })
	stubObjectFetch()

	const del = new Activity({
		type: vocab.ActivityTypeDelete,
		actor: ALICE,
		object: "msg-unknown",
	})

	// Must not throw, and must not create a junk group for the unknown message.
	await controller.receiveActivity(del)
	expect(database.groups.has("")).toBe(false)
})

test('receiving an Undo of a Like removes that actor reaction', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	// Seed a message that ALICE has already reacted to
	const message = NewMessage({ id: "msg-undo", groupId: GROUP_ID, sender: ME, content: "hi" })
	message.setReaction(ALICE, "❤️")
	database.messages.set("msg-undo", message)

	// The Undo's object is the inner Like activity (embedded so it resolves without a
	// fetch); that Like's object is the message id being un-liked.
	stubObjectFetch({ type: vocab.ActivityTypeLike, actor: ALICE, object: "msg-undo" })

	const undo = new Activity({
		type: vocab.ActivityTypeUndo,
		actor: ALICE,
		object: {
			type: vocab.ActivityTypeLike,
			actor: ALICE,
			object: "msg-undo",
		},
	})

	await controller.receiveActivity(undo)

	const saved = database.savedMessages.find(m => m.id == "msg-undo")
	expect(saved).toBeDefined()
	expect(saved!.reactions["❤️"]).toBeUndefined()
})

test('receiving a Leave for an unknown group does not throw, even when its object URL is unreachable', async () => {

	const database = new FakeDatabase()
	const { controller } = makeController({ database })

	// The Leave's object is a bare URL the server now rejects (400) — the exact
	// reflected-Leave scenario. Resolving it must not crash the receive pipeline.
	const fetchSpy = stubFailingFetch()

	const leave = new Activity({
		"@context": "https://www.w3.org/ns/activitystreams",
		type: vocab.ActivityTypeLeave,
		actor: ME,
		to: ME,
		object: "https://example.test/groups/already-left/pub/collections/xyz",
	})

	await expect(controller.receiveActivity(leave)).resolves.toBeUndefined()

	// A Leave never reads its resolved object, so we must NOT even attempt to fetch
	// the (unreachable) object URL — no doomed request, no console warning.
	expect(fetchSpy).not.toHaveBeenCalled()

	// No junk group was created for the group we no longer have.
	expect(database.groups.has("https://example.test/groups/already-left/pub/collections/xyz")).toBe(false)
})
