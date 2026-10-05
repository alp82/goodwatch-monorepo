import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type { MoodKey } from "~/domain/moods"
import type {
	TitleFacts,
	TitleSnapshot,
} from "../title-snapshot/snapshot.server.ts"
import type { PoolCandidates } from "./pool-keys.server.ts"

const { MOOD_KEYS } = await import("~/domain/moods")
const {
	BEST,
	PER_MOOD,
	poolCandidates,
	selectPoolKeys,
	resetPoolCandidatesForTest,
} = await import("./pool-keys.server.ts")

const TODAY = 20_000
const anonymous = () => ({
	seen: new Set<number>(),
	skipped: new Set<number>(),
	wishlist: new Set<number>(),
})

function fakeSnapshot(version = "first", offset = 0) {
	let seed = 123456789
	const random = (limit: number) => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
		return Math.floor((seed / 2 ** 32) * limit)
	}
	const rows = Array.from({ length: 4000 }, (_, row) => {
		const key = offset + row * 3 + 1
		const facts: TitleFacts = {
			mediaType: "movie",
			tmdbId: key,
			genres: [],
			adult: random(10) === 0,
			hasPoster: random(10) !== 0,
			hasBackdrop: true,
			releaseDay: random(5) === 0 ? null : TODAY + random(7) - 5,
			score: random(10) === 0 ? null : 60 + random(41),
			votes: random(5) * 1000,
			popularity: random(20),
			moods: MOOD_KEYS.filter(() => random(4) === 0),
			origin: null,
			anime: false,
		}
		return { key, facts }
	})
	const tomorrow = rows[0]
	Object.assign(tomorrow.facts, {
		adult: false,
		hasPoster: true,
		releaseDay: TODAY + 1,
		score: 70,
		votes: 1000,
		popularity: 100,
		moods: [...MOOD_KEYS],
	})
	const factsByKey = new Map(rows.map(({ key, facts }) => [key, facts]))
	let walks = 0
	const snapshot = {
		version,
		forEach(fn: (key: number, row: number) => void) {
			walks++
			rows.forEach(({ key }, row) => fn(key, row))
		},
		factsAt: (row: number) => rows[row].facts,
		facts: (key: number) => factsByKey.get(key) ?? null,
	} satisfies Pick<TitleSnapshot, "version" | "forEach" | "factsAt" | "facts">
	return { snapshot, walks: () => walks, tomorrow: tomorrow.key }
}

// The old request algorithm is the reference for both selection paths.
function reference(
	snapshot: Pick<TitleSnapshot, "forEach" | "facts">,
	today: number,
	ctx: ReturnType<typeof anonymous>,
	rankOf: ((key: number) => number) | null,
) {
	// The best few for any mood, then a few per mood, without repeats.
	const keys: number[] = []
	const byMood = new Map<MoodKey, number[]>()
	const add = (list: number[]) => {
		for (const k of list) if (!keys.includes(k)) keys.push(k)
	}
	const ranked: {
		key: number
		rank: number
		popularity: number
		moods: MoodKey[]
	}[] = []
	snapshot.forEach((key) => {
		if (ctx.seen.has(key) || ctx.skipped.has(key) || ctx.wishlist.has(key))
			return
		const facts = snapshot.facts(key)
		if (
			!facts ||
			facts.adult ||
			!facts.hasPoster ||
			(facts.releaseDay !== null && facts.releaseDay > today) ||
			(facts.score ?? 0) < 70 ||
			facts.votes < 1000
		)
			return
		ranked.push({
			key,
			rank: rankOf ? rankOf(key) : facts.popularity,
			popularity: facts.popularity,
			moods: facts.moods,
		})
	})
	ranked.sort(
		(a, b) => b.rank - a.rank || b.popularity - a.popularity || a.key - b.key,
	)
	add(ranked.slice(0, BEST).map(({ key }) => key))
	for (const mood of MOOD_KEYS) {
		const list = ranked
			.filter((title) => title.moods.includes(mood))
			.slice(0, PER_MOOD + 2)
			.map(({ key }) => key)
		byMood.set(mood, list)
		add(list.slice(0, PER_MOOD))
	}

	return { keys, byMood }
}

function excludingTop(keys: number[]) {
	const viewer = anonymous()
	keys.forEach((key, i) => {
		const sets = [viewer.seen, viewer.skipped, viewer.wishlist]
		sets[i % sets.length].add(key)
	})
	return viewer
}

const tasteRank = (key: number) => (key * 17) % 13

for (const rankOf of [null, tasteRank]) {
	for (const exclusions of [false, true]) {
		test(`matches the old ${rankOf ? "taste" : "popularity"} order ${exclusions ? "with" : "without"} exclusions`, () => {
			resetPoolCandidatesForTest()
			const { snapshot } = fakeSnapshot()
			const top = reference(snapshot, TODAY, anonymous(), rankOf)
			const viewer = exclusions ? excludingTop(top.keys) : anonymous()
			assert.deepEqual(
				selectPoolKeys(poolCandidates(snapshot, TODAY), viewer, rankOf),
				reference(snapshot, TODAY, viewer, rankOf),
			)
		})
	}
}

const jsonCopy = (candidates: PoolCandidates) =>
	JSON.parse(JSON.stringify({ ...candidates, byMood: [...candidates.byMood] }))

test("viewer exclusions and taste never change the shared candidates", () => {
	resetPoolCandidatesForTest()
	const { snapshot } = fakeSnapshot()
	const candidates = poolCandidates(snapshot, TODAY)
	const before = jsonCopy(candidates)
	const first = selectPoolKeys(candidates, anonymous(), null)
	const viewer = excludingTop(first.keys)
	const excluded = new Set([
		...viewer.seen,
		...viewer.skipped,
		...viewer.wishlist,
	])
	const member = selectPoolKeys(candidates, viewer, null)
	assert.notDeepEqual(member.keys, first.keys)
	for (const rankOf of [null, tasteRank]) {
		const result = selectPoolKeys(candidates, viewer, rankOf)
		for (const key of [...result.keys, ...[...result.byMood.values()].flat()])
			assert.ok(!excluded.has(key))
	}
	assert.deepEqual(selectPoolKeys(candidates, anonymous(), null), first)
	assert.deepEqual(jsonCopy(candidates), before)
	assert.strictEqual(poolCandidates(snapshot, TODAY), candidates)
})

test("candidates are walked once per version and UTC day", () => {
	resetPoolCandidatesForTest()
	const first = fakeSnapshot()
	const candidates = poolCandidates(first.snapshot, TODAY)
	assert.strictEqual(poolCandidates(first.snapshot, TODAY), candidates)
	assert.equal(first.walks(), 1)
	const original = selectPoolKeys(candidates, anonymous(), null)
	assert.ok(!original.keys.includes(first.tomorrow))

	const second = fakeSnapshot("second", 100_000)
	const replaced = poolCandidates(second.snapshot, TODAY)
	assert.notStrictEqual(replaced, candidates)
	assert.equal(second.walks(), 1)
	assert.notDeepEqual(
		selectPoolKeys(replaced, anonymous(), null).keys,
		original.keys,
	)
	assert.strictEqual(poolCandidates(second.snapshot, TODAY), replaced)
	assert.equal(second.walks(), 1)

	const nextDay = poolCandidates(second.snapshot, TODAY + 1)
	assert.notStrictEqual(nextDay, replaced)
	assert.equal(second.walks(), 2)
	assert.ok(
		selectPoolKeys(nextDay, anonymous(), null).keys.includes(second.tomorrow),
	)
	assert.strictEqual(poolCandidates(second.snapshot, TODAY + 1), nextDay)
	assert.equal(second.walks(), 2)
})
