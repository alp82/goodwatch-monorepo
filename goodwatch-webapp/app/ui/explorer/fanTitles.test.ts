import assert from "node:assert/strict"
import { test } from "node:test"
import type { ExplorerTitle } from "../../domain/explorer.ts"
import { fanTitles } from "./fanTitles.ts"

const title = (id: number, seen = false) =>
	({ key: id, seen }) as unknown as ExplorerTitle
const notSeenYet = (t: ExplorerTitle) => !t.seen

test("the fan shows the island's top six titles", () => {
	const top = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => title(id))
	const ids = fanTitles({ top, titles: [] }, () => true).map((t) => t.key)
	assert.deepEqual(ids, [1, 2, 3, 4, 5, 6])
})

test("with Not seen yet on, a title marked Seen leaves the fan as it leaves the island", () => {
	const top = [
		title(1),
		title(2, true),
		title(3),
		title(4),
		title(5),
		title(6),
		title(7),
	]
	const ids = fanTitles({ top, titles: [] }, notSeenYet).map((t) => t.key)
	assert.deepEqual(ids, [1, 3, 4, 5, 6, 7])
})

test("without top titles the fan uses the island's titles, filtered the same way", () => {
	const titles = [title(9, true), title(10)]
	const ids = fanTitles({ top: [], titles }, notSeenYet).map((t) => t.key)
	assert.deepEqual(ids, [10])
})
