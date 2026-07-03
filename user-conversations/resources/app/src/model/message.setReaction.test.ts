import { test, expect } from 'vitest'
import { Message } from "./message"

// setReaction takes an attacker-controlled reaction string (from an inbound "Like"). These tests
// cover normal reactions plus the prototype-key guard that prevents "__proto__" / "constructor" /
// "prototype" from throwing or polluting the prototype chain.

test("records a normal reaction for an actor", () => {
	const m = new Message()
	expect(m.setReaction("https://alice.example/@alice", "❤️")).toBe(true)
	expect(m.reactions["❤️"]).toEqual(["https://alice.example/@alice"])
})

test("__proto__ as a reaction is rejected (no throw, no pollution)", () => {
	const m = new Message()
	expect(m.setReaction("https://evil.example/@m", "__proto__")).toBe(false)
	expect(Object.hasOwn(m.reactions, "__proto__")).toBe(false)
	// The Object prototype was not touched.
	expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined()
})

test("constructor and prototype as reactions are rejected", () => {
	const m = new Message()
	expect(m.setReaction("https://evil.example/@m", "constructor")).toBe(false)
	expect(m.setReaction("https://evil.example/@m", "prototype")).toBe(false)
})

test("a benign reaction still works after a rejected prototype key", () => {
	const m = new Message()
	m.setReaction("https://evil.example/@m", "__proto__") // rejected
	expect(m.setReaction("https://bob.example/@bob", "👍")).toBe(true)
	expect(m.reactions["👍"]).toEqual(["https://bob.example/@bob"])
})
