import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { shownPage } = await import("./shown-people.ts")
const { DEPARTMENT_SHOWS } = await import("./rows.ts")

const row = (id: number, group: string, roles: string[] = ["Job"]) => ({
	id,
	name: `P${id}`,
	profilePath: null,
	roles,
	episodes: null,
	group,
})

const page = (rows: ReturnType<typeof row>[], nextOffset: number | null) => ({
	kind: "crew" as const,
	total: rows.length,
	matched: rows.length,
	groups: [],
	rows,
	offset: 0,
	nextOffset,
	showEpisodes: null,
})

test("crew keeps each department's first people, in the server's order", () => {
	const rows = [
		...Array.from({ length: 9 }, (_, i) => row(i, "Directing")),
		...Array.from({ length: 3 }, (_, i) => row(100 + i, "Sound")),
	]
	const cut = shownPage({ kind: "crew" }, page(rows, null), 24)
	const directing = cut.rows.filter((r) => r.group === "Directing")
	assert.equal(directing.length, DEPARTMENT_SHOWS)
	assert.deepEqual(
		directing.map((r) => r.id),
		[0, 1, 2, 3, 4, 5],
	)
	assert.equal(cut.rows.filter((r) => r.group === "Sound").length, 3)
	assert.equal(cut.nextOffset, null)
	assert.equal(cut.total, 12)
})

test("cast keeps the first rows, cuts long character lists, and continues after them", () => {
	const rows = Array.from({ length: 48 }, (_, i) =>
		row(
			i,
			"top",
			Array.from({ length: 10 }, (_, j) => `C${j}`),
		),
	)
	const cut = shownPage(
		{ kind: "cast" },
		{ ...page(rows, 48), kind: "cast" },
		24,
	)
	assert.equal(cut.rows.length, 24)
	assert.equal(cut.rows[0].roles.length, 6)
	assert.equal(cut.nextOffset, 24)
})

test("a short cast keeps its own next page", () => {
	const rows = Array.from({ length: 10 }, (_, i) => row(i, "top"))
	const cut = shownPage(
		{ kind: "cast" },
		{ ...page(rows, null), kind: "cast" },
		24,
	)
	assert.equal(cut.rows.length, 10)
	assert.equal(cut.nextOffset, null)
})

test("a search answer stays whole", () => {
	const rows = Array.from({ length: 9 }, (_, i) => row(i, "Writing"))
	const p = page(rows, null)
	assert.equal(shownPage({ kind: "crew", q: "creator" }, p, 24), p)
})
