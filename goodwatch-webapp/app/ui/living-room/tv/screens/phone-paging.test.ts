import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { fitCount, listArrows, pageAt } from "./phone-paging.ts"

describe("listArrows", () => {
	const items = ["title:a", "browse:prev", "browse:next"]
	it("pages within the titles the server sent", () => {
		assert.deepEqual(
			listArrows({ prev: "jump:title:a", next: "jump:title:f" }, items),
			{
				prev: "jump:title:a",
				next: "jump:title:f",
			},
		)
	})
	it("at either end of them asks the server for its page before or after", () => {
		assert.deepEqual(listArrows({ prev: null, next: null }, items), {
			prev: "browse:prev",
			next: "browse:next",
		})
	})
	it("has no arrow where the server has no such page", () => {
		assert.deepEqual(listArrows({ prev: null, next: null }, ["title:a"]), {
			prev: null,
			next: null,
		})
	})
})

describe("a phone list's page (2026-10-22): it follows the item that set it, and comes back with it", () => {
	const ids = Array.from({ length: 10 }, (_, i) => `pick:${i}`)
	it("shows the page of the item, with arrows to the pages beside it", () => {
		assert.deepEqual(pageAt(ids, 5, "pick:7"), {
			page: 1,
			pages: 2,
			shown: ["pick:5", "pick:6", "pick:7", "pick:8", "pick:9"],
			prev: "jump:pick:4",
			next: null,
		})
		assert.deepEqual(pageAt(ids, 5, "pick:2").shown, ids.slice(0, 5))
	})
	it("starts on the first page without an item, or with one the list doesn't have", () => {
		assert.equal(pageAt(ids, 5, null).page, 0)
		assert.equal(pageAt(ids, 5, "pick:42").page, 0)
		assert.equal(pageAt([], 5, null).pages, 1)
	})
	it("Back from Details: the focus on Details, the address's pick 7, so page 2 (the Spec case)", () => {
		// usePage's rule: the focus is not in the list and nothing set the page on this mount, so the anchor does.
		assert.deepEqual(pageAt(ids, 5, "pick:7").shown.includes("pick:7"), true)
	})
})

describe("how many of a phone row show: the upright count, more on a phone's wide canvas", () => {
	it("keeps the upright phone exactly as it was", () => {
		for (const [base, step, most] of [
			[5, 60, 8],
			[4, 50, 7],
			[3, 104, 5],
			[5, 56, 8],
		] as const)
			assert.equal(fitCount(480, base, step, most), base)
	})
	it("adds one per step of extra width, up to the most", () => {
		assert.equal(fitCount(773, 5, 60, 8), 8)
		assert.equal(fitCount(639, 5, 60, 8), 7)
		assert.equal(fitCount(773, 3, 104, 5), 5)
		assert.equal(fitCount(540, 3, 104, 5), 3)
	})
})
