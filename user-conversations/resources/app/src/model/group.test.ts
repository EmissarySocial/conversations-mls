import { test, expect, describe } from 'vitest'
import { NewGroup, filterAndSortGroups, type Group } from "./group"

// makeGroup builds a Group fixture with just the fields filterAndSortGroups reads.
function makeGroup(id: string, overrides: Partial<Group> = {}): Group {
	const group = NewGroup("PLAINTEXT")
	group.id = id
	group.stateId = overrides.stateId ?? "ACTIVE"
	group.tags = overrides.tags ?? []
	group.updateDate = overrides.updateDate ?? 0
	return group
}

const ids = (groups: Group[]) => groups.map(g => g.id)

describe("filterAndSortGroups — tag filter", () => {

	test("keeps only groups that include EVERY requested tag", () => {
		const groups = [
			makeGroup("a", { tags: ["news"] }),
			makeGroup("b", { tags: ["news", "sports"] }),
			makeGroup("c", { tags: ["sports"] }),
		]
		expect(ids(filterAndSortGroups(groups, ["news", "sports"]))).toEqual(["b"])
	})

	test("empty tags list does not filter on tags", () => {
		const groups = [makeGroup("a", { tags: [] }), makeGroup("b", { tags: ["x"] })]
		expect(ids(filterAndSortGroups(groups, [])).sort((x, y) => x.localeCompare(y))).toEqual(["a", "b"])
	})
})

describe("filterAndSortGroups — state filter", () => {

	test("keeps only groups whose state is in the requested list", () => {
		const groups = [
			makeGroup("a", { stateId: "ACTIVE" }),
			makeGroup("b", { stateId: "ARCHIVED" }),
		]
		expect(ids(filterAndSortGroups(groups, [], ["ACTIVE"]))).toEqual(["a"])
	})

	test("empty stateIds list does not filter on state", () => {
		const groups = [
			makeGroup("a", { stateId: "ACTIVE" }),
			makeGroup("b", { stateId: "ARCHIVED" }),
			makeGroup("c", { stateId: "CLOSED" }),
		]
		expect(ids(filterAndSortGroups(groups, [], [])).sort((x, y) => x.localeCompare(y))).toEqual(["a", "b", "c"])
	})
})

describe("filterAndSortGroups — WELCOME is always included when filtering by state", () => {

	test("a WELCOME group surfaces even when not in the requested states", () => {
		const groups = [
			makeGroup("active", { stateId: "ACTIVE" }),
			makeGroup("welcome", { stateId: "WELCOME" }),
			makeGroup("archived", { stateId: "ARCHIVED" }),
		]
		// Filtering for ACTIVE only — WELCOME must still come through, ARCHIVED must not
		const result = ids(filterAndSortGroups(groups, [], ["ACTIVE"]))
		expect(result).toContain("active")
		expect(result).toContain("welcome")
		expect(result).not.toContain("archived")
	})

	test("WELCOME still respects the tag filter (it is not unconditionally added)", () => {
		const groups = [
			makeGroup("welcome-tagged", { stateId: "WELCOME", tags: ["team"] }),
			makeGroup("welcome-untagged", { stateId: "WELCOME", tags: [] }),
		]
		// Tag "team" + state ACTIVE: the untagged WELCOME group must be excluded by the
		// tag filter, proving WELCOME inclusion is a state rule, not a bypass-everything.
		const result = ids(filterAndSortGroups(groups, ["team"], ["ACTIVE"]))
		expect(result).toEqual(["welcome-tagged"])
	})
})

describe("filterAndSortGroups — sort order", () => {

	test("IMPORTANT groups come first, regardless of updateDate", () => {
		const groups = [
			makeGroup("active-new", { stateId: "ACTIVE", updateDate: 100 }),
			makeGroup("important-old", { stateId: "IMPORTANT", updateDate: 1 }),
		]
		expect(ids(filterAndSortGroups(groups, []))).toEqual(["important-old", "active-new"])
	})

	test("within a tier, more recently updated groups come first", () => {
		const groups = [
			makeGroup("old", { stateId: "ACTIVE", updateDate: 1 }),
			makeGroup("new", { stateId: "ACTIVE", updateDate: 100 }),
			makeGroup("mid", { stateId: "ACTIVE", updateDate: 50 }),
		]
		expect(ids(filterAndSortGroups(groups, []))).toEqual(["new", "mid", "old"])
	})

	test("IMPORTANT tier is itself ordered by updateDate descending", () => {
		const groups = [
			makeGroup("imp-old", { stateId: "IMPORTANT", updateDate: 1 }),
			makeGroup("imp-new", { stateId: "IMPORTANT", updateDate: 100 }),
			makeGroup("active", { stateId: "ACTIVE", updateDate: 999 }),
		]
		expect(ids(filterAndSortGroups(groups, []))).toEqual(["imp-new", "imp-old", "active"])
	})
})

describe("filterAndSortGroups — combined", () => {

	test("applies tag + state filter and sort together", () => {
		const groups = [
			makeGroup("a", { stateId: "IMPORTANT", tags: ["work"], updateDate: 10 }),
			makeGroup("b", { stateId: "ACTIVE", tags: ["work"], updateDate: 20 }),
			makeGroup("c", { stateId: "ARCHIVED", tags: ["work"], updateDate: 30 }), // wrong state
			makeGroup("d", { stateId: "ACTIVE", tags: ["home"], updateDate: 40 }),   // wrong tag
		]
		// tags=[work] + states=[ACTIVE]: a is IMPORTANT (not ACTIVE/WELCOME) → excluded;
		// b qualifies; c is ARCHIVED (wrong state); d has the wrong tag.
		expect(ids(filterAndSortGroups(groups, ["work"], ["ACTIVE"]))).toEqual(["b"])
	})

	test("returns an empty array when nothing matches", () => {
		const groups = [makeGroup("a", { stateId: "ARCHIVED", tags: [] })]
		expect(filterAndSortGroups(groups, ["nope"], ["ACTIVE"])).toEqual([])
	})

	test("does not mutate the input array", () => {
		const groups = [
			makeGroup("x", { stateId: "ACTIVE", updateDate: 1 }),
			makeGroup("y", { stateId: "IMPORTANT", updateDate: 2 }),
		]
		const before = ids(groups)
		filterAndSortGroups(groups, [])
		expect(ids(groups)).toEqual(before)
	})
})
