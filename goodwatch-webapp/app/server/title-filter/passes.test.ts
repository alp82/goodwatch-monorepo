import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import "./test-alias.ts"
import type { PassInput, RatingsFilter } from "./passes.server.ts"

const { ladderFor, ratingsFilter, runPasses } = await import(
	"./passes.server.ts"
)
const { loadRatings } = await import("../title-snapshot/ratings.server.ts")
const { byMatch, compareRows, sortToUse } = await import("./order.server.ts")
const { hiddenContentBits } = await import("~/domain/age-content")
const {
	SnapshotRefused,
	checkRatingsManifest,
	encodeRatings,
	joinRatingsChunks,
} = await import("../title-snapshot/format.server.ts")

const UNKNOWN_SCORE = 255
const MOVIE = 1e12

// Six movies, rows 0 to 5: GoodWatch score, votes, and the person's taste match (0 is none).
const SCORES = [90, 55, 75, UNKNOWN_SCORE, 75, 65]
const VOTES = [10, 20, 30, 40, 50, 60]
const MATCHES = [72, 95, 80, 99, 80, 0]
const columns = {
	pointIds: Float64Array.from(SCORES, (_, row) => MOVIE + row + 1),
	genres: new Uint32Array(SCORES.length),
	genreNames: [],
	releaseDays: new Int32Array(SCORES.length).fill(19000),
	votes: Uint32Array.from(VOTES),
	popularity: Float32Array.from(SCORES, (_, row) => 100 - row),
	scores: Uint8Array.from(SCORES),
	flags: new Uint8Array(SCORES.length),
	moods: new Uint16Array(SCORES.length),
	ratings: null,
}
const noTitles = {
	keys: new Set<number>(),
	rows: new Uint8Array(SCORES.length),
}

/** The universe in the given row order, with the matches unless the person has no taste. */
function passes(
	order: number[],
	filters: {
		minMatch?: number
		minScore?: number
		taste?: boolean
		ratings?: RatingsFilter
	},
) {
	const input: PassInput = {
		columns,
		rows: Int32Array.from(order),
		keys: Float64Array.from(order, (row) => columns.pointIds[row]),
		services: { kind: "column", kept: null, onMyServices: false },
		notSeen: null,
		seenOrSkipped: noTitles,
		type: "all",
		anime: "any",
		moods: 0,
		genres: 0,
		genresChosen: false,
		minScore: filters.minScore ?? 0,
		minMatch: filters.minMatch ?? 0,
		matches:
			filters.taste === false
				? null
				: Uint8Array.from(order, (row) => MATCHES[row]),
		released: null,
		releasedOptions: { any: null },
		similarTo: [],
		people: [],
		legacy: null,
		ratings: filters.ratings ?? null,
	}
	const out = runPasses(input)
	return { ...out, rows: Array.from(out.passing, (i) => order[i]) }
}

const plain = [0, 1, 2, 3, 4, 5]

test("the taste match filter keeps the titles at or above the threshold; a title without a match fails it", () => {
	assert.deepEqual(passes(plain, {}).rows, plain)
	assert.deepEqual(passes(plain, { minMatch: 70 }).rows, [0, 1, 2, 3, 4])
	assert.deepEqual(passes(plain, { minMatch: 80 }).rows, [1, 2, 3, 4])
	assert.deepEqual(passes(plain, { minMatch: 90 }).rows, [1, 3])
})

test("the taste match options count what each would leave, the other filters unchanged", () => {
	assert.deepEqual(passes(plain, { minMatch: 80 }).optionCounts.minMatch, {
		"0": 6,
		"70": 5,
		"80": 4,
		"90": 2,
	})
	// GoodWatch score of at least 70 leaves rows 0, 2, and 4.
	const both = passes(plain, { minMatch: 80, minScore: 70 })
	assert.deepEqual(both.rows, [2, 4])
	assert.deepEqual(both.optionCounts.minMatch, {
		"0": 3,
		"70": 3,
		"80": 2,
		"90": 0,
	})
	// And the score options count within the taste match filter.
	assert.deepEqual(both.optionCounts.minScore, {
		"0": 4,
		"60": 2,
		"70": 2,
		"80": 0,
	})
})

test("a recovery counts the titles only the taste match filter hides", () => {
	// Match 80 hides rows 0 and 5; score 70 hides rows 1, 3, and 5. Row 5 is hidden by both and counts in neither.
	const { recoveries } = passes(plain, { minMatch: 80, minScore: 70 })
	assert.deepEqual(recoveries, [
		{ filter: "minScore", titles: 2 },
		{ filter: "minMatch", titles: 1 },
	])
	assert.deepEqual(passes(plain, { minMatch: 90 }).recoveries, [
		{ filter: "minMatch", titles: 4 },
	])
})

test("without taste the taste match filter doesn't narrow", () => {
	const out = passes(plain, { minMatch: 90, taste: false })
	assert.deepEqual(out.rows, plain)
	assert.deepEqual(out.recoveries, [])
	assert.deepEqual(out.optionCounts.minMatch, {
		"0": 6,
		"70": 6,
		"80": 6,
		"90": 6,
	})
})

test("Best match orders by percentile, then GoodWatch score, then the tie-break; no match goes last", () => {
	const top = plain.slice().sort(compareRows(columns, "top"))
	assert.deepEqual(top, [0, 4, 2, 5, 1, 3])
	const { passing } = passes(top, {})
	// Per row: rows 2 and 4 are at the same percentile, row 5 has no match.
	const PERCENTILES = [45, 99.2, 61, 99.97, 61, -1]
	const percentiles = Float32Array.from(top, (row) => PERCENTILES[row])
	// The two at 61 have the same score: the one with more votes first.
	assert.deepEqual(
		Array.from(byMatch(passing, percentiles), (i) => top[i]),
		[3, 1, 4, 2, 0, 5],
	)
	// It ranks what passes: with a filter, only those.
	const filtered = passes(top, { minScore: 70 })
	assert.deepEqual(
		Array.from(byMatch(filtered.passing, percentiles), (i) => top[i]),
		[4, 2, 0],
	)
})

test("Best match orders titles that show the same match by their percentile", async () => {
	const { shownMatch } = await import("~/domain/taste-match")
	// Positions 0 to 5 in the Top rated order. All but the last show 90; the last has no match.
	const percentiles = Float32Array.from([99.0, 99.05, 98.95, 99.05, 99.1, -1])
	for (const percentile of percentiles.slice(0, 5))
		assert.equal(shownMatch(percentile, 100), 90)
	// Best fit first; the two at 99.05 keep the order they came in.
	assert.deepEqual(
		Array.from(byMatch(Int32Array.from([0, 1, 2, 3, 4, 5]), percentiles)),
		[4, 1, 3, 0, 2, 5],
	)
})

test("Best match falls back to the plain default without taste", () => {
	assert.equal(sortToUse("match", true, false), "match")
	assert.equal(sortToUse("match", true, true), "match")
	assert.equal(sortToUse("match", false, false), "popular")
	assert.equal(sortToUse("match", false, true), "relevance")
	assert.equal(sortToUse("relevance", true, false), "popular")
	assert.equal(sortToUse("relevance", false, true), "relevance")
	assert.equal(sortToUse("top", false, false), "top")
	assert.equal(sortToUse("newest", true, true), "newest")
})

// The same six movies for the age and content filter, as Germany rates them. Row 0 is FSK 6; row 1 is FSK 12 and
// violent; row 2 has no German rating, is estimated at 12, and is disturbing; row 3 is FSK 16, violent, and with sex; row 4
// is rated nowhere; row 5 has no German rating, is estimated at 16, and has drugs.
const NONE = 255
const VIOLENCE = 1
const SEX = 2
const DISTURBING = 4
const DRUGS = 16
const DE_AGES = [6, 12, NONE, 16, NONE, NONE]
const ESTIMATES = [6, 12, 12, 14, NONE, 16]
const CONTENT = [0, VIOLENCE, DISTURBING, VIOLENCE | SEX, 0, DRUGS]
const DE_STEPS = [0, 6, 12, 16, 18]

/** The ratings filter as the title filter resolves it for a state; `local` false is a country without a column. */
function rated(
	ageLimit: number | undefined,
	content: Parameters<typeof hiddenContentBits>[1] = undefined,
	local = true,
): RatingsFilter {
	return {
		content: Uint8Array.from(CONTENT),
		ages: local ? Uint8Array.from(DE_AGES) : null,
		estimates: Uint8Array.from(ESTIMATES),
		limit: ageLimit ?? -1,
		hidden: hiddenContentBits(ageLimit, content),
		steps: DE_STEPS.map((age) => ({
			age,
			hidden: hiddenContentBits(age, content),
		})),
		hiddenWhenOff: hiddenContentBits(undefined, content),
	}
}

test("the age limit passes a title by its rating in the country, else by its estimate; rated nowhere is hidden", () => {
	// Off: everything shows, the title rated nowhere too.
	assert.deepEqual(passes(plain, { ratings: rated(undefined) }).rows, plain)
	// Content shown, so only the ages decide. Row 3 goes by its German 16, not its estimate of 14.
	const ok = { violence: "show", sex: "show" } as const
	assert.deepEqual(passes(plain, { ratings: rated(12, ok) }).rows, [0, 1, 2])
	assert.deepEqual(passes(plain, { ratings: rated(16) }).rows, [0, 1, 2, 3, 5])
	assert.deepEqual(passes(plain, { ratings: rated(18) }).rows, [0, 1, 2, 3, 5])
	assert.deepEqual(passes(plain, { ratings: rated(0) }).rows, [])
	// The highest step still hides the title rated nowhere, and only the limit hides it.
	const input = { ratings: rated(18) }
	assert.deepEqual(passes(plain, input).recoveries, [
		{ filter: "ageLimit", titles: 1 },
	])
})

test("a country without a column goes by the estimate alone", () => {
	const ok = { violence: "show", sex: "show" } as const
	assert.deepEqual(
		passes(plain, { ratings: rated(12, ok, false) }).rows,
		[0, 1, 2],
	)
	// Row 3 is estimated at 14, below its German 16.
	assert.deepEqual(
		passes(plain, { ratings: rated(14, undefined, false) }).rows,
		[0, 1, 2, 3],
	)
})

test("content hides the kinds the limit sets and the person's overrides, with or without a limit", () => {
	// Up to 12 hides violence and sex by default: row 1 goes.
	assert.deepEqual(passes(plain, { ratings: rated(12) }).rows, [0, 2])
	// Up to 6 hides every kind; nothing at or below 6 has any.
	assert.deepEqual(passes(plain, { ratings: rated(6) }).rows, [0])
	// The overrides apply on top: disturbing hidden, violence OK.
	const mine = { violence: "show", disturbing: "hide" } as const
	assert.deepEqual(passes(plain, { ratings: rated(12, mine) }).rows, [0, 1])
	assert.deepEqual(
		passes(plain, { ratings: rated(16, mine) }).rows,
		[0, 1, 3, 5],
	)
	// Without a limit content still hides, and a title rated nowhere shows.
	assert.deepEqual(
		passes(plain, { ratings: rated(undefined, { violence: "hide" }) }).rows,
		[0, 2, 4, 5],
	)
	// Violence and disturbing hidden up to 12: rows 1 and 2 are hidden by content alone, rows 4 and 5 by the limit alone,
	// and row 3 by both, so it counts in neither.
	assert.deepEqual(
		passes(plain, { ratings: rated(12, { sex: "show", disturbing: "hide" }) })
			.recoveries,
		[
			{ filter: "ageLimit", titles: 2 },
			{ filter: "content", titles: 2 },
		],
	)
})

test("the age limit's options count what each step would leave with the content it brings", () => {
	const { optionCounts } = passes(plain, { ratings: rated(12) })
	// Off shows all six. Up to 12 leaves rows 0 and 2 (row 1 is violent); up to 16 and 18 hide no content.
	assert.deepEqual(optionCounts.ageLimit, {
		off: 6,
		"0": 0,
		"6": 1,
		"12": 2,
		"16": 5,
		"18": 5,
	})
	// With overrides each step counts its defaults plus the overrides: disturbing hidden everywhere, violence OK.
	const mine = { violence: "show", disturbing: "hide" } as const
	assert.deepEqual(
		passes(plain, { ratings: rated(12, mine) }).optionCounts.ageLimit,
		{
			off: 5,
			"0": 0,
			"6": 1,
			"12": 2,
			"16": 4,
			"18": 4,
		},
	)
	// The other filters count: GoodWatch score of at least 70 leaves rows 0, 2, and 4.
	assert.deepEqual(
		passes(plain, { ratings: rated(12), minScore: 70 }).optionCounts.ageLimit,
		{ off: 3, "0": 0, "6": 1, "12": 2, "16": 2, "18": 2 },
	)
})

test("the content options count the titles of each kind within the age limit and the other filters", () => {
	// Up to 16 lets rows 0, 1, 2, 3, and 5 through.
	assert.deepEqual(passes(plain, { ratings: rated(16) }).optionCounts.content, {
		violence: 2,
		sex: 1,
		disturbing: 1,
		language: 0,
		drugs: 1,
	})
	// Up to 12: rows 0, 1, and 2, whether the kind is hidden (violence) or not (disturbing).
	assert.deepEqual(passes(plain, { ratings: rated(12) }).optionCounts.content, {
		violence: 1,
		sex: 0,
		disturbing: 1,
		language: 0,
		drugs: 0,
	})
	// Without ratings neither group narrows nor counts.
	const none = passes(plain, {})
	assert.deepEqual(none.optionCounts.ageLimit, {})
	assert.deepEqual(none.optionCounts.content, {})
})

test("the ratings sidecar decodes its layout and is refused for a wrong size or checksum", () => {
	const ladders = {
		DE: DE_STEPS.map((age) => ({ age, label: `FSK ${age}` })),
		US: [
			{ age: 0, label: "G", show: "TV-G" },
			{ age: 17, label: "R", show: "TV-MA" },
		],
	}
	// Rows out of order: the encoder sorts by point id, like the snapshot.
	const { manifest, chunks } = encodeRatings({
		rows: [
			{ pointId: MOVIE + 2, content: VIOLENCE, estimate: 12, ages: { DE: 12 } },
			{ pointId: MOVIE + 1, content: 0, estimate: 6, ages: { DE: 6, US: 0 } },
			{
				pointId: MOVIE + 3,
				content: DISTURBING | DRUGS,
				estimate: null,
				ages: {},
			},
		],
		ladders,
	})
	assert.deepEqual(manifest.countries, ["DE", "US"])
	// content, estimate, then the ages of DE and of US, three titles each.
	assert.deepEqual(
		[...chunks[0]],
		[0, 1, 20, 6, 12, 255, 6, 12, 255, 0, 255, 255],
	)
	const checked = checkRatingsManifest(JSON.parse(JSON.stringify(manifest)))
	const columns = joinRatingsChunks(checked, 3, chunks)
	assert.deepEqual([...columns.content], [0, VIOLENCE, DISTURBING | DRUGS])
	assert.deepEqual([...columns.estimates], [6, 12, NONE])
	assert.deepEqual([...columns.ages], [6, 12, NONE, 0, NONE, NONE])
	assert.equal(columns.ladders.US[1].show, "TV-MA")
	// Split into several chunks it joins the same.
	const bytes = chunks[0]
	assert.deepEqual(
		[
			...joinRatingsChunks(checked, 3, [
				bytes.subarray(0, 5),
				bytes.subarray(5),
			]).ages,
		],
		[...columns.ages],
	)

	const refused = (run: () => unknown, why: RegExp) =>
		assert.throws(run, (error: unknown) => {
			assert.ok(error instanceof SnapshotRefused)
			assert.match(error.message, why)
			return true
		})
	// Another title count than the snapshot's, or a missing byte.
	refused(() => joinRatingsChunks(checked, 4, chunks), /need 16/)
	refused(
		() => joinRatingsChunks(checked, 3, [bytes.subarray(0, 11)]),
		/checksum/,
	)
	// A changed byte.
	const changed = Uint8Array.from(bytes)
	changed[4] = 16
	refused(() => joinRatingsChunks(checked, 3, [changed]), /checksum/)
	// Values outside the format, under a matching checksum.
	const sha256 = (data: Uint8Array) =>
		createHash("sha256").update(data).digest("hex")
	const badAge = Uint8Array.from(bytes)
	badAge[7] = 21
	refused(
		() =>
			joinRatingsChunks({ ...checked, sha256: sha256(badAge) }, 3, [badAge]),
		/age 21 at row 1/,
	)
	const badContent = Uint8Array.from(bytes)
	badContent[0] = 32
	refused(
		() =>
			joinRatingsChunks({ ...checked, sha256: sha256(badContent) }, 3, [
				badContent,
			]),
		/content bits/,
	)
	// The manifest's shape.
	refused(() => checkRatingsManifest({ ...manifest, format: 2 }), /format 2/)
	refused(
		() => checkRatingsManifest({ ...manifest, countries: ["US", "DE"] }),
		/country table/,
	)
	refused(
		() => checkRatingsManifest({ ...manifest, countries: ["DE", "FR", "US"] }),
		/ladder of two steps for FR/,
	)
	refused(
		() =>
			checkRatingsManifest({
				...manifest,
				ladders: { ...ladders, US: [...ladders.US].reverse() },
			}),
		/not ascending/,
	)
	refused(() => checkRatingsManifest({ ...manifest, sha256: "abc" }), /sha256/)
	refused(() => checkRatingsManifest(null), /not an object/)
})

// The snapshot's ratings as the title filter reads them: Germany has a column, no other country.
const DE_LADDER = DE_STEPS.map((age) => ({ age, label: `FSK ${age}` }))
const snapshotRatings = {
	content: Uint8Array.from(CONTENT),
	estimates: Uint8Array.from(ESTIMATES),
	countries: ["DE"],
	ladderOf: (country: string) => (country === "DE" ? DE_LADDER : undefined),
	agesOf: (country: string) =>
		country === "DE" ? Uint8Array.from(DE_AGES) : null,
}

test("the viewer's ladder is their country's, plain ages without a column, and none with the age filter off", () => {
	assert.deepEqual(ladderFor(snapshotRatings, "de", true), {
		country: "DE",
		steps: DE_LADDER,
		local: true,
	})
	const plainLadder = ladderFor(snapshotRatings, "TR", true)
	assert.equal(plainLadder?.local, false)
	assert.deepEqual(
		plainLadder?.steps.map((step) => step.label),
		["0+", "6+", "12+", "16+", "18+"],
	)
	// The kill switch, and a snapshot without ratings.
	assert.equal(ladderFor(snapshotRatings, "DE", false), null)
	assert.equal(ladderFor(null, "DE", true), null)
	assert.equal(ladderFor(undefined, "DE", true), null)
})

test("the age limit resolves on the viewer's ladder; without a ladder the parameters don't filter", () => {
	const ok = { violence: "show", sex: "show" } as const
	const de = ladderFor(snapshotRatings, "DE", true)
	assert.ok(de)
	// An age that isn't a step limits to the step below it: 14 is FSK 12. Content goes by the age as given: 14 hides
	// nothing by itself.
	const shared = ratingsFilter(snapshotRatings, de, { ageLimit: 14 })
	assert.equal(shared.limit, 12)
	assert.equal(shared.hidden, 0)
	assert.deepEqual(passes(plain, { ratings: shared }).rows, [0, 1, 2])
	assert.deepEqual(
		shared.steps.map((step) => [step.age, step.hidden]),
		[
			[0, 31],
			[6, 31],
			[12, 3],
			[16, 0],
			[18, 0],
		],
	)
	// The plain ladder for a country without a column: every title by its estimate, row 3 at 14.
	const tr = ladderFor(snapshotRatings, "TR", true)
	assert.ok(tr)
	const estimated = ratingsFilter(snapshotRatings, tr, {
		ageLimit: 16,
		content: ok,
	})
	assert.equal(estimated.ages, null)
	assert.deepEqual(passes(plain, { ratings: estimated }).rows, [0, 1, 2, 3, 5])
	assert.deepEqual(
		passes(plain, {
			ratings: ratingsFilter(snapshotRatings, tr, { ageLimit: 13 }),
		}).rows,
		[0, 1, 2],
	)
	// The kill switch: no ladder, so the title filter passes no ratings and age, hide, and ok don't narrow.
	assert.equal(ladderFor(snapshotRatings, "DE", false), null)
	assert.deepEqual(passes(plain, { ratings: undefined }).rows, plain)
})

test("the snapshot loads without ratings whatever goes wrong with the sidecar", async () => {
	const { manifest: ratings, chunks } = encodeRatings({
		rows: [
			{ pointId: MOVIE + 1, content: 0, estimate: 6, ages: { DE: 6 } },
			{ pointId: MOVIE + 2, content: VIOLENCE, estimate: 12, ages: { DE: 12 } },
		],
		ladders: { DE: DE_LADDER },
	})
	const manifest = {
		version: "v1",
		format: 1,
		count: 2,
		chunks: 1,
		sha256: "",
		keyOrder: [],
		genres: [],
		origins: [],
		builtAt: "2026-10-03T00:00:00Z",
		ratings: ratings as unknown,
	}
	const read: string[] = []
	const redis = (answer: (key: string) => Uint8Array | null) => ({
		getBuffer: async (key: string) => {
			read.push(key)
			return answer(key)
		},
	})
	const stored = redis(() => chunks[0])
	// Errors are logged, not thrown; keep the test's output quiet and count them.
	const logged: unknown[][] = []
	const consoleError = console.error
	console.error = (...args: unknown[]) => {
		logged.push(args)
	}
	try {
		const loaded = await loadRatings(stored, manifest, true)
		assert.deepEqual(read, ["title-snapshot:v1:ratings:0"])
		assert.deepEqual([...(loaded?.estimates ?? [])], [6, 12])
		assert.equal(logged.length, 0)

		// REC_AGE_FILTER off: nothing is read.
		read.length = 0
		assert.equal(await loadRatings(stored, manifest, false), null)
		assert.deepEqual(read, [])
		// A manifest without ratings.
		const { ratings: _none, ...bare } = manifest
		assert.equal(await loadRatings(stored, bare, true), null)
		assert.deepEqual(read, [])
		assert.equal(logged.length, 0)

		// A missing chunk, a changed chunk, a bad manifest field, another title count: each logged once.
		assert.equal(
			await loadRatings(
				redis(() => null),
				manifest,
				true,
			),
			null,
		)
		assert.match(String(logged[0][1]), /chunk 0 is missing/)
		const changed = Uint8Array.from(chunks[0])
		changed[0] = 1
		assert.equal(
			await loadRatings(
				redis(() => changed),
				manifest,
				true,
			),
			null,
		)
		assert.match(String(logged[1][1]), /checksum/)
		assert.equal(
			await loadRatings(stored, { ...manifest, ratings: { format: 2 } }, true),
			null,
		)
		assert.match(String(logged[2][1]), /format 2/)
		assert.equal(
			await loadRatings(stored, { ...manifest, count: 3 }, true),
			null,
		)
		assert.match(String(logged[3][1]), /need 9/)
		// A Redis error on a ratings key doesn't throw either.
		const failing = {
			getBuffer: async () => {
				throw new Error("connection lost")
			},
		}
		assert.equal(await loadRatings(failing, manifest, true), null)
		assert.match(String(logged[4][1]), /connection lost/)
		assert.equal(logged.length, 5)
	} finally {
		console.error = consoleError
	}
})
