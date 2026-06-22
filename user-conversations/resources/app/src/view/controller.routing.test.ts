// @vitest-environment jsdom
import { test, expect, describe, beforeEach } from 'vitest'

import { Temporal } from "@js-temporal/polyfill"
;(globalThis as any).Temporal ??= Temporal

import m from "mithril"

import { ViewController } from "./controller"
import { FakeDatabase, makeController } from "../service/testHarness"
import { NewGroup } from "../model/group"

// These tests pin the URL-routing behavior of the navigation refactor, including the
// bug where a group id that is a full URL (plaintext groups) must survive the route
// round-trip. The id is carried as the ?id= query param for exactly this reason.

let database: FakeDatabase
let controller: ViewController

// seedGroup stores a group with the given (possibly URL-shaped) id in the fake DB.
function seedGroup(id: string) {
	const group = NewGroup("PLAINTEXT")
	group.id = id
	group.stateId = "ACTIVE"
	group.members = []
	database.groups.set(id, group)
	return group
}

beforeEach(() => {
	const made = makeController()
	database = made.database as FakeDatabase
	controller = new ViewController(made.controller)

	// Fresh router for each test.
	m.route.prefix = "#!"
	const root = document.createElement("div")
	document.body.appendChild(root)
	m.route(root, "/groups", {
		"/groups": { render: () => m("div") },
		"/groups/notes": { render: () => m("div") },
		"/groups/people": { render: () => m("div") },
	})
})

// settle waits for pending async work (the DB load in selectGroup) to flush.
function settle(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0))
}

describe("group id route round-trip", () => {

	test("selectGroup with a URL-shaped id navigates with ?id= and selects it", async () => {
		const url = "https://server.test/users/bob/messages/abc123"
		seedGroup(url)

		controller.selectGroup(url)
		await settle()

		// The id survived the URL round-trip (the original bug: slashes broke it).
		expect(m.route.param("id")).toBe(url)

		// And driving the resolver with that param selects the group.
		controller.routeSelectGroup(m.route.param("id") ?? "")
		await settle()

		expect(controller.selectedGroupId()).toBe(url)
	})

	test("routeSelectGroup is idempotent (no reload loop) for the same id", async () => {
		const url = "https://server.test/users/bob/messages/xyz"
		seedGroup(url)

		controller.routeSelectGroup(url)
		await settle()
		expect(controller.selectedGroupId()).toBe(url)

		// Calling again with the same id (as render would) must not re-clear/reselect.
		controller.routeSelectGroup(url)
		controller.routeSelectGroup(url)
		await settle()
		expect(controller.selectedGroupId()).toBe(url)
	})

	test("empty id clears the selection (the /groups list route)", async () => {
		const url = "https://server.test/users/bob/messages/qqq"
		seedGroup(url)

		controller.routeSelectGroup(url)
		await settle()
		expect(controller.selectedGroupId()).toBe(url)

		controller.routeSelectGroup("")
		await settle()
		expect(controller.selectedGroupId()).toBe("")
	})

	test("hasDetail is true with ?id= present, false on the bare list", async () => {
		const url = "https://server.test/users/bob/messages/hd"
		seedGroup(url)

		m.route.set("/groups")
		await settle()
		expect(controller.hasDetail).toBe(false)

		m.route.set("/groups", { id: url })
		await settle()
		expect(controller.hasDetail).toBe(true)
	})
})
