import { test, expect, describe, beforeEach } from 'vitest'

import { Activity } from "../as/activity"
import * as vocab from "../as/vocab"
import { CodecPlaintext } from "./codecPlaintext"
import { FakeDatabase } from "./testHarness"
import { NewGroup, type Group } from "../model/group"
import { NewMessage } from "../model/message"
import type { IDelivery } from "./interfaces"

const ME = "https://example.test/users/me"
const ALICE = "https://alice.test/users/alice"
const GROUP_ID = "https://example.test/groups/g1"

// RecordingDelivery captures sent activities and returns a configurable server id.
class RecordingDelivery implements IDelivery {
	sent: Activity[] = []
	serverId = "https://server.test/objects/123"

	stop(): void { /* no-op */ }
	setActor(): void { /* no-op */ }
	setSignout(): void { /* no-op */ }
	async sendActivity(activity: Activity): Promise<string> {
		this.sent.push(activity)
		return this.serverId
	}
}

let database: FakeDatabase
let delivery: RecordingDelivery
let codec: CodecPlaintext

beforeEach(() => {
	database = new FakeDatabase()
	delivery = new RecordingDelivery()
	codec = new CodecPlaintext(database, delivery, ME)
})

// seedPlaintextGroup stores a plaintext group in the fake database.
function seedPlaintextGroup(id: string, members: string[] = []): Group {
	const group = NewGroup("PLAINTEXT")
	group.id = id
	group.members = members
	database.groups.set(id, group)
	return group
}

/******************************************
 * Group management
 ******************************************/

describe("createGroup", () => {

	test("sends a create activity and persists the returned group", async () => {
		delivery.serverId = GROUP_ID
		const group = await codec.createGroup([ALICE])

		expect(delivery.sent.length).toBe(1)
		expect(group.id).toBe(GROUP_ID)
		expect(group.codec).toBe("PLAINTEXT")
		expect(group.members).toEqual([ALICE])
		expect(database.groups.has(GROUP_ID)).toBe(true)
	})
})

describe("getGroup", () => {

	test("returns an existing plaintext group", async () => {
		seedPlaintextGroup(GROUP_ID, [ALICE])
		const group = await codec.getGroup(GROUP_ID)
		expect(group.id).toBe(GROUP_ID)
		expect(group.members).toEqual([ALICE])
	})

	test("creates a new group when none exists", async () => {
		const group = await codec.getGroup("https://example.test/groups/new")
		expect(group.codec).toBe("PLAINTEXT")
		expect(database.groups.has("https://example.test/groups/new")).toBe(true)
	})

	test("throws when the stored group is not plaintext", async () => {
		const mls = NewGroup("MLS")
		mls.id = GROUP_ID
		database.groups.set(GROUP_ID, mls)
		await expect(codec.getGroup(GROUP_ID)).rejects.toThrow(/not a PLAINTEXT group/)
	})
})

describe("getGroupMembers", () => {

	test("returns the group's member list", () => {
		const group = NewGroup("PLAINTEXT")
		group.members = [ME, ALICE]
		expect(codec.getGroupMembers(group)).toEqual([ME, ALICE])
	})
})

describe("addGroupMembers / removeGroupMember", () => {

	test("addGroupMembers appends new members", async () => {
		const group = NewGroup("PLAINTEXT")
		group.members = [ME]
		await codec.addGroupMembers(group, [ALICE])
		expect(group.members).toEqual([ME, ALICE])
	})

	test("addGroupMembers does not duplicate an existing member", async () => {
		const group = NewGroup("PLAINTEXT")
		group.members = [ME, ALICE]
		await codec.addGroupMembers(group, [ALICE])
		expect(group.members).toEqual([ME, ALICE])
	})

	test("addGroupMembers de-duplicates within the incoming list", async () => {
		const group = NewGroup("PLAINTEXT")
		group.members = [ME]
		await codec.addGroupMembers(group, [ALICE, ALICE])
		expect(group.members).toEqual([ME, ALICE])
	})

	test("removeGroupMember filters out the actor", async () => {
		const group = NewGroup("PLAINTEXT")
		group.members = [ME, ALICE]
		await codec.removeGroupMember(group, ALICE)
		expect(group.members).toEqual([ME])
	})

	test("leaveGroup resolves without error", async () => {
		const group = NewGroup("PLAINTEXT")
		await expect(codec.leaveGroup(group)).resolves.toBeUndefined()
	})
})

/******************************************
 * Sending
 ******************************************/

describe("encodeMessage", () => {

	test("produces a Note object with the message content and recipients", async () => {
		const group = NewGroup("PLAINTEXT")
		group.id = GROUP_ID
		group.members = [ME, ALICE]
		group.lastMessageId = "https://example.test/messages/prev"

		const message = NewMessage({ id: "m1", groupId: GROUP_ID, sender: ME, content: "<p>hi</p>" })

		const object = await codec.encodeMessage(group, message) as Record<string, any>

		expect(object.type).toBe(vocab.ObjectTypeNote)
		expect(object.content).toBe("<p>hi</p>")
		expect(object.attributedTo).toBe(ME)
		expect(object.to).toEqual([ME, ALICE])
		expect(object.context).toBe(GROUP_ID)
		// Falls back to the group's lastMessageId when the message has no inReplyTo
		expect(object.inReplyTo).toBe("https://example.test/messages/prev")
	})
})

describe("sendActivity", () => {

	test("adds Mention tags for each member and delivers the activity", async () => {
		const group = NewGroup("PLAINTEXT")
		group.id = GROUP_ID
		group.members = [ME, ALICE]

		const activity = new Activity({
			type: vocab.ActivityTypeCreate,
			actor: ME,
			object: { type: vocab.ObjectTypeNote, content: "hi" },
		})

		const result = await codec.sendActivity(group, activity)

		expect(result).toBe(delivery.serverId)
		expect(delivery.sent.length).toBe(1)

		// The delivered object should carry a Mention tag per member
		const sentObject = delivery.sent[0]!.objectAsMap()
		expect(sentObject[vocab.PropertyTag]).toEqual([
			{ type: "Mention", href: ME },
			{ type: "Mention", href: ALICE },
		])
	})

	test("defaults the recipients to all members when none are set", async () => {
		const group = NewGroup("PLAINTEXT")
		group.id = GROUP_ID
		group.members = [ME, ALICE]

		const activity = new Activity({
			type: vocab.ActivityTypeCreate,
			actor: ME,
			object: { type: vocab.ObjectTypeNote, content: "hi" },
		})

		await codec.sendActivity(group, activity)
		expect(activity.recipients()).toEqual([ME, ALICE])
	})

	test("does not add Mention tags to Acknowledge activities", async () => {
		const group = NewGroup("PLAINTEXT")
		group.id = GROUP_ID
		group.members = [ME, ALICE]

		const activity = new Activity({
			type: vocab.ActivityTypeAcknowledge,
			actor: ME,
			object: "https://example.test/messages/m1",
		})

		await codec.sendActivity(group, activity)
		expect(activity.objectAsMap()[vocab.PropertyTag]).toBeUndefined()
	})
})

/******************************************
 * Receiving
 ******************************************/

// createActivity builds a plaintext "Create" activity carrying an embedded Note.
// The object MUST be embedded (not a bare id) so that activity.object() does not
// trigger a network fetch during the receive path.
function createActivity(content: string, context: string, overrides: Record<string, any> = {}): Activity {
	return new Activity({
		type: vocab.ActivityTypeCreate,
		actor: ALICE,
		context: context,
		to: [ME],
		object: {
			id: "https://example.test/messages/incoming",
			type: vocab.ObjectTypeNote,
			attributedTo: ALICE,
			context: context,
			content: content,
			...overrides,
		},
	})
}

// seedMessage stores a message in the fake database and returns it.
function seedMessage(id: string, groupId: string): void {
	database.messages.set(id, NewMessage({ id, groupId, sender: ME, content: "x" }))
}

/******************************************
 * receiveActivity — top-level type routing
 ******************************************/

describe("receiveActivity (type routing)", () => {

	test("Acknowledge is a no-op (returns undefined)", async () => {
		const activity = new Activity({ type: vocab.ActivityTypeAcknowledge, actor: ALICE, object: "https://x.test/m/1" })
		expect(await codec.receiveActivity(activity)).toBeUndefined()
	})

	test("Failure is a no-op (returns undefined)", async () => {
		const activity = new Activity({ type: vocab.ActivityTypeFailure, actor: ALICE, object: "https://x.test/m/1" })
		expect(await codec.receiveActivity(activity)).toBeUndefined()
	})

	test("Undo passes the activity through unchanged", async () => {
		const activity = new Activity({ type: vocab.ActivityTypeUndo, actor: ALICE, object: "https://x.test/m/1" })
		const result = await codec.receiveActivity(activity)
		expect(result).toBe(activity)
	})

	test("an unrecognized activity type passes through to the controller (implicit Create)", async () => {
		// The codec does not understand "Announce", so it passes it through unchanged
		// and lets the controller decide whether to treat it as an implicit Create.
		const activity = new Activity({ type: "Announce", actor: ALICE, object: "https://x.test/m/1" })
		const result = await codec.receiveActivity(activity)
		expect(result).toBe(activity)
	})
})

/******************************************
 * receiveActivity — Create / Update (group create/update)
 ******************************************/

describe("receiveActivity — Create/Update", () => {

	test("creates a group from the activity context and adds the sender as a member", async () => {
		const activity = createActivity("hello", GROUP_ID)

		const result = await codec.receiveActivity(activity)

		expect(result).toBeDefined()
		const group = await database.loadGroup(GROUP_ID)
		expect(group).toBeDefined()
		expect(group!.members).toContain(ALICE)
		expect(group!.createdById).toBe(ALICE)
	})

	test("an Update activity also resolves and updates the group", async () => {
		seedPlaintextGroup(GROUP_ID, [ME])

		const activity = new Activity({
			type: vocab.ActivityTypeUpdate,
			actor: ALICE,
			context: GROUP_ID,
			to: [ME],
			object: {
				id: "https://example.test/messages/edit",
				type: vocab.ObjectTypeNote,
				attributedTo: ALICE,
				context: GROUP_ID,
				content: "edited",
			},
		})

		const result = await codec.receiveActivity(activity)

		expect(result).toBeDefined()
		expect(result!.context()).toBe(GROUP_ID)
		const group = await database.loadGroup(GROUP_ID)
		expect(group!.members).toEqual([ME, ALICE])
	})

	test("rewrites the activity context to the resolved group id", async () => {
		const activity = createActivity("hello", GROUP_ID)
		const result = await codec.receiveActivity(activity)
		expect(result!.context()).toBe(GROUP_ID)
	})

	test("does not overwrite an existing group's createdById", async () => {
		const group = seedPlaintextGroup(GROUP_ID, [ME])
		group.createdById = ME
		database.groups.set(GROUP_ID, group)

		await codec.receiveActivity(createActivity("hi", GROUP_ID))

		const reloaded = await database.loadGroup(GROUP_ID)
		expect(reloaded!.createdById).toBe(ME)
	})

	test("does not duplicate members when the activity names an actor more than once", async () => {
		// ALICE is both the actor and a recipient, and ME appears twice in "to".
		// Neither should produce a duplicate in the group's member list.
		seedPlaintextGroup(GROUP_ID, [ME])

		const activity = new Activity({
			type: vocab.ActivityTypeCreate,
			actor: ALICE,
			context: GROUP_ID,
			to: [ME, ME, ALICE],
			object: {
				id: "https://example.test/messages/dup",
				type: vocab.ObjectTypeNote,
				attributedTo: ALICE,
				context: GROUP_ID,
				content: "hi",
			},
		})

		await codec.receiveActivity(activity)

		const group = await database.loadGroup(GROUP_ID)
		expect(group!.members).toEqual([ME, ALICE])
	})

	test("rejects a Create whose target group is not plaintext", async () => {
		const mls = NewGroup("MLS")
		mls.id = GROUP_ID
		database.groups.set(GROUP_ID, mls)

		const activity = createActivity("hello", GROUP_ID)
		await expect(codec.receiveActivity(activity)).rejects.toThrow(/not a PLAINTEXT group/)
	})
})

/******************************************
 * receiveActivity — group resolution (#calcGroupId)
 ******************************************/

describe("receiveActivity — group resolution", () => {

	test("a reply inherits the group of the message it replies to", async () => {
		// The parent message belongs to GROUP_ID; the reply carries a DIFFERENT
		// context, but inReplyTo must win so the reply lands in the parent's group.
		seedPlaintextGroup(GROUP_ID, [ME, ALICE])
		seedMessage("https://example.test/messages/parent", GROUP_ID)

		const activity = createActivity("a reply", "https://example.test/groups/other", {
			inReplyTo: "https://example.test/messages/parent",
		})

		const result = await codec.receiveActivity(activity)

		expect(result!.context()).toBe(GROUP_ID)
		// The bogus "other" group must NOT have been created.
		expect(await database.loadGroup("https://example.test/groups/other")).toBeUndefined()
	})

	test("a reply to an unknown message falls back to the context", async () => {
		// inReplyTo references a message we don't have; resolution must fall through
		// to the activity context rather than throwing.
		const activity = createActivity("orphan reply", GROUP_ID, {
			inReplyTo: "https://example.test/messages/missing",
		})

		const result = await codec.receiveActivity(activity)

		expect(result!.context()).toBe(GROUP_ID)
		expect(await database.loadGroup(GROUP_ID)).toBeDefined()
	})

	test("falls back to the object context when the activity has no context", async () => {
		const activity = new Activity({
			type: vocab.ActivityTypeCreate,
			actor: ALICE,
			to: [ME],
			// no activity-level context
			object: {
				id: "https://example.test/messages/objctx",
				type: vocab.ObjectTypeNote,
				attributedTo: ALICE,
				context: GROUP_ID,
				content: "hi",
			},
		})

		const result = await codec.receiveActivity(activity)

		expect(result!.context()).toBe(GROUP_ID)
		expect(await database.loadGroup(GROUP_ID)).toBeDefined()
	})

	test("creates a brand-new group when no context can be determined", async () => {
		const activity = new Activity({
			type: vocab.ActivityTypeCreate,
			actor: ALICE,
			to: [ME],
			// no context anywhere, no inReplyTo
			object: {
				id: "https://example.test/messages/nocontext",
				type: vocab.ObjectTypeNote,
				attributedTo: ALICE,
				content: "hi",
			},
		})

		const result = await codec.receiveActivity(activity)

		// A new group id was minted and applied to the activity.
		expect(result).toBeDefined()
		const newContext = result!.context()
		expect(newContext).not.toBe("")
		const group = await database.loadGroup(newContext)
		expect(group).toBeDefined()
		expect(group!.codec).toBe("PLAINTEXT")
	})
})

/******************************************
 * receiveActivity — Like / Delete (message validation)
 ******************************************/

describe("receiveActivity — Like/Delete", () => {

	test("a Like passes through when its message and group exist", async () => {
		seedPlaintextGroup(GROUP_ID, [ME, ALICE])
		seedMessage("https://example.test/messages/liked", GROUP_ID)

		const likeActivity = new Activity({
			type: vocab.ActivityTypeLike,
			actor: ALICE,
			object: "https://example.test/messages/liked",
		})

		const result = await codec.receiveActivity(likeActivity)
		expect(result).toBe(likeActivity)
	})

	test("a Delete passes through when its message and group exist", async () => {
		seedPlaintextGroup(GROUP_ID, [ME, ALICE])
		seedMessage("https://example.test/messages/del", GROUP_ID)

		const deleteActivity = new Activity({
			type: vocab.ActivityTypeDelete,
			actor: ALICE,
			object: "https://example.test/messages/del",
		})

		const result = await codec.receiveActivity(deleteActivity)
		expect(result).toBe(deleteActivity)
	})

	test("a Like for a message we do not have is a no-op", async () => {
		const likeActivity = new Activity({
			type: vocab.ActivityTypeLike,
			actor: ALICE,
			object: "https://example.test/messages/missing",
		})

		expect(await codec.receiveActivity(likeActivity)).toBeUndefined()
	})

	test("a Like whose message belongs to a non-plaintext group is a no-op", async () => {
		// Message exists, but its group is MLS — the plaintext codec must not touch it.
		const mls = NewGroup("MLS")
		mls.id = GROUP_ID
		database.groups.set(GROUP_ID, mls)
		seedMessage("https://example.test/messages/liked", GROUP_ID)

		const likeActivity = new Activity({
			type: vocab.ActivityTypeLike,
			actor: ALICE,
			object: "https://example.test/messages/liked",
		})

		expect(await codec.receiveActivity(likeActivity)).toBeUndefined()
	})

	test("a Like whose message references a missing group is a no-op", async () => {
		// Message exists but points at a group id we never stored.
		seedMessage("https://example.test/messages/liked", "https://example.test/groups/gone")

		const likeActivity = new Activity({
			type: vocab.ActivityTypeLike,
			actor: ALICE,
			object: "https://example.test/messages/liked",
		})

		expect(await codec.receiveActivity(likeActivity)).toBeUndefined()
	})
})

/******************************************
 * receiveActivity — Leave (group validation)
 ******************************************/

describe("receiveActivity — Leave", () => {

	test("a Leave passes through when its group exists", async () => {
		seedPlaintextGroup(GROUP_ID, [ME, ALICE])

		const leaveActivity = new Activity({
			type: vocab.ActivityTypeLeave,
			actor: ALICE,
			object: GROUP_ID,
		})

		const result = await codec.receiveActivity(leaveActivity)
		expect(result).toBe(leaveActivity)
	})

	test("a Leave for a group we do not have is a safe no-op (no group created)", async () => {
		// e.g. a reflected "Leave" for a group we already left. It must NOT create a junk group.
		const leaveActivity = new Activity({
			type: vocab.ActivityTypeLeave,
			actor: ALICE,
			object: "https://example.test/groups/already-gone",
		})

		const result = await codec.receiveActivity(leaveActivity)

		expect(result).toBeUndefined()
		expect(await database.loadGroup("https://example.test/groups/already-gone")).toBeUndefined()
	})

	test("a Leave for a non-plaintext group is a no-op", async () => {
		const mls = NewGroup("MLS")
		mls.id = GROUP_ID
		database.groups.set(GROUP_ID, mls)

		const leaveActivity = new Activity({
			type: vocab.ActivityTypeLeave,
			actor: ALICE,
			object: GROUP_ID,
		})

		expect(await codec.receiveActivity(leaveActivity)).toBeUndefined()
	})
})
