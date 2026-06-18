import { test, expect, describe } from 'vitest'
import { toArray, toArrayOfString, toBoolean, toInteger, toMap, toString } from "./convert"

describe("toArray", () => {
	test("returns [] for undefined", () => {
		expect(toArray(undefined)).toEqual([])
	})
	test("returns an array unchanged", () => {
		expect(toArray([1, 2, 3])).toEqual([1, 2, 3])
	})
	test("wraps a scalar in an array", () => {
		expect(toArray("x")).toEqual(["x"])
	})
	test("wraps a falsy non-undefined value (0) in an array", () => {
		expect(toArray(0)).toEqual([0])
	})
})

describe("toArrayOfString", () => {
	test("converts each element to a string", () => {
		expect(toArrayOfString([1, "two", true])).toEqual(["1", "two", "true"])
	})
	test("extracts ids from objects", () => {
		expect(toArrayOfString([{ id: "a" }, { id: "b" }])).toEqual(["a", "b"])
	})
	test("returns [] for undefined", () => {
		expect(toArrayOfString(undefined)).toEqual([])
	})
})

describe("toBoolean", () => {
	test("passes through booleans", () => {
		expect(toBoolean(true)).toBe(true)
		expect(toBoolean(false)).toBe(false)
	})
	test("parses 'true'/'TRUE' strings case-insensitively", () => {
		expect(toBoolean("true")).toBe(true)
		expect(toBoolean("TRUE")).toBe(true)
		expect(toBoolean("false")).toBe(false)
		expect(toBoolean("anything")).toBe(false)
	})
	test("treats nonzero numbers as true", () => {
		expect(toBoolean(1)).toBe(true)
		expect(toBoolean(-1)).toBe(true)
		expect(toBoolean(0)).toBe(false)
	})
	test("returns false for unsupported types", () => {
		expect(toBoolean(undefined)).toBe(false)
		expect(toBoolean({})).toBe(false)
		expect(toBoolean(null)).toBe(false)
	})
})

describe("toInteger", () => {
	test("floors numbers", () => {
		expect(toInteger(3.9)).toBe(3)
		expect(toInteger(5)).toBe(5)
	})
	test("parses numeric strings", () => {
		expect(toInteger("42")).toBe(42)
		expect(toInteger("42px")).toBe(42)
	})
	test("returns 0 for non-numeric strings", () => {
		expect(toInteger("abc")).toBe(0)
	})
	test("uses the first element of an array", () => {
		expect(toInteger([7, 8])).toBe(7)
		expect(toInteger([])).toBe(0)
	})
	test("reads the id property of an object", () => {
		expect(toInteger({ id: 9 })).toBe(9)
	})
	test("returns 0 for unsupported types", () => {
		expect(toInteger(undefined)).toBe(0)
		expect(toInteger(true)).toBe(0)
	})
	test("returns 0 for null (does not throw)", () => {
		expect(toInteger(null)).toBe(0)
	})
})

describe("toMap", () => {
	test("returns an object unchanged", () => {
		const obj = { a: 1 }
		expect(toMap(obj)).toBe(obj)
	})
	test("wraps a string as { id }", () => {
		expect(toMap("https://x.test/1")).toEqual({ id: "https://x.test/1" })
	})
	test("uses the first element of an array", () => {
		expect(toMap([{ a: 1 }, { a: 2 }])).toEqual({ a: 1 })
		expect(toMap([])).toEqual({})
	})
	test("returns {} for unsupported types", () => {
		expect(toMap(undefined)).toEqual({})
		expect(toMap(42)).toEqual({})
	})
	test("returns {} for null (does not return null)", () => {
		expect(toMap(null)).toEqual({})
	})
})

describe("toString", () => {
	test("passes through strings", () => {
		expect(toString("hello")).toBe("hello")
	})
	test("stringifies numbers and booleans", () => {
		expect(toString(42)).toBe("42")
		expect(toString(true)).toBe("true")
	})
	test("reads the id property of an object", () => {
		expect(toString({ id: "abc" })).toBe("abc")
	})
	test("returns '' for an object with no id", () => {
		expect(toString({ name: "x" })).toBe("")
	})
	test("uses the first element of an array", () => {
		expect(toString(["a", "b"])).toBe("a")
		expect(toString([])).toBe("")
	})
	test("returns '' for unsupported types", () => {
		expect(toString(undefined)).toBe("")
		expect(toString(null)).toBe("")
	})
})
