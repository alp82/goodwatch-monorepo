import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"
import "../title-filter/test-alias.ts"
import type { TitleDisplay } from "../title-cards.server.ts"
import type { PoolCandidates } from "./pool-keys.server.ts"
import type { ChoiceArtSnapshot } from "./tv-choice-art.server.ts"

const { MOOD_KEYS } = await import("~/domain/moods")
const { STYLE_KEYS, THEME_KEYS } = await import("~/domain/themes-styles")
const { DISCOVER_TABS } = await import("~/ui/living-room/tv/tv-machine")
const { choiceArtKeys, loadChoiceArt, resetChoiceArtForTest } = await import(
	"./tv-choice-art.server.ts"
)

type Row = {
	key: number
	moods?: string[]
	themes?: string[]
	styles?: string[]
	backdrop?: boolean
}

const mask = (all: readonly string[], keys: string[] = []) =>
	keys.reduce((bits, key) => bits | (1 << all.indexOf(key)), 0)

/** A snapshot of these rows, and its candidates in the order given (most popular first). */
function fake(rows: Row[]) {
	const snapshot: ChoiceArtSnapshot = {
		rowOf: (key) => rows.findIndex((row) => row.key === key),
		factsAt: (row) => ({ hasBackdrop: rows[row].backdrop !== false }),
		columns: {
			moods: Uint32Array.from(rows, (row) => mask(MOOD_KEYS, row.moods)),
			themes: Uint16Array.from(rows, (row) => mask(THEME_KEYS, row.themes)),
			styles: Uint16Array.from(rows, (row) => mask(STYLE_KEYS, row.styles)),
		},
	}
	const candidates = {
		version: "v",
		today: 1,
		all: rows.map((row) => ({ key: row.key, popularity: 0, moods: [] })),
		byMood: new Map(),
	} as PoolCandidates
	return { snapshot, candidates }
}

const display = (key: number, backdrop: string | null = `/b${key}.jpg`) =>
	({ key, backdrop_path: backdrop }) as TitleDisplay
const fields =
	(calls: number[][] = [], missing: number[] = []) =>
	async (keys: number[]) => {
		calls.push(keys)
		return new Map(
			keys
				.filter((key) => !missing.includes(key))
				.map((key) => [key, display(key)]),
		)
	}

const ITEMS = DISCOVER_TABS.flatMap(({ kind, keys }) =>
	keys.map((key) => `${kind}:${key}`),
)

beforeEach(() => resetChoiceArtForTest())

test("every option of the TV's three tabs is a bit of the snapshot's masks", () => {
	const all = { mood: MOOD_KEYS, theme: THEME_KEYS, style: STYLE_KEYS }
	for (const { kind, keys } of DISCOVER_TABS)
		for (const key of keys)
			assert.ok(
				(all[kind] as readonly string[]).includes(key),
				`${kind}:${key}`,
			)
})

test("an option's title is the most popular candidate that has it", () => {
	const { snapshot, candidates } = fake([
		{ key: 1, themes: ["war"] },
		{ key: 2, moods: ["funny"] },
		{ key: 3, moods: ["funny"] },
		{ key: 4, themes: ["crime"] },
		{ key: 5, styles: ["slow"] },
	])
	assert.deepEqual(
		[...choiceArtKeys(snapshot, candidates)],
		[
			["mood:funny", 2],
			["theme:crime", 4],
			["style:slow", 5],
		],
	)
})

test("one title stands for one option: the next option takes the next title that has it", () => {
	const { snapshot, candidates } = fake([
		// Funny, an action title, fast-paced and a spectacle at once: it is the first of these still open.
		{ key: 1, moods: ["funny", "action"], styles: ["spectacle", "fast"] },
		{ key: 2, moods: ["funny", "action"], styles: ["spectacle", "fast"] },
		{ key: 3, moods: ["funny", "action"], styles: ["spectacle", "fast"] },
		{ key: 4, moods: ["funny", "action"], styles: ["spectacle", "fast"] },
		{ key: 5, moods: ["funny"] },
	])
	const found = choiceArtKeys(snapshot, candidates)
	assert.deepEqual(
		[...found].sort((a, b) => a[1] - b[1]),
		[
			["mood:funny", 1],
			["mood:action", 2],
			["style:spectacle", 3],
			["style:fast", 4],
		],
	)
	assert.equal(new Set(found.values()).size, found.size)
})

test("a title without a backdrop, and one the snapshot lacks, stand for nothing", () => {
	const { snapshot, candidates } = fake([
		{ key: 1, moods: ["scary"], backdrop: false },
		{ key: 2, moods: ["scary"] },
	])
	const gone = {
		...candidates,
		all: [{ key: 99, popularity: 0, moods: [] }, ...candidates.all],
	}
	assert.deepEqual([...choiceArtKeys(snapshot, gone)], [["mood:scary", 2]])
})

test("with enough candidates all eighteen options have a title, each another", () => {
	const rows: Row[] = DISCOVER_TABS.flatMap(({ kind, keys }, tab) =>
		keys.map((key, n) => ({ key: tab * 10 + n + 1, [`${kind}s`]: [key] })),
	)
	const { snapshot, candidates } = fake(rows)
	const found = choiceArtKeys(snapshot, candidates)
	assert.deepEqual([...found.keys()].sort(), [...ITEMS].sort())
	assert.equal(new Set(found.values()).size, 18)
})

test("the pool sends a backdrop's path per option, and nothing for an option without one", async () => {
	const { snapshot, candidates } = fake([
		{ key: 1, moods: ["funny"] },
		{ key: 2, themes: ["crime"] },
		{ key: 3, styles: ["slow"] },
	])
	// Title 2 has no display fields.
	const art = await loadChoiceArt(snapshot, candidates, fields([], [2]))
	assert.deepEqual(art, { "mood:funny": "/b1.jpg", "style:slow": "/b3.jpg" })
})

test("the pictures are worked out once per candidates: a second pool request reads nothing", async () => {
	const { snapshot, candidates } = fake([{ key: 1, moods: ["funny"] }])
	const calls: number[][] = []
	const first = await loadChoiceArt(snapshot, candidates, fields(calls))
	const second = await loadChoiceArt(snapshot, candidates, fields(calls))
	assert.equal(second, first)
	assert.deepEqual(calls, [[1]])
	// Another day or snapshot version has other candidates.
	const next = fake([{ key: 7, moods: ["funny"] }])
	const third = await loadChoiceArt(
		next.snapshot,
		next.candidates,
		fields(calls),
	)
	assert.deepEqual(third, { "mood:funny": "/b7.jpg" })
	assert.deepEqual(calls, [[1], [7]])
})

test("a failed read answers no pictures and is tried again", async () => {
	const { snapshot, candidates } = fake([{ key: 1, moods: ["funny"] }])
	const error = console.error
	console.error = () => {}
	try {
		assert.deepEqual(
			await loadChoiceArt(snapshot, candidates, async () => {
				throw new Error("Crate is away")
			}),
			{},
		)
	} finally {
		console.error = error
	}
	assert.deepEqual(await loadChoiceArt(snapshot, candidates, fields()), {
		"mood:funny": "/b1.jpg",
	})
})
