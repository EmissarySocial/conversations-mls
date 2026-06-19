import { test, expect, describe, beforeEach, afterEach, vi } from 'vitest'
import m from "mithril"

import { ActorSearch } from "./widget-actorSearch"
import { Actor } from "../as/actor"

// These tests drive the ActorSearch widget's logic methods directly (no DOM
// mounting): they build a fake vnode with `state` and `attrs`, call oninit, then
// exercise loadOptions / selectActor / onkeydown and assert on the resulting
// state. `m.request` is mocked to control search responses (and their ordering).

const ALICE = { id: "https://x.test/alice", type: "Person", name: "Alice", preferredUsername: "alice" }
const ALAN = { id: "https://x.test/alan", type: "Person", name: "Alan", preferredUsername: "alan" }
const BOB = { id: "https://x.test/bob", type: "Person", name: "Bob", preferredUsername: "bob" }

// makeVnode builds a minimal vnode the widget's methods operate on. `value` is the
// caller-owned array of already-selected actors; `onselect` records callbacks.
function makeVnode(overrides: { value?: Actor[], onselect?: (actors: Actor[], canEncrypt: boolean) => void } = {}) {
	const selected: Actor[] = []
	const controller = {
		// Disable encryption so selectActor() does not try to load KeyPackages.
		useEncryptedMessages: () => false,
		stop: vi.fn(),
	}
	return {
		state: {} as any,
		attrs: {
			controller: controller as any,
			id: "idActorSearch",
			name: "actors",
			value: overrides.value ?? [],
			endpoint: "/.api/actors",
			onselect: overrides.onselect ?? (() => { }),
		},
		__selected: selected,
		__controller: controller,
	} as any
}

// keyEvent builds a minimal KeyboardEvent-like object for onkeydown.
function keyEvent(key: string): KeyboardEvent {
	return {
		key,
		shiftKey: false, ctrlKey: false, metaKey: false,
		target: { selectionStart: 1 },
		preventDefault: () => { },
		stopPropagation: () => { },
	} as unknown as KeyboardEvent
}

let widget: ActorSearch

beforeEach(() => {
	widget = new ActorSearch()
	vi.spyOn(m, "redraw").mockImplementation(() => { })
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe("loadOptions", () => {

	test("populates results and auto-highlights the first row", async () => {
		vi.spyOn(m, "request").mockResolvedValue([ALICE, ALAN] as any)

		const vnode = makeVnode()
		widget.oninit(vnode)
		vnode.state.search = "al"

		await widget.loadOptions(vnode)

		expect(vnode.state.actors.map((a: Actor) => a.id())).toEqual([ALICE.id, ALAN.id])
		expect(vnode.state.highlightedOption).toBe(0)
	})

	test("clears results immediately for an empty search (no request)", async () => {
		const request = vi.spyOn(m, "request").mockResolvedValue([] as any)

		const vnode = makeVnode()
		widget.oninit(vnode)
		vnode.state.actors = [new Actor(ALICE)]
		vnode.state.search = ""

		await widget.loadOptions(vnode)

		expect(vnode.state.actors).toEqual([])
		expect(vnode.state.highlightedOption).toBe(-1)
		expect(request).not.toHaveBeenCalled()
	})

	test("de-duplicates results returned with the same id", async () => {
		// Endpoint returns ALICE twice plus BOB
		vi.spyOn(m, "request").mockResolvedValue([ALICE, ALICE, BOB] as any)

		const vnode = makeVnode()
		widget.oninit(vnode)
		vnode.state.search = "a"

		await widget.loadOptions(vnode)

		expect(vnode.state.actors.map((a: Actor) => a.id())).toEqual([ALICE.id, BOB.id])
	})

	test("leaves no highlight when the search returns nothing", async () => {
		vi.spyOn(m, "request").mockResolvedValue([] as any)

		const vnode = makeVnode()
		widget.oninit(vnode)
		vnode.state.search = "zzz"

		await widget.loadOptions(vnode)

		expect(vnode.state.actors).toEqual([])
		expect(vnode.state.highlightedOption).toBe(-1)
	})

	test("a stale (slower) earlier response does not clobber the newer results", async () => {
		// First request resolves LAST; second resolves FIRST. The widget must keep the
		// second (newest) request's results, not let the stale first one overwrite them.
		let resolveFirst!: (v: any) => void
		const firstResponse = new Promise(resolve => { resolveFirst = resolve })

		vi.spyOn(m, "request")
			.mockReturnValueOnce(firstResponse as any)      // request #1 (stale)
			.mockResolvedValueOnce([BOB] as any)            // request #2 (newest)

		const vnode = makeVnode()
		widget.oninit(vnode)

		// Fire request #1, then request #2 before #1 resolves
		vnode.state.search = "b"
		const p1 = widget.loadOptions(vnode)
		vnode.state.search = "bo"
		const p2 = widget.loadOptions(vnode)

		await p2 // newest settles first

		// Now let the stale first request resolve with different data
		resolveFirst([ALICE, ALAN])
		await p1

		// The newest results survive; the stale response is dropped
		expect(vnode.state.actors.map((a: Actor) => a.id())).toEqual([BOB.id])
	})

	test("a 401 response stops the controller (session expired)", async () => {
		vi.spyOn(m, "request").mockRejectedValue({ code: 401 })

		const vnode = makeVnode()
		widget.oninit(vnode)
		vnode.state.search = "al"

		await widget.loadOptions(vnode)

		expect(vnode.__controller.stop).toHaveBeenCalledWith("SESSION-EXPIRED")
	})

	test("a non-401 error clears the results", async () => {
		vi.spyOn(m, "request").mockRejectedValue(new Error("boom"))
		vi.spyOn(console, "error").mockImplementation(() => { })

		const vnode = makeVnode()
		widget.oninit(vnode)
		vnode.state.actors = [new Actor(ALICE)]
		vnode.state.search = "al"

		await widget.loadOptions(vnode)

		expect(vnode.state.actors).toEqual([])
		expect(vnode.state.highlightedOption).toBe(-1)
	})
})

describe("selectActor", () => {

	test("adds the highlighted actor to the value and clears the search", async () => {
		const onselect = vi.fn()
		const vnode = makeVnode({ onselect })
		widget.oninit(vnode)
		vnode.state.actors = [new Actor(ALICE), new Actor(BOB)]
		vnode.state.search = "al"

		widget.selectActor(vnode, 1) // pick BOB

		expect(vnode.attrs.value.map((a: Actor) => a.id())).toEqual([BOB.id])
		expect(vnode.state.actors).toEqual([])
		expect(vnode.state.search).toBe("")
		expect(onselect).toHaveBeenCalled()
	})

	test("is a no-op for an out-of-range index", () => {
		const vnode = makeVnode()
		widget.oninit(vnode)
		vnode.state.actors = [new Actor(ALICE)]

		widget.selectActor(vnode, -1)
		widget.selectActor(vnode, 5)

		expect(vnode.attrs.value).toEqual([])
	})
})

describe("onkeydown navigation", () => {

	test("ArrowDown moves the highlight down, clamped to the last item", async () => {
		const vnode = makeVnode()
		widget.oninit(vnode)
		vnode.state.actors = [new Actor(ALICE), new Actor(ALAN)]
		vnode.state.highlightedOption = 0

		await widget.onkeydown(keyEvent("ArrowDown"), vnode)
		expect(vnode.state.highlightedOption).toBe(1)

		// Already at the last row — stays put
		await widget.onkeydown(keyEvent("ArrowDown"), vnode)
		expect(vnode.state.highlightedOption).toBe(1)
	})

	test("ArrowUp moves the highlight up, clamped to the first item", async () => {
		const vnode = makeVnode()
		widget.oninit(vnode)
		vnode.state.actors = [new Actor(ALICE), new Actor(ALAN)]
		vnode.state.highlightedOption = 1

		await widget.onkeydown(keyEvent("ArrowUp"), vnode)
		expect(vnode.state.highlightedOption).toBe(0)

		await widget.onkeydown(keyEvent("ArrowUp"), vnode)
		expect(vnode.state.highlightedOption).toBe(0)
	})

	test("Enter selects the highlighted actor", async () => {
		const onselect = vi.fn()
		const vnode = makeVnode({ onselect })
		widget.oninit(vnode)
		vnode.state.actors = [new Actor(ALICE), new Actor(BOB)]
		vnode.state.highlightedOption = 1

		await widget.onkeydown(keyEvent("Enter"), vnode)

		expect(vnode.attrs.value.map((a: Actor) => a.id())).toEqual([BOB.id])
	})
})
