import { test, expect, describe, beforeEach } from 'vitest'

import { Activity } from "../as/activity"
import { Document } from "../as/document"
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
 * Receiving (group resolution branches)
 ******************************************/

// createActivity builds a plaintext "Create" activity carrying a Note.
function createActivity(content: string, context: string): Activity {
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
		},
	})
}

describe("receiveActivity", () => {

	test("creates a group from the activity context and adds the sender as a member", async () => {
		const activity = createActivity("hello", GROUP_ID)

		const result = await codec.receiveActivity(activity, await activity.object())

		expect(result).toBeDefined()
		const group = await database.loadGroup(GROUP_ID)
		expect(group).toBeDefined()
		expect(group!.members).toContain(ALICE)
		expect(group!.createdById).toBe(ALICE)
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

		await codec.receiveActivity(activity, await activity.object())

		const group = await database.loadGroup(GROUP_ID)
		expect(group!.members).toEqual([ME, ALICE])
	})

	test("routes a Like activity to the group of the liked message", async () => {
		seedPlaintextGroup(GROUP_ID, [ME, ALICE])
		database.messages.set("https://example.test/messages/liked", NewMessage({
			id: "https://example.test/messages/liked",
			groupId: GROUP_ID,
			sender: ME,
			content: "x",
		}))

		const likeActivity = new Activity({
			type: vocab.ActivityTypeLike,
			actor: ALICE,
			object: "https://example.test/messages/liked",
		})

		// The Like branch resolves the group from the liked message, not the passed
		// object Document, so a placeholder Document is sufficient (and avoids a fetch).
		const result = await codec.receiveActivity(likeActivity, new Document({}))
		expect(result!.context()).toBe(GROUP_ID)
	})

	test("routes a Leave activity using the activity object id as the group", async () => {
		seedPlaintextGroup(GROUP_ID, [ME, ALICE])

		const leaveActivity = new Activity({
			type: vocab.ActivityTypeLeave,
			actor: ALICE,
			object: GROUP_ID,
		})

		// The Leave branch uses the activity's object id as the group id, so the
		// passed object Document is unused here.
		const result = await codec.receiveActivity(leaveActivity, new Document({}))
		expect(result!.context()).toBe(GROUP_ID)
	})

	test("a Leave for a group we do not have is a safe no-op (no group created)", async () => {
		// e.g. a reflected "Leave" for a group we already left. It must pass through
		// without creating a junk group.
		const leaveActivity = new Activity({
			type: vocab.ActivityTypeLeave,
			actor: ALICE,
			object: "https://example.test/groups/already-gone",
		})

		const result = await codec.receiveActivity(leaveActivity, new Document({}))

		expect(result).toBeDefined()
		expect(await database.loadGroup("https://example.test/groups/already-gone")).toBeUndefined()
	})

	test("rejects an activity whose group is not plaintext", async () => {
		const mls = NewGroup("MLS")
		mls.id = GROUP_ID
		database.groups.set(GROUP_ID, mls)

		const activity = createActivity("hello", GROUP_ID)
		await expect(codec.receiveActivity(activity, await activity.object())).rejects.toThrow(/not a PLAINTEXT group/)
	})
})
