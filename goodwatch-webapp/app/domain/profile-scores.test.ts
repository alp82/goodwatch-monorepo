import assert from "node:assert/strict"
import { test } from "node:test"
import type { ProfileTitle } from "./profile.ts"
import {
	SCORES_PAGE_SIZE,
	scoresChoiceOf,
	scoresPage,
	scoresParams,
} from "./profile-scores.ts"

const choice = scoresChoiceOf(new URLSearchParams())
// Exact live distribution: the old 120-per-tier cap returned 593 of these 1,010 ratings.
const titles: ProfileTitle[] = [
	0, 2, 10, 28, 58, 194, 313, 269, 121, 15,
].flatMap((n, i) =>
	Array.from({ length: n }, (_, j) => {
		const id = (i + 1) * 1000 + j
		const mediaType = j % 5 === 0 ? "show" : "movie"
		return {
			key: `${mediaType}-${id}`,
			mediaType,
			tmdbId: id,
			title: `Title ${id}`,
			year: 2020,
			poster: null,
			backdrop: null,
			href: `/${mediaType}/${id}`,
			score: i + 1,
			gw: j % 101,
			date: "2026-10-26T00:00:00Z",
		}
	}),
)

test("all 1,010 ratings are reachable exactly once, with full counts and a bounded first response", () => {
	const first = scoresPage(titles)
	assert.equal(first.counts.all, 1010)
	assert.equal(first.counts.movie + first.counts.show, 1010)
	assert.equal(
		first.tiers.reduce((n, t) => n + t.total, 0),
		1010,
	)
	assert.ok(first.tiers.every((t) => t.titles.length <= SCORES_PAGE_SIZE))
	assert.ok(first.tiers.reduce((n, t) => n + t.titles.length, 0) < 200)
	const keys: string[] = []
	for (const tier of first.tiers) {
		let current = tier
		for (;;) {
			keys.push(...current.titles.map((t) => t.key))
			if (current.next === null) break
			const batch = scoresPage(titles, choice, null, {
				tier: tier.score,
				offset: current.next,
			})
			assert.equal(batch.tiers.length, 1)
			current = batch.tiers[0]
		}
	}
	assert.equal(keys.length, 1010)
	assert.equal(new Set(keys).size, 1010)
	assert.deepEqual([...keys].sort(), titles.map((t) => t.key).sort())
})

test("all kinds and sorts apply before pagination; equal sort values have stable ordering", () => {
	for (const kind of ["all", "movie", "show"] as const)
		for (const sort of ["recent", "gw", "title"] as const) {
			const selected = { kind, sort, both: false }
			const first = scoresPage([...titles].reverse(), selected)
			for (const tier of first.tiers) {
				const expected = titles
					.filter(
						(t) =>
							t.score === tier.score &&
							(kind === "all" || t.mediaType === kind),
					)
					.sort(
						(a, b) =>
							(sort === "title"
								? a.title.localeCompare(b.title)
								: sort === "gw"
									? (b.gw ?? -1) - (a.gw ?? -1)
									: 0) || a.key.localeCompare(b.key),
					)
				assert.equal(tier.total, expected.length)
				const actual = [...tier.titles]
				let next = tier.next
				while (next !== null) {
					const batch = scoresPage([...titles].reverse(), selected, null, {
						tier: tier.score,
						offset: next,
					}).tiers[0]
					actual.push(...batch.titles)
					next = batch.next
				}
				assert.deepEqual(
					actual.map((t) => t.key),
					expected.map((t) => t.key),
				)
			}
		}
})

test("comparison and its counts use the complete library, and cannot be enabled without a member", () => {
	const shared = titles.filter((_, i) => i % 3 === 0)
	const you = Object.fromEntries(shared.map((t) => [t.key, t.score!]))
	const page = scoresPage(titles, { ...choice, both: true }, you)
	assert.equal(page.counts.all, shared.length)
	assert.deepEqual(page.shared, { count: shared.length, agree: shared.length })
	assert.equal(
		page.tiers.reduce((n, t) => n + t.total, 0),
		shared.length,
	)
	assert.ok(page.tiers.every((t) => t.titles.every((t) => you[t.key] != null)))
	assert.equal(scoresPage(titles, choice, you).shared?.count, shared.length)
	assert.equal(scoresPage(titles, { ...choice, both: true }).choice.both, false)
	assert.deepEqual(scoresPage([], choice).tiers, [])
})

test("URL choices round trip and invalid choices use defaults", () => {
	const selected = { kind: "show", sort: "gw", both: true } as const
	assert.deepEqual(scoresChoiceOf(scoresParams(selected)), selected)
	assert.deepEqual(
		scoresChoiceOf(new URLSearchParams("type=oops&sort=oops&both=true")),
		choice,
	)
})
