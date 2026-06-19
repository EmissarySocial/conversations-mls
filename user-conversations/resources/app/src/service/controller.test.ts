// @vitest-environment jsdom
import { test, expect, describe, beforeEach } from 'vitest'

import { Temporal } from "@js-temporal/polyfill"
;(globalThis as any).Temporal ??= Temporal

import { Controller } from "./controller"
import { FakeDatabase, makeController } from "./testHarness"
import { NewGroup, type Group, type GroupState } from "../model/group"
import { NewFilter, type Filter } from "../model/filter"
import { NewMessage } from "../model/message"

// The controller's actorId() reads this.#actor.id(), which is "" for the harness's
// empty Actor. Tests use "" to mean "the local user" (sender of their own messages).
const ME = ""

// seedGroup creates a plaintext group, stores it in the fake database, and returns it.
function seedGroup(database: FakeDatabase, overrides: Partial<Group> = {}): Group {
	const group = NewGroup("PLAINTEXT")
	group.id = overrides.id ?? "group-1"
	group.stateId = overrides.stateId ?? "ACTIVE"
	group.members = overrides.members ?? []
	if (overrides.tags) { group.tags = overrides.tags }
	database.groups.set(group.id, group)
	return group
}

// seedFilter creates a filter, stores it in the fake database, and returns it.
function seedFilter(database: FakeDatabase, name: string, sort: number, states: GroupState[], tags: string[] = []): Filter {
	const filter = NewFilter()
	filter.name = name
	filter.sort = sort
	filter.states = states
	filter.tags = tags
	database.filters.set(filter.id, filter)
	return filter
}

let database: FakeDatabase
let controller: Controller

beforeEach(() => {
	const made = makeController()
	database = made.database as FakeDatabase
	controller = made.controller
})

/******************************************
 * Filters
 ******************************************/

describe("loadFilters", () => {

	test("loads all filters from the database", async () => {
		seedFilter(database, "Current", 1, ["ACTIVE"])
		seedFilter(database, "Archived", 2, ["ARCHIVED"])

		await controller.loadFilters()

		expect(controller.filters.length).toBe(2)
		expect(controller.filters.map(f => f.name).sort()).toEqual(["Archived", "Current"])
	})
})

describe("selectedFilterName", () => {

	test("returns the name of the selected filter", async () => {
		const filter = seedFilter(database, "Important", 1, ["IMPORTANT"])
		await controller.loadFilters()
		controller.config.selectedFilterId = filter.id

		expect(controller.selectedFilterName()).toBe("Important")
	})

	test("returns empty string when no filter is selected", async () => {
		await controller.loadFilters()
		controller.config.selectedFilterId = "does-not-exist"
		expect(controller.selectedFilterName()).toBe("")
	})
})

describe("setConversationFilter", () => {

	test("records the selected filter id", async () => {
		const filter = seedFilter(database, "Important", 1, ["IMPORTANT"])
		await controller.loadFilters()

		await controller.setConversationFilter(filter.id)

		expect(controller.config.selectedFilterId).toBe(filter.id)
	})
})

describe("deleteFilter", () => {

	test("removes the filter from the database", async () => {
		const a = seedFilter(database, "A", 1, ["ACTIVE"])
		const b = seedFilter(database, "B", 2, ["ARCHIVED"])
		await controller.loadFilters()

		await controller.deleteFilter(a.id)

		expect(database.filters.has(a.id)).toBe(false)
		expect(database.filters.has(b.id)).toBe(true)
	})

	test("re-points the selection to the first remaining filter when the selected one is deleted", async () => {
		const a = seedFilter(database, "A", 1, ["ACTIVE"])
		const b = seedFilter(database, "B", 2, ["ARCHIVED"])
		await controller.loadFilters()
		controller.config.selectedFilterId = a.id

		await controller.deleteFilter(a.id)

		// Selection must move off the deleted filter to the remaining one
		expect(controller.config.selectedFilterId).toBe(b.id)
	})

	test("leaves the selection alone when a non-selected filter is deleted", async () => {
		const a = seedFilter(database, "A", 1, ["ACTIVE"])
		const b = seedFilter(database, "B", 2, ["ARCHIVED"])
		await controller.loadFilters()
		controller.config.selectedFilterId = a.id

		await controller.deleteFilter(b.id)

		expect(controller.config.selectedFilterId).toBe(a.id)
	})
})

/******************************************
 * Group loading + selection
 ******************************************/

describe("loadGroups", () => {

	test("loads all groups when no filter is selected", async () => {
		seedGroup(database, { id: "g1", stateId: "ACTIVE" })
		seedGroup(database, { id: "g2", stateId: "ARCHIVED" })
		controller.config.selectedFilterId = ""

		await controller.loadGroups()

		expect(controller.groups.length).toBe(2)
	})
})

describe("selectGroup", () => {

	test("displays a group loaded from the database by id", async () => {
		seedGroup(database, { id: "g1" })

		await controller.selectGroup("g1")

		expect(controller.selectedGroupId()).toBe("g1")
	})

	test("displays a group even when it is not in the filtered sidebar list", async () => {
		// The group exists in the DB but the in-memory filtered list is empty
		seedGroup(database, { id: "hidden" })
		controller.groups = []

		await controller.selectGroup("hidden")

		expect(controller.selectedGroupId()).toBe("hidden")
	})

	test("clears the selection when the group does not exist", async () => {
		await controller.selectGroup("nope")
		expect(controller.selectedGroupId()).toBe("")
	})
})

describe("reconcileSelectedGroup", () => {

	test("leaves a still-valid selected group in place", async () => {
		seedGroup(database, { id: "keep" })
		await controller.selectGroup("keep")

		// Reload the list (e.g. after a filter change) — selection must not change
		await controller.reconcileSelectedGroup()

		expect(controller.selectedGroupId()).toBe("keep")
	})

	test("falls back to the first listed group when nothing is selected", async () => {
		const first = seedGroup(database, { id: "first" })
		controller.groups = [first]
		controller.clearSelectedGroup()

		await controller.reconcileSelectedGroup()

		expect(controller.selectedGroupId()).toBe("first")
	})

	test("clears the selection when there are no groups at all", async () => {
		controller.groups = []
		controller.clearSelectedGroup()

		await controller.reconcileSelectedGroup()

		expect(controller.selectedGroupId()).toBe("")
	})
})

describe("clearSelectedGroup", () => {

	test("empties the selection and messages", () => {
		controller.messages = [NewMessage({ id: "m1" })]
		controller.clearSelectedGroup()

		expect(controller.selectedGroupId()).toBe("")
		expect(controller.messages).toEqual([])
	})
})

/******************************************
 * Group state
 ******************************************/

describe("setGroupState", () => {

	test("applies a valid state to the group", () => {
		const group = NewGroup("PLAINTEXT")
		controller.setGroupState(group, "IMPORTANT")
		expect(group.stateId).toBe("IMPORTANT")
	})

	test("accepts every user-settable state", () => {
		for (const state of ["IMPORTANT", "ACTIVE", "ARCHIVED", "CLOSED"] as const) {
			const group = NewGroup("PLAINTEXT")
			controller.setGroupState(group, state)
			expect(group.stateId).toBe(state)
		}
	})

	test("ignores an invalid state", () => {
		const group = NewGroup("PLAINTEXT")
		group.stateId = "ACTIVE"
		controller.setGroupState(group, "BOGUS")
		expect(group.stateId).toBe("ACTIVE")
	})

	test("ignores WELCOME (it is not a user-settable state)", () => {
		// WELCOME is reached only by invitation, never by a manual transition, so
		// setGroupState deliberately rejects it.
		const group = NewGroup("PLAINTEXT")
		group.stateId = "ACTIVE"
		controller.setGroupState(group, "WELCOME")
		expect(group.stateId).toBe("ACTIVE")
	})
})

describe("setSelectedGroupState", () => {

	test("changes the selected group's state and persists it", async () => {
		seedGroup(database, { id: "g1", stateId: "ACTIVE" })
		await controller.selectGroup("g1")

		await controller.setSelectedGroupState("IMPORTANT")

		expect(controller.groupStream().stateId).toBe("IMPORTANT")
		const saved = await database.loadGroup("g1")
		expect(saved!.stateId).toBe("IMPORTANT")
	})

	test("is a no-op when the state is unchanged", async () => {
		seedGroup(database, { id: "g1", stateId: "ACTIVE" })
		await controller.selectGroup("g1")
		database.savedGroups = []

		await controller.setSelectedGroupState("ACTIVE")

		expect(database.savedGroups.length).toBe(0)
	})
})

describe("joinGroup", () => {

	test("moves a WELCOME group to ACTIVE and persists it", async () => {
		const group = seedGroup(database, { id: "g1", stateId: "WELCOME" })

		await controller.joinGroup(group)

		expect(group.stateId).toBe("ACTIVE")
		const saved = await database.loadGroup("g1")
		expect(saved!.stateId).toBe("ACTIVE")
	})

	test("refuses to join a group that is not in the WELCOME state", async () => {
		const group = seedGroup(database, { id: "g1", stateId: "ACTIVE" })
		database.savedGroups = []

		await controller.joinGroup(group)

		// State is unchanged and nothing was saved
		expect(group.stateId).toBe("ACTIVE")
		expect(database.savedGroups.length).toBe(0)
	})
})

/******************************************
 * Reply state
 ******************************************/

describe("startReply / removeReply", () => {

	test("startReply sets the inReplyTo message", () => {
		const message = NewMessage({ id: "m1" })
		controller.startReply(message)
		expect(controller.inReplyTo).toBe(message)
	})

	test("removeReply clears the inReplyTo message", () => {
		controller.startReply(NewMessage({ id: "m1" }))
		controller.removeReply()
		expect(controller.inReplyTo).toBeUndefined()
	})
})

/******************************************
 * Sending / editing / deleting messages (plaintext)
 ******************************************/

describe("sendMessage", () => {

	test("throws when no group is selected", async () => {
		controller.clearSelectedGroup()
		await expect(controller.sendMessage("hello")).rejects.toThrow(/No group selected/)
	})

	test("formats the content to sanitized HTML and saves the message", async () => {
		seedGroup(database, { id: "g1", members: [ME] })
		await controller.selectGroup("g1")

		await controller.sendMessage("hi <script>alert(1)</script>\nthere")

		const saved = database.savedMessages.find(m => m.groupId == "g1" && m.type == "SENT")
		expect(saved).toBeDefined()
		expect(saved!.content).not.toContain("<script>")
		expect(saved!.content).toContain("hi")
		expect(saved!.content).toContain("<br>")
	})

	test("stores the group's lastMessage as plain text", async () => {
		seedGroup(database, { id: "g1", members: [ME] })
		await controller.selectGroup("g1")

		await controller.sendMessage("hello world")

		const group = await database.loadGroup("g1")
		expect(group!.lastMessage).not.toContain("<")
		expect(group!.lastMessage).toContain("hello world")
	})
})

describe("updateMessage", () => {

	test("ignores an edit from someone other than the sender", async () => {
		seedGroup(database, { id: "g1" })
		await controller.selectGroup("g1")

		const message = NewMessage({ id: "m1", groupId: "g1", sender: "https://someone.else/users/x", content: "before" })
		await controller.updateMessage(message)

		// Guard rejects before any save
		expect(database.savedMessages.some(m => m.id == "m1")).toBe(false)
	})

	test("formats edited content to sanitized HTML for the sender", async () => {
		seedGroup(database, { id: "g1" })
		await controller.selectGroup("g1")

		const message = NewMessage({ id: "m1", groupId: "g1", sender: ME, content: "before" })
		message.content = "after <script>x</script>"
		await controller.updateMessage(message)

		expect(message.content).not.toContain("<script>")
		expect(message.content).toContain("after")
	})
})

describe("deleteMessage", () => {

	test("does nothing when the message does not exist", async () => {
		seedGroup(database, { id: "g1" })
		await controller.selectGroup("g1")

		await controller.deleteMessage("missing")
		// No throw, nothing deleted
		expect(database.messages.size).toBe(0)
	})

	test("refuses to delete a message the local user did not send", async () => {
		seedGroup(database, { id: "g1" })
		await controller.selectGroup("g1")
		const message = NewMessage({ id: "m1", groupId: "g1", sender: "https://other/users/y", content: "x" })
		database.messages.set("m1", message)

		await controller.deleteMessage("m1")

		expect(database.messages.has("m1")).toBe(true)
	})

	test("deletes the local user's own message in the current group", async () => {
		seedGroup(database, { id: "g1", members: [ME] })
		await controller.selectGroup("g1")
		const message = NewMessage({ id: "m1", groupId: "g1", sender: ME, content: "x" })
		database.messages.set("m1", message)

		await controller.deleteMessage("m1")

		expect(database.messages.has("m1")).toBe(false)
	})
})

/******************************************
 * lastMessage config getter/setter
 ******************************************/

describe("lastMessage", () => {

	test("returns the stored lastMessageId", async () => {
		controller.config.lastMessageId = "msg-42"
		expect(await controller.lastMessage()).toBe("msg-42")
	})

	test("updates the lastMessageId when one is provided", async () => {
		await controller.lastMessage("msg-99")
		expect(controller.config.lastMessageId).toBe("msg-99")
	})
})
