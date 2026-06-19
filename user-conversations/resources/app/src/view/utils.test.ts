// @vitest-environment jsdom
import { test, expect, describe, vi, afterEach } from 'vitest'
import { haltEvent, synthClick, keyCode, getFocusElements, isEmoji, formatFileSize } from "./utils"

afterEach(() => {
	vi.restoreAllMocks()
})

// fakeKeyEvent builds a minimal KeyboardEvent-like object for the pure helpers.
function fakeKeyEvent(props: Partial<KeyboardEvent>): KeyboardEvent {
	return {
		key: "", shiftKey: false, ctrlKey: false, metaKey: false,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
		...props,
	} as unknown as KeyboardEvent
}

// withUserAgent runs `fn` with navigator.userAgent stubbed to the given value, so
// keyCode's Mac/non-Mac branch can be exercised either way.
function withUserAgent(ua: string, fn: () => void) {
	const original = globalThis.navigator.userAgent
	Object.defineProperty(globalThis.navigator, "userAgent", { value: ua, configurable: true })
	try {
		fn()
	} finally {
		Object.defineProperty(globalThis.navigator, "userAgent", { value: original, configurable: true })
	}
}

describe("haltEvent", () => {

	test("prevents default and stops propagation", () => {
		const event = fakeKeyEvent({})
		haltEvent(event)
		expect(event.preventDefault).toHaveBeenCalled()
		expect(event.stopPropagation).toHaveBeenCalled()
	})
})

describe("synthClick", () => {

	test("dispatches a click on Enter", () => {
		const target = document.createElement("button")
		const onClick = vi.fn()
		target.addEventListener("click", onClick)

		synthClick(fakeKeyEvent({ key: "Enter", target }))
		expect(onClick).toHaveBeenCalled()
	})

	test("dispatches a click on Space", () => {
		const target = document.createElement("button")
		const onClick = vi.fn()
		target.addEventListener("click", onClick)

		synthClick(fakeKeyEvent({ key: " ", target }))
		expect(onClick).toHaveBeenCalled()
	})

	test("ignores other keys", () => {
		const target = document.createElement("button")
		const onClick = vi.fn()
		target.addEventListener("click", onClick)

		const event = fakeKeyEvent({ key: "a", target })
		synthClick(event)

		expect(onClick).not.toHaveBeenCalled()
		expect(event.preventDefault).not.toHaveBeenCalled()
	})
})

describe("keyCode", () => {

	test("returns the bare key with no modifiers", () => {
		expect(keyCode(fakeKeyEvent({ key: "a" }))).toBe("a")
	})

	test("adds Shift+ when shiftKey is set", () => {
		expect(keyCode(fakeKeyEvent({ key: "Tab", shiftKey: true }))).toBe("Shift+Tab")
	})

	test("on Mac, metaKey (Cmd) maps to Ctrl+", () => {
		withUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", () => {
			expect(keyCode(fakeKeyEvent({ key: "k", metaKey: true }))).toBe("Ctrl+k")
			// ctrlKey is ignored on Mac
			expect(keyCode(fakeKeyEvent({ key: "k", ctrlKey: true }))).toBe("k")
		})
	})

	test("off Mac, ctrlKey maps to Ctrl+", () => {
		withUserAgent("Mozilla/5.0 (Windows NT 10.0)", () => {
			expect(keyCode(fakeKeyEvent({ key: "k", ctrlKey: true }))).toBe("Ctrl+k")
			// metaKey is ignored off Mac
			expect(keyCode(fakeKeyEvent({ key: "k", metaKey: true }))).toBe("k")
		})
	})

	test("combines Ctrl+ and Shift+ in order", () => {
		withUserAgent("Mozilla/5.0 (Windows NT 10.0)", () => {
			expect(keyCode(fakeKeyEvent({ key: "z", ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+z")
		})
	})
})

describe("getFocusElements", () => {

	test("returns the first and last focusable elements", () => {
		const node = document.createElement("div")
		node.innerHTML = `
			<input tabindex="0" id="first" />
			<input tabindex="0" id="mid" />
			<input tabindex="0" id="last" />
		`
		const [first, last] = getFocusElements(node)
		expect(first?.id).toBe("first")
		expect(last?.id).toBe("last")
	})

	test("first and last are the same element when only one is focusable", () => {
		const node = document.createElement("div")
		node.innerHTML = `<input tabindex="0" id="only" />`
		const [first, last] = getFocusElements(node)
		expect(first?.id).toBe("only")
		expect(last?.id).toBe("only")
	})

	test("returns [undefined, undefined] when there are no focusable elements", () => {
		const node = document.createElement("div")
		node.innerHTML = `<span>no tabindex here</span>`
		expect(getFocusElements(node)).toEqual([undefined, undefined])
	})
})

describe("isEmoji", () => {

	test("returns true for a single emoji (multi-code-unit surrogate pair)", () => {
		// "😀".length === 2, so this only works with grapheme counting
		expect(isEmoji("😀")).toBe(true)
	})

	test("returns true for an emoji built from multiple code points", () => {
		// "❤️" is heart (U+2764) + variation selector (U+FE0F): two code points,
		// one grapheme
		expect(isEmoji("❤️")).toBe(true)
		expect(isEmoji("👍")).toBe(true)
	})

	test("returns true for a short string of emoji (up to 6)", () => {
		expect(isEmoji("😀😀")).toBe(true)
		expect(isEmoji("👍❤️😀")).toBe(true)
		expect(isEmoji("😀😀😀😀😀😀")).toBe(true) // exactly 6
	})

	test("ignores whitespace between emoji", () => {
		expect(isEmoji("👍 ❤️")).toBe(true)
		expect(isEmoji("  😀  ")).toBe(true)
	})

	test("returns false for more than 6 emoji", () => {
		expect(isEmoji("😀😀😀😀😀😀😀")).toBe(false) // 7
	})

	test("returns false when any non-emoji character is present", () => {
		expect(isEmoji("a")).toBe(false)
		expect(isEmoji("hello")).toBe(false)
		expect(isEmoji("😀!")).toBe(false)
		expect(isEmoji("😀 hi 😀")).toBe(false)
	})

	test("returns false for an empty or whitespace-only string", () => {
		expect(isEmoji("")).toBe(false)
		expect(isEmoji("   ")).toBe(false)
	})
})

describe("formatFileSize", () => {

	test("returns '0 Bytes' for zero", () => {
		expect(formatFileSize(0)).toBe("0 Bytes")
	})

	test("formats bytes", () => {
		expect(formatFileSize(512)).toBe("512 Bytes")
	})

	test("formats kilobytes", () => {
		expect(formatFileSize(2048)).toBe("2 KB")
	})

	test("formats megabytes", () => {
		expect(formatFileSize(5 * 1024 * 1024)).toBe("5 MB")
	})

	test("formats gigabytes", () => {
		expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe("3 GB")
	})
})
