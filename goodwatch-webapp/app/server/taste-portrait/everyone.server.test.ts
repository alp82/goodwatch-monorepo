import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

// As in sides.server.test.ts: the taste module's index and the availability index pull in what names don't need.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: unknown,
			next: (s: string, c: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	resolve: (specifier, context, next) =>
		specifier === "~/server/availability-index.server"
			? {
					url: "data:text/javascript,export const isOnServices = () => null",
					shortCircuit: true,
				}
			: next(
					specifier === "~/server/taste/index.server"
						? "~/server/taste/taste.server"
						: specifier,
					context,
				),
})

const { buildEveryone } = await import("./everyone.server")
const { KEYS } = await import("./person.server")
const { foldGenres } = await import("../../domain/genre-fold")
import type { Person, RatedTitle } from "./person.server"

function title(
	mediaType: "movie" | "show",
	gap: number,
	genres: string[],
	traits: string[] = [],
	overrides: Partial<RatedTitle["facts"]> = {},
): RatedTitle {
	return {
		key: 0,
		score: 8,
		z: Float64Array.from(KEYS, (key) => (traits.includes(key) ? 2 : 0)),
		fingerprint: new Uint8Array(KEYS.length),
		facts: {
			mediaType,
			tmdbId: 1,
			genres,
			score: 80 - gap,
			votes: 5000,
			releaseDay: null,
			popularity: 1,
			origin: "US",
			hasPoster: true,
			hasBackdrop: false,
			adult: false,
			anime: false,
			moods: [],
			...overrides,
		},
	}
}

function build(rated: RatedTitle[]) {
	const rows = rated.map((r, key) => ({ ...r, key }))
	return buildEveryone({
		rated: rows,
		ratedByKey: new Map(rows.map((r) => [r.key, r])),
	} as Person)
}

const repeat = (n: number, make: () => RatedTitle) =>
	Array.from({ length: n }, make)

test("folds TV pairs, drops TV-only genres and deduplicates each title", () => {
	assert.deepEqual(
		foldGenres([
			"Sci-Fi & Fantasy",
			"Fantasy",
			"Science Fiction",
			"Action & Adventure",
			"Action",
			"War & Politics",
			"Kids",
			"Soap",
			"News",
			"Reality",
			"Talk",
			"Drama",
		]),
		["Science Fiction", "Fantasy", "Action", "Adventure", "War", "Drama"],
	)
})

test("removes separate movie and show biases from titles, genres and traits", () => {
	const view = build([
		...repeat(4, () => title("movie", 2, ["Science Fiction"], ["wonder"])),
		...repeat(8, () => title("show", -7, ["Sci-Fi & Fantasy"], ["tension"])),
		...repeat(4, () => title("show", 40, ["Drama"], [], { votes: 999 })),
	])
	assert.equal(view.status, "ready")
	assert.equal(view.counted, 12)
	assert.equal(view.offset, -4)
	assert.deepEqual(view.higher, [])
	assert.deepEqual(view.lower, [])
	assert.deepEqual(view.attributes, [])
	assert.deepEqual(view.genres, [])
	assert.deepEqual(view.gapGroups, { genres: [], traits: [] })
})

test("aggregates folded genres once per title and balances display groups", () => {
	const view = build([
		...repeat(4, () =>
			title(
				"movie",
				12,
				["Science Fiction", "Fantasy"],
				["wonder", "tension", "crime"],
			),
		),
		...repeat(4, () => title("movie", -8, ["Drama"])),
		...repeat(4, () =>
			title(
				"show",
				3,
				["Sci-Fi & Fantasy", "Fantasy"],
				["wonder", "tension", "crime"],
			),
		),
		...repeat(4, () => title("show", -17, ["Drama"])),
	])
	assert.deepEqual(
		view.genres.map(({ id, delta, count }) => ({ id, delta, count })),
		[
			{ id: "Fantasy", delta: 10, count: 8 },
			{ id: "Science Fiction", delta: 10, count: 8 },
			{ id: "Drama", delta: -10, count: 8 },
		],
	)
	assert.equal(view.attributes.length, 3)
	assert.ok(view.attributes.every((g) => g.delta === 10 && g.count === 8))
	assert.equal(view.gapGroups.genres.length, view.gapGroups.traits.length)
	assert.equal(view.higher.length, 8)
	assert.equal(view.lower.length, 8)
	assert.ok(view.higher.every((r) => r.delta === 10))
	assert.ok(view.lower.every((r) => r.delta === -10))
})

test("keeps legacy lists when the display groups have unequal candidates", () => {
	const view = build([
		...repeat(4, () =>
			title("movie", 12, ["Action", "Adventure", "Fantasy"], ["wonder"]),
		),
		...repeat(4, () => title("movie", -8, ["Drama"])),
	])
	assert.equal(view.genres.length, 4)
	assert.equal(view.attributes.length, 1)
	assert.equal(view.gapGroups.genres.length, 1)
	assert.equal(view.gapGroups.traits.length, 1)
})

test("handles movie-only, show-only, and insufficient ratings", () => {
	for (const kind of ["movie", "show"] as const) {
		const view = build(repeat(4, () => title(kind, -7, ["Drama"])))
		assert.equal(view.status, "ready")
		assert.deepEqual(view.higher, [])
		assert.deepEqual(view.lower, [])
	}
	const view = build(repeat(3, () => title("show", 2, ["Drama"])))
	assert.equal(view.status, "empty")
	assert.deepEqual(view.gapGroups, { genres: [], traits: [] })
})

test("with no trait gaps, the genre gaps still show", () => {
	const view = build([
		...repeat(4, () => title("movie", 12, ["Drama"])),
		...repeat(4, () => title("movie", -8, ["Comedy"])),
	])
	assert.deepEqual(
		view.gapGroups.genres.map(({ id, delta }) => ({ id, delta })),
		[
			{ id: "Drama", delta: 10 },
			{ id: "Comedy", delta: -10 },
		],
	)
	assert.deepEqual(view.gapGroups.traits, [])
})
