import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { test } from "node:test"
import "./test-alias.ts"
import type { PassInput, RatingsFilter } from "./passes.server.ts"

const { ladderFor, ratingsFilter, runPasses, popularityCounts } = await import(
	"./passes.server.ts"
)
const { loadRatings } = await import("../title-snapshot/ratings.server.ts")
const { byMatch, compareRows, sortToUse } = await import("./order.server.ts")
const { hiddenContentBits } = await import("~/domain/age-content")
const { FILTER_NAMES } = await import("~/domain/filter-state")
const { MOOD_KEYS, maskOfMoods, moodMaskOf } = await import("~/domain/moods")
const { STYLE_KEYS, THEME_KEYS, maskOfKeys, styleMaskOf, themeMaskOf } =
	await import("~/domain/themes-styles")
const { VALID_FINGERPRINT_KEYS } = await import("../utils/fingerprint.ts")
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
	moods: new Uint32Array(SCORES.length),
	themes: new Uint16Array(SCORES.length),
	styles: new Uint16Array(SCORES.length),
	ratings: null,
	facts: null,
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
		tasteGroups?: PassInput["tasteGroups"]
		productionCountries?: PassInput["productionCountries"]
		restOfWorld?: PassInput["restOfWorld"]
		years?: PassInput["years"]
		runtime?: PassInput["runtime"]
		sourceScores?: PassInput["sourceScores"]
		scoreGap?: PassInput["scoreGap"]
		services?: PassInput["services"]
		ratings?: RatingsFilter
	},
) {
	const input: PassInput = {
		columns,
		tasteGroups: filters.tasteGroups,
		rows: Int32Array.from(order),
		keys: Float64Array.from(order, (row) => columns.pointIds[row]),
		services: filters.services ?? {
			kind: "column",
			kept: null,
			onMyServices: false,
		},
		notSeen: null,
		seenOrSkipped: noTitles,
		type: "all",
		anime: "any",
		moods: 0,
		themes: 0,
		styles: 0,
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
		productionCountries: filters.productionCountries,
		restOfWorld: filters.restOfWorld,
		years: filters.years,
		runtime: filters.runtime,
		sourceScores: filters.sourceScores,
		scoreGap: filters.scoreGap,
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
		"60": 5,
		outside: 0,
		"70": 5,
		"80": 4,
		"90": 2,
	})
	// GoodWatch score of at least 70 leaves rows 0, 2, and 4.
	const both = passes(plain, { minMatch: 80, minScore: 70 })
	assert.deepEqual(both.rows, [2, 4])
	assert.deepEqual(both.optionCounts.minMatch, {
		"0": 3,
		"60": 3,
		outside: 0,
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
		"60": 6,
		outside: 6,
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

test("the viewer's ladder is their country's, plain ages without a column, and none without ratings", () => {
	assert.deepEqual(ladderFor(snapshotRatings, "de"), {
		country: "DE",
		countries: ["DE"],
		steps: DE_LADDER,
		local: true,
	})
	const plainLadder = ladderFor(snapshotRatings, "TR")
	assert.equal(plainLadder?.local, false)
	assert.deepEqual(
		plainLadder?.steps.map((step) => step.label),
		["0+", "6+", "12+", "16+", "18+"],
	)
	// A snapshot without ratings.
	assert.equal(ladderFor(null, "DE"), null)
	assert.equal(ladderFor(undefined, "DE"), null)
})

test("the age limit resolves on the viewer's ladder; without a ladder the parameters don't filter", () => {
	const ok = { violence: "show", sex: "show" } as const
	const de = ladderFor(snapshotRatings, "DE")
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
	const tr = ladderFor(snapshotRatings, "TR")
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
	// Without a ladder the title filter passes no ratings, and age, hide, and ok don't narrow.
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
		const loaded = await loadRatings(stored, manifest)
		assert.deepEqual(read, ["title-snapshot:v1:ratings:0"])
		assert.deepEqual([...(loaded?.estimates ?? [])], [6, 12])
		assert.equal(logged.length, 0)

		// A manifest without ratings.
		read.length = 0
		const { ratings: _none, ...bare } = manifest
		assert.equal(await loadRatings(stored, bare), null)
		assert.deepEqual(read, [])
		assert.equal(logged.length, 0)

		// A missing chunk, a changed chunk, a bad manifest field, another title count: each logged once.
		assert.equal(
			await loadRatings(
				redis(() => null),
				manifest,
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
			),
			null,
		)
		assert.match(String(logged[1][1]), /checksum/)
		assert.equal(
			await loadRatings(stored, { ...manifest, ratings: { format: 2 } }),
			null,
		)
		assert.match(String(logged[2][1]), /format 2/)
		assert.equal(await loadRatings(stored, { ...manifest, count: 3 }), null)
		assert.match(String(logged[3][1]), /need 9/)
		// A Redis error on a ratings key doesn't throw either.
		const failing = {
			getBuffer: async () => {
				throw new Error("connection lost")
			},
		}
		assert.equal(await loadRatings(failing, manifest), null)
		assert.match(String(logged[4][1]), /connection lost/)
		assert.equal(logged.length, 5)
	} finally {
		console.error = consoleError
	}
})

// ---------------------------------------------------------------- themes and styles

type Picks = { moods?: string[]; themes?: string[]; styles?: string[] }
type Scores = Record<string, number>

/** Columns for titles given by their scores and genres, with the masks the title snapshot derives from them. */
function ruleColumns(titles: { scores: Scores; genres?: string[] }[]) {
	const fingerprints = titles.map((title) =>
		Uint8Array.from(VALID_FINGERPRINT_KEYS, (key) => title.scores[key] ?? 0),
	)
	const mask = (
		of: (fp: Uint8Array, genres: readonly string[]) => number,
	): Uint16Array =>
		Uint16Array.from(titles, (title, row) =>
			of(fingerprints[row], title.genres ?? []),
		)
	return {
		...columns,
		pointIds: Float64Array.from(titles, (_, row) => MOVIE + row + 1),
		genres: new Uint32Array(titles.length),
		releaseDays: new Int32Array(titles.length).fill(19000),
		votes: new Uint32Array(titles.length),
		popularity: new Float32Array(titles.length),
		scores: new Uint8Array(titles.length).fill(70),
		flags: new Uint8Array(titles.length),
		moods: Uint32Array.from(titles, (title, row) =>
			moodMaskOf(fingerprints[row], title.genres ?? []),
		),
		themes: mask(themeMaskOf),
		styles: mask(styleMaskOf),
	}
}

/** Every group off over `rows` of the columns (-1 is a title the snapshot doesn't hold). */
function passInput(c: PassInput["columns"], rows: number[]): PassInput {
	return {
		columns: c,
		rows: Int32Array.from(rows),
		keys: Float64Array.from(rows, (row, i) =>
			row < 0 ? MOVIE + 900 + i : c.pointIds[row],
		),
		services: { kind: "column", kept: null, onMyServices: false },
		notSeen: null,
		seenOrSkipped: { keys: new Set(), rows: new Uint8Array(c.pointIds.length) },
		type: "all",
		anime: "any",
		moods: 0,
		themes: 0,
		styles: 0,
		genres: 0,
		genresChosen: false,
		minScore: 0,
		minMatch: 0,
		matches: null,
		released: null,
		releasedOptions: { any: null },
		similarTo: [],
		people: [],
		legacy: null,
		ratings: null,
	}
}

/** The passes with only the moods, themes and styles chosen. */
function pick(c: ReturnType<typeof ruleColumns>, rows: number[], picks: Picks) {
	const out = runPasses({
		...passInput(c, rows),
		moods: maskOfMoods((picks.moods ?? []) as never),
		themes: maskOfKeys(THEME_KEYS, (picks.themes ?? []) as never),
		styles: maskOfKeys(STYLE_KEYS, (picks.styles ?? []) as never),
	})
	return { ...out, rows: Array.from(out.passing, (i) => rows[i]) }
}

// Rows 0 to 5; what each has by the rules:
// 0 crime 9, mystery 8, slow burn 8     themes crime, mystery   style slow       mood Crime & mystery
// 1 crime 8, fast pace 9                theme crime             style fast
// 2 warfare 8, slow burn 9, pathos 9    theme war               style slow       mood Heavy
// 3 warfare 7, mystery 8, Animation     themes mystery, war     style animated   mood Crime & mystery
// 4 futuristic 8, fast pace 8           theme future            style fast       mood Other worlds
// 5 nothing above its threshold
const told = ruleColumns([
	{ scores: { crime: 9, mystery: 8, slow_burn: 8 } },
	{ scores: { crime: 8, fast_pace: 9 } },
	{ scores: { warfare: 8, slow_burn: 9, pathos: 9 } },
	{ scores: { warfare: 7, mystery: 8 }, genres: ["Animation"] },
	{ scores: { futuristic: 8, fast_pace: 8 } },
	{ scores: { crime: 7, slow_burn: 7 } },
])
const everyRow = [0, 1, 2, 3, 4, 5]

test("a theme or style filter keeps the titles with one of the chosen, and the groups narrow each other", () => {
	assert.deepEqual(pick(told, everyRow, {}).rows, everyRow)
	assert.deepEqual(pick(told, everyRow, { themes: ["crime"] }).rows, [0, 1])
	// Any of the chosen fits.
	assert.deepEqual(
		pick(told, everyRow, { themes: ["crime", "war"] }).rows,
		[0, 1, 2, 3],
	)
	assert.deepEqual(pick(told, everyRow, { styles: ["slow"] }).rows, [0, 2])
	assert.deepEqual(
		pick(told, everyRow, { styles: ["animated", "fast"] }).rows,
		[1, 3, 4],
	)
	// A theme with a style: a title needs both.
	assert.deepEqual(
		pick(told, everyRow, { themes: ["crime", "war"], styles: ["slow"] }).rows,
		[0, 2],
	)
	// And with a mood.
	assert.deepEqual(
		pick(told, everyRow, {
			moods: ["crime"],
			themes: ["crime", "war"],
			styles: ["slow"],
		}).rows,
		[0],
	)
	// A theme no title has leaves nothing.
	assert.deepEqual(pick(told, everyRow, { themes: ["sports"] }).rows, [])
})

test("a title the snapshot doesn't hold has no theme and no style", () => {
	const rows = [0, -1, 2]
	assert.deepEqual(pick(told, rows, {}).rows, rows)
	assert.deepEqual(pick(told, rows, { themes: ["crime", "war"] }).rows, [0, 2])
	assert.deepEqual(pick(told, rows, { styles: ["slow"] }).rows, [0, 2])
	assert.deepEqual(pick(told, rows, { themes: ["war"] }).recoveries, [
		{ filter: "themes", titles: 2 },
	])
})

test("the theme and style options count what each would leave, with a mood, a theme and a style chosen together", () => {
	// Mood Crime & mystery keeps rows 0 and 3; theme War keeps 2 and 3; style Animated keeps 3.
	const out = pick(told, everyRow, {
		moods: ["crime"],
		themes: ["war"],
		styles: ["animated"],
	})
	assert.deepEqual(out.rows, [3])
	assert.deepEqual(Object.keys(out.optionCounts.themes), [...THEME_KEYS])
	assert.deepEqual(Object.keys(out.optionCounts.styles), [...STYLE_KEYS])
	// Themes are counted over the titles the mood and the style let through: row 3 alone, a mystery at war.
	assert.deepEqual(out.optionCounts.themes, {
		...Object.fromEntries(THEME_KEYS.map((key) => [key, 1])),
		// Taking the only chosen theme off turns the group off.
		war: 1,
	})
	// Styles are counted over the titles the mood and the theme let through: row 3 again.
	assert.equal(out.optionCounts.styles.animated, 1)
	assert.equal(out.optionCounts.styles.slow, 1)
	// Moods over the titles of War that are Animated: row 3; a second mood can only add to it.
	assert.equal(out.optionCounts.moods.crime, 1)
	assert.equal(out.optionCounts.moods.heavy, 1)

	// Without the mood: War keeps rows 2 and 3, Slow burn rows 0 and 2.
	const two = pick(told, everyRow, { themes: ["war"], styles: ["slow"] })
	assert.deepEqual(two.rows, [2])
	// Over the slow burns (rows 0 and 2): War alone leaves row 2, adding Crime or Mystery lets row 0 in, another
	// theme adds nothing, and War off leaves both.
	assert.deepEqual(two.optionCounts.themes, {
		...Object.fromEntries(THEME_KEYS.map((key) => [key, 1])),
		crime: 2,
		mystery: 2,
		war: 2,
	})
	// Over the war titles (rows 2 and 3): Slow burn off leaves both, Animated added lets row 3 in.
	assert.deepEqual(two.optionCounts.styles, {
		...Object.fromEntries(STYLE_KEYS.map((key) => [key, 1])),
		animated: 2,
		slow: 2,
	})
})

test("a recovery counts the titles only the themes, or only the styles, hide", () => {
	// War hides rows 0, 1, 4 and 5; Slow burn hides rows 1, 3, 4 and 5. Only row 0 is hidden by the themes alone
	// and only row 3 by the styles alone.
	const out = pick(told, everyRow, { themes: ["war"], styles: ["slow"] })
	assert.deepEqual(out.recoveries, [
		{ filter: "themes", titles: 1 },
		{ filter: "styles", titles: 1 },
	])
	// With the mood Heavy on top (row 2 alone), nothing is hidden by one group only except what Heavy hides: none.
	const three = pick(told, everyRow, {
		moods: ["heavy"],
		themes: ["war"],
		styles: ["slow"],
	})
	assert.deepEqual(three.rows, [2])
	assert.deepEqual(three.recoveries, [])
	assert.deepEqual(pick(told, everyRow, { styles: ["fast"] }).recoveries, [
		{ filter: "styles", titles: 4 },
	])
})

test("the passes agree with a title-by-title count for any moods, themes and styles", () => {
	// 400 made-up titles with any combination of moods, themes and styles, and a few the snapshot doesn't hold.
	let seed = 20261013
	const random = () => {
		seed = (seed + 0x6d2b79f5) | 0
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
	const N = 400
	const bits = (size: number) => {
		let mask = 0
		for (let b = 0; b < size; b++) if (random() < 0.18) mask |= 1 << b
		return mask
	}
	const c = {
		...ruleColumns(Array.from({ length: N }, () => ({ scores: {} }))),
		moods: Uint32Array.from({ length: N }, () => bits(MOOD_KEYS.length)),
		themes: Uint16Array.from({ length: N }, () => bits(THEME_KEYS.length)),
		styles: Uint16Array.from({ length: N }, () => bits(STYLE_KEYS.length)),
	}
	const rows = Array.from({ length: N + 6 }, (_, i) => (i < N ? i : -1))
	const groups = [
		{ name: "moods", keys: MOOD_KEYS as readonly string[], column: c.moods },
		{ name: "themes", keys: THEME_KEYS as readonly string[], column: c.themes },
		{ name: "styles", keys: STYLE_KEYS as readonly string[], column: c.styles },
	] as const
	type Chosen = Record<"moods" | "themes" | "styles", string[]>
	const maskOf = (keys: readonly string[], chosen: string[]) =>
		chosen.reduce((mask, key) => mask | (1 << keys.indexOf(key)), 0)
	// What a group hides: nothing while nothing is chosen; else every title without one of the chosen.
	const hides = (g: (typeof groups)[number], chosen: Chosen, row: number) => {
		const wanted = maskOf(g.keys, chosen[g.name])
		return wanted !== 0 && (row < 0 || (g.column[row] & wanted) === 0)
	}
	const left = (chosen: Chosen) =>
		rows.filter((row) => groups.every((g) => !hides(g, chosen, row))).length
	const some = (keys: readonly string[], n: number) =>
		[...keys].sort(() => random() - 0.5).slice(0, n)

	for (let round = 0; round < 40; round++) {
		const chosen: Chosen = {
			moods: some(MOOD_KEYS, Math.floor(random() * 4)),
			themes: some(THEME_KEYS, Math.floor(random() * 4)),
			styles: some(STYLE_KEYS, Math.floor(random() * 4)),
		}
		const out = pick(c, rows, chosen)
		assert.equal(out.passing.length, left(chosen), JSON.stringify(chosen))
		for (const g of groups) {
			for (const key of g.keys) {
				const toggled = chosen[g.name].includes(key)
					? chosen[g.name].filter((k) => k !== key)
					: [...chosen[g.name], key]
				assert.equal(
					out.optionCounts[g.name][key],
					left({ ...chosen, [g.name]: toggled }),
					`${g.name} ${key} of ${JSON.stringify(chosen)}`,
				)
			}
			const alone = rows.filter((row) =>
				groups.every((other) => hides(other, chosen, row) === (other === g)),
			).length
			assert.equal(
				out.recoveries.find((r) => r.filter === g.name)?.titles ?? 0,
				alone,
				`${g.name} alone of ${JSON.stringify(chosen)}`,
			)
		}
	}
})

test("a fail mask has room for every filter group, the last one included", () => {
	assert.ok(FILTER_NAMES.length <= 32)
	assert.ok(FILTER_NAMES.includes("themes") && FILTER_NAMES.includes("styles"))
	// Appending groups preserves the existing content bit and fits the new last group.
	assert.deepEqual(FILTER_NAMES, [
		"services",
		"notSeenYet",
		"type",
		"anime",
		"moods",
		"themes",
		"styles",
		"genres",
		"minScore",
		"minMatch",
		"released",
		"similarTo",
		"people",
		"legacy",
		"loved",
		"disliked",
		"productionCountries",
		"ageLimit",
		"content",
		"years",
		"runtime",
		"sourceScores",
		"scoreGap",
		"wishlist",
		"popularity",
		"budget",
		"shows",
		"tasteGroups",
	])
	assert.equal(FILTER_NAMES[18], "content")
	assert.equal(FILTER_NAMES[23], "wishlist")
	assert.equal(FILTER_NAMES.at(-1), "tasteGroups")
	assert.equal(FILTER_NAMES.length, 28)
	const ratings: RatingsFilter = {
		content: Uint8Array.from(everyRow, (row) => (row === 3 ? 1 : 0)),
		ages: null,
		estimates: new Uint8Array(everyRow.length),
		limit: -1,
		hidden: 1,
		steps: [],
		hiddenWhenOff: 1,
	}
	const out = runPasses({
		...passInput(told, everyRow),
		themes: maskOfKeys(THEME_KEYS, ["war"]),
		ratings,
	})
	// War keeps rows 2 and 3; the hidden kind of content hides row 3.
	assert.deepEqual(Array.from(out.passing), [2])
	assert.deepEqual(out.recoveries, [
		{ filter: "themes", titles: 4 },
		{ filter: "content", titles: 1 },
	])
	const last = runPasses({
		...passInput(told, everyRow),
		tasteGroups: {
			options: ["movie-1", "show-2"],
			picked: ["movie-1"],
			sideOf: () => "show-2",
		},
	})
	assert.equal(last.passing.length, 0)
	assert.deepEqual(last.recoveries, [
		{ filter: "tasteGroups", titles: everyRow.length },
	])
})

test("production countries combine with OR, count co-productions once, and recover independently", () => {
	const country = (option: string, rows: number[]) => ({
		option,
		keys: {
			keys: new Set(rows.map((row) => columns.pointIds[row])),
			rows: Uint8Array.from(plain, (row) => (rows.includes(row) ? 1 : 0)),
		},
	})
	const us = country("US", [0, 1])
	const gb = country("GB", [1, 2])
	const world = country("restOfWorld", [1, 3])
	assert.deepEqual(passes(plain, { restOfWorld: world.keys.rows }).rows, [1, 3])
	const worldwide = passes(plain, {
		productionCountries: [us],
		restOfWorld: world.keys.rows,
	})
	assert.deepEqual(worldwide.rows, [0, 1, 3])
	assert.equal(worldwide.optionCounts.productionCountries, undefined)

	assert.equal(
		worldwide.recoveries.find((r) => r.filter === "productionCountries")
			?.titles,
		3,
	)
	assert.deepEqual(
		passes(plain, {
			productionCountries: [us],
			restOfWorld: world.keys.rows,
			minScore: 80,
		}).rows,
		[0],
	)

	assert.deepEqual(passes(plain, { productionCountries: [us] }).rows, [0, 1])
	const result = passes(plain, { productionCountries: [us, gb] })
	assert.deepEqual(result.rows, [0, 1, 2])
	assert.equal(result.optionCounts.productionCountries, undefined)
	assert.equal(
		result.recoveries.find((r) => r.filter === "productionCountries")?.titles,
		3,
	)
	assert.deepEqual(
		passes(plain, { productionCountries: [us, gb], minScore: 80 }).rows,
		[0],
	)
	assert.deepEqual(
		passes(plain, { productionCountries: [country("ZZ", [])] }).rows,
		[],
	)
})

test("years, runtime, source scores and gap have independent fail bits and recoveries", () => {
	const keeping = (except: number[]) => ({
		keys: new Set(
			plain.filter((i) => !except.includes(i)).map((i) => columns.pointIds[i]),
		),
		rows: Uint8Array.from(plain, (i) => (except.includes(i) ? 0 : 1)),
	})
	const out = passes(plain, {
		years: keeping([1, 5]),
		runtime: keeping([2, 5]),
		sourceScores: keeping([3]),
		scoreGap: keeping([4]),
	})
	assert.deepEqual(out.rows, [0])
	assert.deepEqual(
		out.recoveries,
		["years", "runtime", "sourceScores", "scoreGap"].map((filter) => ({
			filter,
			titles: 1,
		})),
	)
	for (const name of [
		"years",
		"runtime",
		"sourceScores",
		"scoreGap",
	] as const) {
		assert.deepEqual(
			passes(plain, { [name]: keeping([1, 2]) }).rows,
			[0, 3, 4, 5],
		)
		assert.deepEqual(
			out.optionCounts[name],
			name === "years" || name === "runtime" ? undefined : {},
		) // No extra SQL for option counts.
	}
})

test("any service uses the country's offers and shares the services recovery", () => {
	const services: PassInput["services"] = {
		kind: "index",
		anyService: true,
		index: {
			services: [8, 9],
			offsets: Uint32Array.from([0, 1, 2, 4]),
			entries: Uint16Array.from([0, 1, 0, 1]),
			loadedAt: 1,
			rowOf: () => -1,
			indexOfService: (id) => [8, 9].indexOf(id),
		},
		availabilityRows: Int32Array.from([0, 1, 2, -1, -1, -1]),
		kept: [],
		mine: [0],
		chosen: [],
	}
	const out = passes(plain, { services })
	assert.deepEqual(out.rows, [0, 1, 2])
	assert.deepEqual(out.recoveries, [{ filter: "services", titles: 3 }])
	assert.equal(out.optionCounts.services.any, 3)
	assert.equal(out.optionCounts.services.all, 6)
	assert.equal(out.optionCounts.services.mine, 2)
	assert.deepEqual(
		passes(plain, { services: { ...services, anyService: false } }).rows,
		plain,
	)
})

test("all-of masks, counts and recoveries agree with brute force for every tag group", () => {
	const groups = ["moods", "themes", "styles", "genres"] as const
	// Cross every combination of three tags in each group; genres also exercise the high unsigned bit.
	const size = 8 ** groups.length
	const genreNames = Array.from({ length: 32 }, (_, bit) => `genre-${bit}`)
	const names = {
		moods: MOOD_KEYS,
		themes: THEME_KEYS,
		styles: STYLE_KEYS,
		genres: genreNames,
	}
	const generated = {
		...columns,
		pointIds: Float64Array.from({ length: size }, (_, row) => MOVIE + row),
		moods: Uint32Array.from(
			{ length: size },
			(_, row) => (row & 1) | (row & 2 ? 1 << 11 : 0) | (row & 4 ? 1 << 15 : 0),
		),
		themes: Uint16Array.from({ length: size }, (_, row) => (row >> 3) & 7),
		styles: Uint16Array.from({ length: size }, (_, row) => (row >> 6) & 7),
		genres: Uint32Array.from(
			{ length: size },
			(_, row) => ((row >> 9) & 3) | (row & 2048 ? 0x80000000 : 0),
		),
		genreNames,
		scores: Uint8Array.from({ length: size }, (_, row) =>
			row % 5 === 0 ? 60 : 80,
		),
		flags: new Uint8Array(size),
	}
	const selected = {
		moods: (1 << 11) | (1 << 15),
		themes: 3,
		styles: 3,
		genres: 0x80000001,
	}
	const rows = [...Array(size).keys(), -1]
	const base: PassInput = {
		columns: generated,
		rows: Int32Array.from(rows),
		keys: Float64Array.from(rows, (row) => MOVIE + row),
		services: { kind: "column", kept: null, onMyServices: false },
		notSeen: null,
		seenOrSkipped: { keys: new Set(), rows: new Uint8Array(size) },
		type: "all",
		anime: "any",
		...selected,
		genresChosen: true,
		minScore: 70,
		minMatch: 0,
		matches: null,
		released: null,
		releasedOptions: { any: null },
		similarTo: [],
		people: [],
		legacy: null,
		ratings: null,
	}
	for (const allOf of [[], [...groups], ["moods", "genres"]] as NonNullable<
		PassInput["allOf"]
	>[]) {
		const accepts = (
			row: number,
			group: (typeof groups)[number],
			mask = selected[group],
		) => {
			if (!mask) return true
			if (row < 0) return false
			const bits = generated[group][row] >>> 0
			const wanted = mask >>> 0
			return allOf.includes(group)
				? (bits & wanted) >>> 0 === wanted
				: (bits & wanted) !== 0
		}
		const scorePasses = (row: number) => row >= 0 && generated.scores[row] >= 70
		const out = runPasses({ ...base, allOf })
		assert.deepEqual(
			Array.from(out.passing),
			rows.flatMap((row, i) =>
				scorePasses(row) && groups.every((g) => accepts(row, g)) ? [i] : [],
			),
		)
		for (const group of groups) {
			const others = rows.filter(
				(row) =>
					scorePasses(row) &&
					groups.every((g) => g === group || accepts(row, g)),
			)
			const recovery = others.filter((row) => !accepts(row, group)).length
			assert.equal(
				out.recoveries.find((r) => r.filter === group)?.titles ?? 0,
				recovery,
			)
			names[group].forEach((name, bit) => {
				const option = 1 << bit
				const chosen = selected[group]
				const wanted = allOf.includes(group)
					? chosen & option
						? chosen & ~option
						: chosen | option
					: chosen ^ option
				assert.equal(
					out.optionCounts[group][name],
					others.filter((row) => accepts(row, group, wanted)).length,
					`${allOf}: ${group} ${name}`,
				)
			})
		}
	}
	// Unknown genres cannot silently disappear from an all-of intersection.
	const missing = runPasses({
		...base,
		allOf: ["genres"],
		genresMissing: true,
	})
	assert.equal(missing.passing.length, 0)
	assert.ok(
		Object.values(missing.optionCounts.genres).every((count) => count === 0),
	)
	// Folded pairs are OR units inside an AND group, in either counting path.
	const pairs = [
		["Action", "Action & Adventure"],
		["Adventure", "Action & Adventure"],
		["Science Fiction", "Sci-Fi & Fantasy"],
		["Fantasy", "Sci-Fi & Fantasy"],
		["War", "War & Politics"],
	]
	for (const [movie, tv] of pairs) {
		for (const width of [4, 32]) {
			const genreNames = [
				movie,
				tv,
				"Drama",
				"Romance",
				...Array.from({ length: width - 4 }, (_, i) => `other-${i}`),
			]
			const genreRows = Array.from({ length: 16 }, (_, bits) => bits)
			const pairColumns = {
				...columns,
				genreNames,
				genres: Uint32Array.from(genreRows),
			}
			for (const picked of [1, 2, 3]) {
				const pairInput = {
					...base,
					columns: pairColumns,
					rows: Int32Array.from(genreRows, (_, row) => row),
					keys: Float64Array.from(genreRows, (_, row) => MOVIE + row),
					moods: 0,
					themes: 0,
					styles: 0,
					minScore: 0,
					genres: picked | 4,
				}
				const out = runPasses({ ...pairInput, allOf: ["genres"] })
				const hasPair = (bits: number) => !!(bits & 3)
				const hasDrama = (bits: number) => !!(bits & 4)
				assert.deepEqual(
					Array.from(out.passing),
					genreRows.filter((bits) => hasPair(bits) && hasDrama(bits)),
					`${movie}: ${picked}, ${width}`,
				)
				assert.equal(
					out.optionCounts.genres[movie],
					genreRows.filter(hasDrama).length,
				)
				assert.equal(
					out.optionCounts.genres[tv],
					genreRows.filter(hasDrama).length,
				)
				assert.equal(
					out.optionCounts.genres.Drama,
					genreRows.filter(hasPair).length,
				)
				assert.equal(
					out.optionCounts.genres.Romance,
					genreRows.filter(
						(bits) => hasPair(bits) && hasDrama(bits) && !!(bits & 8),
					).length,
				)
				assert.equal(
					out.recoveries.find((r) => r.filter === "genres")?.titles,
					genreRows.filter((bits) => !hasPair(bits) || !hasDrama(bits)).length,
				)
				const any = runPasses(pairInput)
				assert.deepEqual(
					Array.from(any.passing),
					genreRows.filter((bits) => !!(bits & (picked | 4))),
				)
			}
		}
	}

	// The shared TV names can serve two separate movie-genre units. A TV-only
	// pick is one broad unit; it never requires both movie genres.
	for (const family of [
		["Action", "Adventure", "Action & Adventure"],
		["Science Fiction", "Fantasy", "Sci-Fi & Fantasy"],
	]) {
		const genreNames = [...family, "Drama"]
		const genreRows = Array.from({ length: 16 }, (_, bits) => bits)
		for (const [chosen, requirements] of [
			[1 | 8, [1 | 4, 8]],
			[2 | 8, [2 | 4, 8]],
			[4 | 8, [1 | 2 | 4, 8]],
			[1 | 2 | 4 | 8, [1 | 4, 2 | 4, 8]],
		] as const) {
			const out = runPasses({
				...base,
				columns: {
					...columns,
					genreNames,
					genres: Uint32Array.from(genreRows),
				},
				rows: Int32Array.from(genreRows, (_, row) => row),
				keys: Float64Array.from(genreRows, (_, row) => MOVIE + row),
				moods: 0,
				themes: 0,
				styles: 0,
				minScore: 0,
				genres: chosen,
				allOf: ["genres"],
			})
			assert.deepEqual(
				Array.from(out.passing),
				genreRows.filter((bits) =>
					requirements.every((unit) => !!(bits & unit)),
				),
			)
			assert.equal(
				out.optionCounts.genres.Drama,
				genreRows.filter((bits) =>
					requirements.slice(0, -1).every((unit) => !!(bits & unit)),
				).length,
			)
			if (chosen === (4 | 8)) {
				for (const name of family)
					assert.equal(out.optionCounts.genres[name], 8)
			}
		}
	}
	// The selected movie name can be absent while its TV partner still matches.
	const absentAlias = runPasses({
		...base,
		columns: {
			...columns,
			genreNames: ["Action & Adventure", "Adventure", "Drama"],
			genres: Uint32Array.from([1, 2, 5, 6]),
		},
		rows: Int32Array.from([0, 1, 2, 3]),
		keys: Float64Array.from([MOVIE, MOVIE + 1, MOVIE + 2, MOVIE + 3]),
		moods: 0,
		themes: 0,
		styles: 0,
		minScore: 0,
		genres: 5,
		genrePicks: ["Action", "Drama"],
		allOf: ["genres"],
	})
	assert.deepEqual(Array.from(absentAlias.passing), [2])
})

test("list and taste steps, option counts and recoveries agree with brute force", () => {
	// Include match boundaries, no match, a skipped but unseen title, rewatch wishes,
	// and a search title absent from the snapshot (membership must fall back to its key).
	const rows = [5, 0, 4, 1, 3, 2, -1]
	const base = passInput(columns, rows)
	const seenKeys = new Set([base.keys[0], base.keys[2], base.keys[6]])
	const skippedKeys = new Set([base.keys[1]])
	const wishes = new Set([base.keys[2], base.keys[3], base.keys[6]])
	const set = (keys: Set<number>) => ({
		keys,
		rows: Uint8Array.from(columns.pointIds, (key) => Number(keys.has(key))),
	})
	const matches = Uint8Array.from([0, 49, 50, 59, 60, 80, 90])
	for (const member of [true, false])
		for (const hasTaste of [true, false])
			for (const mode of ["off", "on", "seen"])
				for (const onWishlist of [false, true])
					for (const match of [0, 60, 70, 80, 90, "outside"] as const)
						for (const minScore of [0, 70]) {
							const listPasses = (i: number, option: string) =>
								option === "seen"
									? !member || seenKeys.has(base.keys[i])
									: option !== "on" ||
										!(
											seenKeys.has(base.keys[i]) ||
											skippedKeys.has(base.keys[i])
										)
							const wishPasses = (i: number, on: boolean) =>
								!on || !member || wishes.has(base.keys[i])
							const matchPasses = (i: number, option: number | "outside") =>
								!hasTaste ||
								(option === "outside"
									? !member || (matches[i] >= 50 && matches[i] < 60)
									: matches[i] >= option)
							const scorePasses = (i: number) =>
								!minScore ||
								(rows[i] >= 0 &&
									SCORES[rows[i]] !== UNKNOWN_SCORE &&
									SCORES[rows[i]] >= minScore)
							const all = Array.from(rows.keys())
							const out = runPasses({
								...base,
								seen: member ? set(seenKeys) : undefined,
								seenOrSkipped: set(new Set([...seenKeys, ...skippedKeys])),
								notSeen:
									mode === "on"
										? set(new Set([...seenKeys, ...skippedKeys]))
										: null,
								seenBefore: mode === "seen" && member,
								wishlist: member ? set(wishes) : null,
								onWishlist,
								matches: hasTaste ? matches : null,
								minMatch: match === "outside" ? 0 : match,
								outsideUsual: match === "outside",
								outsideUsualAvailable: member,
								minScore,
							})
							const predicates = {
								notSeenYet: (i: number) => listPasses(i, mode),
								wishlist: (i: number) => wishPasses(i, onWishlist),
								minMatch: (i: number) => matchPasses(i, match),
								minScore: scorePasses,
							}
							assert.deepEqual(
								Array.from(out.passing),
								all.filter((i) => Object.values(predicates).every((p) => p(i))),
							)
							for (const group of [
								"notSeenYet",
								"wishlist",
								"minMatch",
								"minScore",
							] as const) {
								const others = all.filter((i) =>
									Object.entries(predicates).every(
										([g, p]) => g === group || p(i),
									),
								)
								assert.equal(
									out.recoveries.find((r) => r.filter === group)?.titles ?? 0,
									others.filter((i) => !predicates[group](i)).length,
								)
								if (group === "notSeenYet")
									for (const option of ["off", "on", "seen"])
										assert.equal(
											out.optionCounts[group][option],
											others.filter((i) => listPasses(i, option)).length,
										)
								if (group === "wishlist")
									for (const on of [false, true])
										assert.equal(
											out.optionCounts[group][on ? "on" : "off"],
											others.filter((i) => wishPasses(i, on)).length,
										)
								if (group === "minMatch")
									for (const option of [
										0,
										60,
										70,
										80,
										90,
										"outside",
									] as const) {
										assert.equal(
											out.optionCounts[group][String(option)],
											others.filter((i) => matchPasses(i, option)).length,
										)
									}
							}
						}
})

test("16-mood combination table and 17-option per-title path stay bounded", (t) => {
	assert.equal(MOOD_KEYS.length, 16)
	const size = 65_536
	const rows = Array.from({ length: size }, (_, row) => row)
	const c = {
		...columns,
		pointIds: Float64Array.from(rows, (row) => MOVIE + row),
		releaseDays: new Int32Array(size).fill(19000),
		votes: new Uint32Array(size),
		popularity: new Float32Array(size),
		scores: new Uint8Array(size).fill(80),
		flags: new Uint8Array(size),
		moods: Uint32Array.from(rows),
		themes: new Uint16Array(size),
		styles: new Uint16Array(size),
		genres: Uint32Array.from(rows, (row) => row | (row & 1 ? 1 << 16 : 0)),
		genreNames: Array.from({ length: 17 }, (_, bit) => `tag-${bit}`),
	}
	const base = passInput(c, rows)
	const chosen = (1 << 11) | (1 << 15)
	for (const group of ["moods", "genres"] as const) {
		const names = group === "moods" ? MOOD_KEYS : c.genreNames
		for (const all of [false, true]) {
			const input: PassInput = {
				...base,
				[group]: chosen,
				genresChosen: group === "genres",
				allOf: all ? [group] : [],
			}
			const accepts = (bits: number, mask: number) =>
				!mask || (all ? (bits & mask) === mask : (bits & mask) !== 0)
			const result = runPasses(input)
			assert.equal(
				result.passing.length,
				rows.filter((row) => accepts(c[group][row], chosen)).length,
			)
			names.forEach((name, bit) => {
				const toggled = chosen ^ (1 << bit)
				assert.equal(
					result.optionCounts[group][name],
					rows.filter((row) => accepts(c[group][row], toggled)).length,
					`${group} ${all} ${name}`,
				)
			})
			const start = performance.now()
			for (let i = 0; i < 5; i++) runPasses(input)
			const elapsed = performance.now() - start
			t.diagnostic(
				`${names.length} ${group}, ${all ? "all" : "any"}: ${(elapsed / 5).toFixed(2)} ms/pass over ${size} titles`,
			)
			assert.ok(elapsed < 5000, `${group} five passes took ${elapsed} ms`)
		}
	}
})

test("service counts include 120 options and retain a chosen service beyond the top services", () => {
	const ids = Array.from({ length: 140 }, (_, s) => s + 1)
	const services: PassInput["services"] = {
		kind: "index",
		index: {
			services: ids,
			offsets: Uint32Array.from([0, ids.length]),
			entries: Uint16Array.from(ids, (id) => id - 1),
			loadedAt: 1,
			rowOf: () => 0,
			indexOfService: (id) => ids.indexOf(id),
		},
		availabilityRows: new Int32Array(plain.length),
		kept: [],
		mine: [],
		chosen: [139],
	}
	const counts = passes(plain, { services }).optionCounts.services
	assert.equal(Object.keys(counts).length, 122) // 120 service IDs, all and any
	assert.equal(counts[119], plain.length)
	assert.equal(counts[120], undefined)
	assert.equal(counts[140], plain.length)
})

test("rating country chooses the ladder and age column independently of streaming country", () => {
	const ratings = {
		...snapshotRatings,
		countries: ["DE", "US"],
		ladderOf: (country: string) =>
			country === "DE"
				? DE_LADDER
				: [
						{ age: 0, label: "G" },
						{ age: 12, label: "PG-13" },
						{ age: 18, label: "R" },
					],
		agesOf: (country: string) =>
			country === "DE"
				? Uint8Array.from(DE_AGES)
				: Uint8Array.from(DE_AGES.map(() => 18)),
	}
	const state = {
		streamingCountry: "US",
		ratingCountry: "DE",
		ageLimit: 12,
		content: { violence: "show", sex: "show" } as const,
	}
	const chosen = ladderFor(ratings, "GB", state)
	assert.ok(chosen)
	assert.equal(chosen.country, "DE")
	assert.deepEqual(chosen.steps, DE_LADDER)
	assert.equal(chosen.countries, ratings.countries)
	assert.deepEqual(
		passes(plain, { ratings: ratingsFilter(ratings, chosen, state) }).rows,
		[0, 1, 2],
	)
	const fallback = ladderFor(ratings, "GB", { ...state, ratingCountry: "ZZ" })
	assert.ok(fallback)
	assert.equal(fallback.country, "US")
	assert.deepEqual(
		passes(plain, { ratings: ratingsFilter(ratings, fallback, state) }).rows,
		[],
	)
	assert.equal(ladderFor(ratings, "US", { ratingCountry: "ZZ" })?.country, "US")
	assert.equal(ladderFor(ratings, "US", {})?.country, "US")
})

const { restOfWorldColumn } = await import("./rest-of-world.server.ts")

test("Rest of the world derives once per version from all four facts country slots", () => {
	const count = plain.length
	const countryIndexes = new Uint8Array(4 * count).fill(255)
	// US only; US/DE co-production; big-eight only; fourth-slot NG; missing; CA show.
	countryIndexes.set([0, 0, 1, 255, 255, 3])
	countryIndexes[count + 1] = 2
	countryIndexes[2 * count + 2] = 0
	countryIndexes[3 * count + 3] = 4
	const facts = {
		releaseYears: new Uint16Array(count),
		lengths: new Uint16Array(count),
		budgets: new Uint32Array(count),
		boxOffice: new Uint32Array(count),
		seasons: new Uint8Array(count),
		episodes: new Uint16Array(count),
		showStatuses: new Uint8Array(count),
		countryIndexes,
		countries: ["US", "JP", "DE", "CA", "NG"],
	}
	const snapshot = {
		version: "countries-first",
		count,
		columns: { ...columns, facts },
	}
	const rows = restOfWorldColumn(snapshot)!
	assert.deepEqual([...rows], [0, 1, 0, 1, 0, 1])
	assert.equal(restOfWorldColumn(snapshot), rows)
	assert.deepEqual(passes(plain, { restOfWorld: rows }).rows, [1, 3, 5])
	const reordered = passes([5, 3, 1, 0], { restOfWorld: rows })
	assert.deepEqual(reordered.rows, [5, 3, 1])
	countryIndexes[count + 1] = 0
	assert.equal(restOfWorldColumn(snapshot), rows)
	const refreshed = restOfWorldColumn({
		...snapshot,
		version: "countries-next",
	})!
	assert.notEqual(refreshed, rows)
	assert.deepEqual([...refreshed], [0, 0, 0, 1, 0, 1])
})

test("missing facts leave Rest of the world inactive with a null count and one warning per version", (t) => {
	const warn = t.mock.method(console, "warn", () => {})
	const snapshot = {
		version: "countries-missing",
		count: plain.length,
		columns,
	}
	assert.equal(restOfWorldColumn(snapshot), null)
	assert.equal(restOfWorldColumn(snapshot), null)
	assert.equal(warn.mock.callCount(), 1)
	const result = passes(plain, { restOfWorld: null })
	assert.deepEqual(result.rows, plain)
	assert.equal(result.optionCounts.productionCountries, undefined)
	assert.equal(
		result.recoveries.find((r) => r.filter === "productionCountries"),
		undefined,
	)
	restOfWorldColumn({ ...snapshot, version: "countries-still-missing" })
	assert.equal(warn.mock.callCount(), 2)
})

test("popularity ranges, every preset and stop count, and shared recovery match brute force", async () => {
	const { POPULARITY_OPTIONS } = await import("~/domain/title-scales")
	const votes = [1000, 9999, 10000, 100000, 1000000, 2000000]
	const ranks = [10001, 10000, 1000, 1001, 1, 40001]
	const c = { ...columns, votes: Uint32Array.from(votes) }
	const order = [5, 3, 1, 0, 4, 2, -1]
	const base = passInput(c, order)
	base.keys[6] = MOVIE + 99
	const ranges = [
		undefined,
		{ max: 9999 },
		{ min: 10000, max: 99999 },
		{ min: 1000000 },
		{ min: 1000, max: 1000 },
	]
	const rankRanges = [
		undefined,
		{ max: 1000 },
		{ min: 1001, max: 10000 },
		{ min: 10001 },
		{ min: 1, max: 1 },
	]
	const keeps = (
		value: number | undefined,
		range?: { min?: number; max?: number },
	) =>
		!range ||
		(range.min === undefined && range.max === undefined) ||
		(value !== undefined &&
			value >= (range.min ?? 0) &&
			value <= (range.max ?? Number.POSITIVE_INFINITY))
	for (const v of ranges)
		for (const rank of rankRanges)
			for (const minScore of [0, 70]) {
				const other = (row: number) =>
					!minScore ||
					(row >= 0 && SCORES[row] !== UNKNOWN_SCORE && SCORES[row] >= minScore)
				const vAt = (row: number) => (row < 0 ? undefined : votes[row])
				const rAt = (row: number) => (row < 0 ? undefined : ranks[row])
				const out = runPasses({
					...base,
					popularityCounts: true,
					votes: v,
					popularityRank: rank,
					popularityRanks: Int32Array.from(ranks),
					minScore,
				})
				const uncounted = runPasses({
					...base,
					votes: v,
					popularityRank: rank,
					popularityRanks: Int32Array.from(ranks),
					minScore,
				})
				assert.equal(
					Object.prototype.hasOwnProperty.call(
						uncounted.optionCounts,
						"popularity",
					),
					false,
				)
				assert.deepEqual(uncounted.passing, out.passing)
				assert.deepEqual(uncounted.recoveries, out.recoveries)
				const expected = order.filter(
					(row) => other(row) && keeps(vAt(row), v) && keeps(rAt(row), rank),
				)
				assert.deepEqual(
					Array.from(out.passing, (i) => order[i]),
					expected,
				)
				assert.equal(
					out.recoveries.find((r) => r.filter === "popularity")?.titles ?? 0,
					order.filter(other).length - expected.length,
				)
				for (const o of POPULARITY_OPTIONS) {
					const expectedCount = order.filter(
						(row) =>
							other(row) &&
							(o.field === "votes"
								? keeps(vAt(row), o.range) && keeps(rAt(row), rank)
								: keeps(rAt(row), o.range) && keeps(vAt(row), v)),
					).length
					assert.equal(
						out.optionCounts.popularity![o.key],
						expectedCount,
						o.key,
					)
				}
			}
	// A title outside the eligible catalog has no rank, including for an upper-bound-only range.
	assert.equal(
		runPasses({
			...base,
			popularityRank: { max: 1000 },
			popularityRanks: new Int32Array(6),
		}).passing.length,
		0,
	)
})

test("catalog Popular ranks are shared, stable across sorts, and renewed per snapshot version", async () => {
	const { popularityRanks, catalogRows } = await import("./order.server.ts")
	const { FLAG_POSTER, FLAG_ADULT } = await import(
		"../title-snapshot/format.server.ts"
	)
	const c = {
		...columns,
		votes: Uint32Array.from([1000, 1000, 999, 1000, 1000, 1000]),
		flags: new Uint8Array(6).fill(FLAG_POSTER),
	}
	c.pointIds = c.pointIds.slice()
	c.pointIds[4] = 2e12 + 1 // Shows share the movie catalog's ranking.
	c.popularity = Float32Array.from([100, 100, 0, 0, 50, 0]) // Equal popularity and votes break by title key.
	c.flags[5] |= FLAG_ADULT
	const snapshot = {
		version: "rank-test-one",
		count: 6,
		columns: c,
	} as unknown as Parameters<typeof popularityRanks>[0]
	const ranks = popularityRanks(snapshot)
	assert.deepEqual([...ranks], [1, 2, 0, 0, 3, 0])
	catalogRows(snapshot, "top")
	assert.equal(popularityRanks(snapshot), ranks)
	assert.deepEqual([...catalogRows(snapshot, "popular").rows], [0, 1, 4])
	const next = {
		...snapshot,
		version: "rank-test-two",
		columns: { ...c, popularity: Float32Array.from([1, 100, 0, 0, 200, 0]) },
	}
	assert.deepEqual([...popularityRanks(next)], [3, 2, 0, 0, 1, 0])
	const missing = {
		...c,
		flags: c.flags.slice(),
		releaseDays: c.releaseDays.slice(),
	}
	missing.flags[0] = 0
	missing.releaseDays[4] = -2147483648
	assert.deepEqual(
		[
			...popularityRanks({
				...snapshot,
				version: "rank-test-three",
				columns: missing,
			}),
		],
		[0, 1, 0, 0, 0, 0],
	)
})

test("popularity preset seams partition titles except the intentional million-vote subset", async () => {
	const { VOTES_PRESETS, POPULARITY_RANK_PRESETS } = await import(
		"~/domain/title-scales"
	)
	const contains = (value: number, range: { min?: number; max?: number }) =>
		value >= (range.min ?? 0) &&
		value <= (range.max ?? Number.POSITIVE_INFINITY)
	for (const votes of [
		0, 9999, 10000, 99999, 100000, 999999, 1000000, 2000000,
	]) {
		const matches = VOTES_PRESETS.filter((preset) =>
			contains(votes, preset.range),
		).map((preset) => preset.key)
		assert.deepEqual(
			matches,
			votes < 10000
				? ["hiddenGems"]
				: votes < 100000
					? ["knownToFans"]
					: votes < 1000000
						? ["wellKnown"]
						: ["wellKnown", "everyone"],
		)
	}
	for (const rank of [1, 999, 1000, 1001, 9999, 10000, 10001, 200000]) {
		assert.deepEqual(
			POPULARITY_RANK_PRESETS.filter((preset) =>
				contains(rank, preset.range),
			).map((preset) => preset.key),
			rank <= 1000
				? ["popularNow"]
				: rank <= 10000
					? ["underTheRadar"]
					: ["deepCuts"],
		)
	}
})

test("popularity counts stay within the request budget over 200k titles", (t) => {
	const size = 200000
	const rows = Array.from({ length: size }, (_, row) => row)
	const c = {
		...columns,
		pointIds: Float64Array.from(rows, (row) => MOVIE + row),
		releaseDays: new Int32Array(size).fill(19000),
		votes: Uint32Array.from(rows, (row) => (row * 7919) % 2000001),
		popularity: new Float32Array(size),
		scores: new Uint8Array(size).fill(80),
		flags: new Uint8Array(size),
		moods: new Uint32Array(size),
		themes: new Uint16Array(size),
		styles: new Uint16Array(size),
		genres: new Uint32Array(size),
	}
	const input = {
		...passInput(c, rows),
		popularityCounts: true,
		popularityRanks: Int32Array.from(rows, (row) => row + 1),
	}
	// Time this group's work separately from the existing passes and other groups' counts.
	const masks = new Uint32Array(size)
	const flaggedStart = performance.now()
	const counts = runPasses(input).optionCounts.popularity!
	t.diagnostic(
		`Flagged pass: ${(performance.now() - flaggedStart).toFixed(2)} ms over ${size} titles`,
	)
	assert.deepEqual(counts, popularityCounts(input, masks))
	assert.equal(counts["votes:any"], size)
	assert.equal(counts["rank:any"], size)
	for (let i = 0; i < 10; i++) popularityCounts(input, masks)
	const times = Array.from({ length: 9 }, () => {
		const start = performance.now()
		popularityCounts(input, masks)
		return performance.now() - start
	}).sort((a, b) => a - b)
	const median = times[Math.floor(times.length / 2)]
	t.diagnostic(`Median: ${median.toFixed(2)} ms per call over ${size} titles`)
	assert.ok(median < 15, `Median ${median.toFixed(2)} ms exceeded 15 ms`)
})

function factsFixture(n: number): NonNullable<PassInput["columns"]["facts"]> {
	const countries = ["US", "CA", "GB", "FR", "NG", "NZ", "JP"]
	const countryIndexes = new Uint8Array(n * 4).fill(255)
	for (let r = 0; r < n; r++)
		for (let s = 0; s < r % 5; s++)
			countryIndexes[s * n + r] = (r + s) % countries.length
	return {
		releaseYears: Uint16Array.from({ length: n }, (_, i) =>
			i % 11 ? 1920 + (i % 108) : 0,
		),
		lengths: Uint16Array.from({ length: n }, (_, i) =>
			i % 13 ? 1 + ((i * 7) % 350) : 0,
		),
		budgets: new Uint32Array(n),
		boxOffice: new Uint32Array(n),
		seasons: new Uint8Array(n),
		episodes: new Uint16Array(n),
		showStatuses: new Uint8Array(n),
		countryIndexes,
		countries,
	}
}

test("facts counts match brute force with other filters, distinct sets, overflow and unknown lengths", async () => {
	const { INDUSTRIES, REGIONS, BIG_EIGHT } = await import(
		"~/domain/film-industries"
	)
	const n = 100,
		facts = factsFixture(n)
	const c = {
		...columns,
		facts,
		pointIds: Float64Array.from(
			{ length: n },
			(_, i) => (i % 2 ? 2e12 : MOVIE) + i + 1,
		),
		scores: Uint8Array.from({ length: n }, (_, i) => (i % 3 ? 80 : 40)),
	}
	const base = passInput(
		c,
		Array.from({ length: n }, (_, i) => i),
	)
	for (const limited of [false, true]) {
		const actual = runPasses({
			...base,
			releasedCounts: true,
			lengthCounts: true,
			originCounts: true,
			minScore: limited ? 70 : 0,
			yearRange: limited ? { min: 1970, max: 2025 } : undefined,
			movieRange: limited ? { max: 90 } : undefined,
			episodeRange: limited ? { min: 35, max: 55 } : null,
			productionCountries: limited
				? [
						{
							option: "US",
							keys: {
								keys: new Set<number>(),
								rows: Uint8Array.from({ length: n }, (_, i) => i % 2),
							},
						},
					]
				: [],
		}).optionCounts
		const years: Record<string, number> = {},
			runtime: Record<string, number> = {},
			origin: Record<string, number> = { world: 0 }
		for (const kind of ["movie", "episode"]) {
			for (let b = 0; b <= 240; b += 5) runtime[`${kind}:${b}`] = 0
			runtime[`${kind}:unknown`] = 0
		}
		for (const set of [...INDUSTRIES, ...REGIONS]) origin[`set:${set.id}`] = 0
		for (let i = 0; i < n; i++) {
			const year = facts.releaseYears[i],
				length = facts.lengths[i],
				show = i % 2 === 1
			const scoreOK = !limited || c.scores[i] >= 70,
				yearOK = !limited || (year >= 1970 && year <= 2025)
			const lengthOK =
				!limited ||
				(length > 0 && (show ? length >= 35 && length <= 55 : length <= 90))
			const countryOK = !limited || show
			if (scoreOK && lengthOK && countryOK && year)
				years[year] = (years[year] ?? 0) + 1
			if (scoreOK && yearOK && countryOK)
				runtime[
					`${show ? "episode" : "movie"}:${length ? Math.min(240, length - (length % 5)) : "unknown"}`
				]++
			if (scoreOK && yearOK && lengthOK) {
				const codes = facts.countries.filter((_, c) =>
					[0, 1, 2, 3].some((s) => facts.countryIndexes[s * n + i] === c),
				)
				for (const code of codes) origin[code] = (origin[code] ?? 0) + 1
				for (const set of [...INDUSTRIES, ...REGIONS])
					if (codes.some((code) => set.codes.includes(code)))
						origin[`set:${set.id}`]++
				if (codes.some((code) => !BIG_EIGHT.includes(code))) origin.world++
			}
		}
		assert.deepEqual(actual.years, years)
		assert.deepEqual(actual.runtime, runtime)
		assert.deepEqual(actual.productionCountries, origin)
	}
	for (const field of ["years", "runtime", "productionCountries"] as const)
		assert.ok(!(field in runPasses(base).optionCounts))
	for (const [flag, field] of [
		["releasedCounts", "years"],
		["lengthCounts", "runtime"],
		["originCounts", "productionCountries"],
	] as const) {
		assert.equal(
			runPasses({ ...base, columns: { ...c, facts: null }, [flag]: true })
				.optionCounts[field],
			null,
		)
		const present = runPasses({ ...base, [flag]: true }).optionCounts
		assert.ok(present[field])
		for (const other of ["years", "runtime", "productionCountries"] as const)
			if (other !== field) assert.ok(!(other in present))
	}
})

test("facts count cost on a generated 260k-title universe", async (t) => {
	const { factCounts } = await import("./passes.server.ts")
	const n = 260_000,
		facts = factsFixture(n)
	const input = passInput(
		{
			...columns,
			facts,
			pointIds: Float64Array.from(
				{ length: n },
				(_, i) => (i % 2 ? 2e12 : MOVIE) + i + 1,
			),
		},
		Array.from({ length: n }, (_, i) => i),
	)
	const masks = new Uint32Array(n)
	for (const flag of [
		"releasedCounts",
		"lengthCounts",
		"originCounts",
	] as const) {
		const requested = { ...input, [flag]: true }
		for (let warm = 0; warm < 5; warm++) factCounts(requested, masks)
		const times = Array.from({ length: 15 }, () => {
			const start = performance.now()
			factCounts(requested, masks)
			return performance.now() - start
		}).sort((a, b) => a - b)
		t.diagnostic(
			`${flag}: median ${times[7].toFixed(2)} ms; p95 ${times[14].toFixed(2)} ms`,
		)
	}
})

test("unrequested facts counts and inactive ranges never read the facts columns", () => {
	const facts = factsFixture(6)
	for (const key of Object.keys(facts))
		Object.defineProperty(facts, key, {
			get() {
				throw new Error(`unexpected facts read: ${key}`)
			},
		})
	const result = runPasses(passInput({ ...columns, facts }, plain))
	assert.deepEqual([...result.passing], plain)
	assert.equal(result.optionCounts.years, undefined)
	assert.equal(result.optionCounts.runtime, undefined)
	assert.equal(result.optionCounts.productionCountries, undefined)
})

test("year counts ignore both Released choices and out-of-snapshot rows count as unknown lengths", () => {
	const facts = factsFixture(6)
	const base = passInput({ ...columns, facts }, [0, 1, -1])
	const result = runPasses({
		...base,
		releasedCounts: true,
		lengthCounts: true,
		released: { from: 0, to: 1 },
	})
	assert.deepEqual(result.optionCounts.years, { 1921: 1 })
	assert.equal(result.optionCounts.runtime?.["movie:unknown"], 0) // Released is still another filter for Length.
	const unknown = runPasses({ ...base, lengthCounts: true }).optionCounts
		.runtime
	assert.equal(unknown?.["movie:unknown"], 2)
})

function moneyShowsInput(n = 100): PassInput {
	const facts = factsFixture(n)
	const c = {
		...columns,
		facts,
		pointIds: Float64Array.from(
			{ length: n },
			(_, i) => (i % 2 ? 2e12 : MOVIE) + i + 1,
		),
		scores: Uint8Array.from({ length: n }, (_, i) => (i % 3 ? 80 : 40)),
	}
	for (let i = 0; i < n; i++) {
		facts.budgets[i] = [0, 10, 4999, 5000, 49999, 50000, 99999, 100000][i % 8]
		facts.boxOffice[i] = [0, 100000, 500000, 1000000, 2000, 150000, 99999][
			i % 7
		]
		facts.seasons[i] = i % 12
		facts.episodes[i] = i % 9 ? i * 10 : 0
		facts.lengths[i] = i % 7 ? 30 : 0
		facts.showStatuses[i] = Math.floor(i / 2) % 4
	}
	// Exact 3x in stored thousands can round differently after conversion to millions.
	if (n > 2) {
		facts.budgets[2] = 10001
		facts.boxOffice[2] = 30003
	}
	return passInput(
		c,
		Array.from({ length: n }, (_, i) => i),
	)
}

test("budget and shows unknown facts and wrong media types fail, including zero bounds", () => {
	const base = moneyShowsInput(16)
	const f = base.columns.facts!
	f.budgets.set([0, 10, 100, 100, 100, 100, 100, 100, 100])
	f.boxOffice.set([100, 300, 0, 300, 300, 99, 99, 100, 100])
	for (const choice of [
		{ budget: { min: 0 } },
		{ boxOffice: { min: 0 } },
		{ returns: "hit" as const },
		{ returns: "flop" as const },
	]) {
		const out = runPasses({ ...base, ...choice })
		for (const i of out.passing) {
			assert.ok(base.keys[i] < 2e12)
			if ("budget" in choice || choice.returns) assert.ok(f.budgets[i] > 0)
			if ("boxOffice" in choice || choice.returns) assert.ok(f.boxOffice[i] > 0)
		}
	}
	assert.ok(
		![...runPasses({ ...base, returns: "hit" }).passing].includes(2),
		"missing box office cannot be a hit",
	)
	assert.ok(
		![...runPasses({ ...base, returns: "flop" }).passing].includes(2),
		"missing box office cannot be a flop",
	)
	assert.ok(
		[...runPasses({ ...base, returns: "hit" }).passing].includes(4),
		"exactly 3x is a hit",
	)
	const flops = [...runPasses({ ...base, returns: "flop" }).passing]
	assert.ok(flops.includes(6), "known box office below budget is a flop")
	assert.ok(!flops.includes(8), "breaking even is not a flop")
	for (const choice of [
		{ budget: { min: 0 } },
		{ boxOffice: { min: 0 } },
		{ returns: "hit" as const },
		{ seasons: { min: 0 } },
		{ hours: { min: 0 } },
		{ showStatus: "ended" as const },
	]) {
		const outside = {
			...base,
			rows: Int32Array.of(-1),
			keys: Float64Array.of(
				"budget" in choice || "boxOffice" in choice || "returns" in choice
					? MOVIE
					: 2e12,
			),
		}
		assert.equal(
			runPasses({ ...outside, ...choice }).passing.length,
			0,
			"a missing snapshot row has unknown facts",
		)
	}
	for (const choice of [
		{ seasons: { min: 0 } },
		{ hours: { min: 0 } },
		{ showStatus: "running" as const },
	]) {
		for (const i of runPasses({ ...base, ...choice }).passing) {
			assert.ok(base.keys[i] >= 2e12)
			if ("seasons" in choice) assert.ok(f.seasons[i] > 0)
			if ("hours" in choice) assert.ok(f.episodes[i] > 0 && f.lengths[i] > 0)
			if ("showStatus" in choice) assert.equal(f.showStatuses[i], 1)
		}
	}
	for (const group of ["budget", "shows"] as const) {
		assert.equal(
			Object.prototype.hasOwnProperty.call(runPasses(base).optionCounts, group),
			false,
		)
		const noFacts = runPasses({
			...base,
			columns: { ...base.columns, facts: null },
			budget: { min: 1 },
			returns: "hit",
			seasons: { min: 2 },
			hours: { min: 10 },
			showStatus: "ended",
			budgetCounts: true,
			showsCounts: true,
		})
		assert.equal(noFacts.passing.length, base.rows.length)
		assert.equal(noFacts.optionCounts[group], null)
	}
})

test("budget and shows histograms retain sibling choices and match brute force", async () => {
	const { BUDGET_STEPS, BOX_OFFICE_STEPS, SEASONS_STEPS, HOURS_STEPS } =
		await import("~/domain/title-scales")
	const base = moneyShowsInput()
	const f = base.columns.facts!
	for (const limited of [false, true]) {
		const input: PassInput = {
			...base,
			budgetCounts: true,
			showsCounts: true,
			minScore: limited ? 70 : 0,
			budget: limited ? { min: 5 } : undefined,
			boxOffice: limited ? { min: 100 } : undefined,
			returns: limited ? "hit" : undefined,
			seasons: limited ? { min: 2 } : undefined,
			hours: limited ? { max: 100 } : undefined,
			showStatus: limited ? "ended" : undefined,
		}
		// Budget and Shows are deliberately incompatible when both active; test each with the other group clear.
		for (const group of ["budget", "shows"] as const) {
			const active =
				group === "budget"
					? {
							...input,
							seasons: undefined,
							hours: undefined,
							showStatus: undefined,
						}
					: {
							...input,
							budget: undefined,
							boxOffice: undefined,
							returns: undefined,
						}
			const actual = runPasses(active).optionCounts[group]!
			for (const [key, count] of Object.entries(actual)) {
				const expected = Array.from(base.rows).filter((i) => {
					if (limited && base.columns.scores[i] < 70) return false
					const movie = base.keys[i] < 2e12,
						rawBudget = f.budgets[i],
						rawOffice = f.boxOffice[i],
						b = rawBudget / 1000,
						o = f.boxOffice[i] / 1000,
						s = f.seasons[i],
						h = (f.episodes[i] * f.lengths[i]) / 60,
						status = f.showStatuses[i]
					const within = (v: number, range?: { min?: number; max?: number }) =>
						!range ||
						(v > 0 && v >= (range.min ?? 0) && v <= (range.max ?? Infinity))
					const [field, option] = key.split(":")
					if (group === "budget") {
						if (!movie) return false
						const replacement = field === "known" ? option : field
						if (replacement !== "budget" && !within(b, active.budget))
							return false
						if (replacement !== "boxOffice" && !within(o, active.boxOffice))
							return false
						if (
							replacement !== "returns" &&
							active.returns &&
							!(rawBudget > 0 && rawOffice > 0 && rawOffice >= 3 * rawBudget)
						)
							return false
						if (field === "known") return (option === "budget" ? b : o) > 0
						if (field === "returns")
							return (
								rawBudget > 0 &&
								rawOffice > 0 &&
								(option === "hit"
									? rawOffice >= 3 * rawBudget
									: rawOffice < rawBudget)
							)
					} else {
						if (movie) return false
						if (field !== "seasons" && !within(s, active.seasons)) return false
						if (field !== "hours" && !within(h, active.hours)) return false
						if (field !== "status" && active.showStatus && status !== 2)
							return false
						if (field === "status")
							return status === { running: 1, ended: 2, canceled: 3 }[option]
					}
					const stops =
						field === "budget"
							? BUDGET_STEPS
							: field === "boxOffice"
								? BOX_OFFICE_STEPS
								: field === "seasons"
									? SEASONS_STEPS
									: HOURS_STEPS
					const value =
						field === "budget"
							? b
							: field === "boxOffice"
								? o
								: field === "seasons"
									? s
									: h
					return (
						value > 0 &&
						value >= stops[Number(option)] &&
						value < (stops[Number(option) + 1] ?? Infinity)
					)
				}).length
				assert.equal(count, expected, `${group}:${key}, limited=${limited}`)
			}
		}
	}
})

test("budget and show presets have disjoint inclusive seams", async () => {
	const { BUDGET_PRESETS, SEASONS_PRESETS, HOURS_PRESETS } = await import(
		"~/domain/title-scales"
	)
	for (const [presets, values] of [
		[BUDGET_PRESETS, [0.01, 4.999, 5, 49.999, 50, 99.999, 100, 1000]],
		[SEASONS_PRESETS, [1, 2, 3, 4, 7, 8, 254]],
		[
			HOURS_PRESETS,
			[1 / 60, 599 / 60, 10, 1799 / 60, 30, 5999 / 60, 100, 1000],
		],
	] as const) {
		for (const value of values)
			assert.equal(
				presets.filter(
					(p: { range: { min?: number; max?: number } }) =>
						value >= (p.range.min ?? 0) && value <= (p.range.max ?? Infinity),
				).length,
				1,
			)
	}
})

test("budget and shows counts share one facts pass over 200k titles", async (t) => {
	const { factCounts } = await import("./passes.server.ts")
	const input = {
		...moneyShowsInput(200000),
		budgetCounts: true,
		showsCounts: true,
	}
	const masks = new Uint32Array(input.rows.length)
	const actual = runPasses(input).optionCounts
	const expected = factCounts(input, masks)
	assert.deepEqual(actual.budget, expected.budget)
	assert.deepEqual(actual.shows, expected.shows)
	for (let i = 0; i < 10; i++) factCounts(input, masks)
	const times = Array.from({ length: 9 }, () => {
		const start = performance.now()
		factCounts(input, masks)
		return performance.now() - start
	}).sort((a, b) => a - b)
	t.diagnostic(
		`Budget and Shows median: ${times[4].toFixed(2)} ms over 200k titles`,
	)
	assert.ok(times[4] < 15, `Median ${times[4]} ms exceeded 15 ms`)
})

test("taste groups are any of, count membership including none, and assign only eligible candidates", () => {
	const calls: number[] = []
	const groups = ["movie-1", "show-2"]
	const membership = [groups[0], groups[1], groups[0], null, groups[1], null]
	const filter = (picked: string[]) => ({
		options: groups,
		picked,
		sideOf: (key: number) => {
			const row = key - MOVIE - 1
			calls.push(row)
			return membership[row]
		},
	})
	const counts = passes(plain, { minScore: 70, tasteGroups: filter([]) })
	assert.deepEqual(calls, [0, 2, 4])
	assert.deepEqual(counts.rows, [0, 2, 4])
	assert.deepEqual(counts.optionCounts.tasteGroups, {
		"movie-1": 2,
		"show-2": 1,
		none: 0,
	})
	calls.length = 0
	const one = passes(plain, { tasteGroups: filter([groups[0]]) })
	assert.deepEqual(one.rows, [0, 2])
	assert.deepEqual(one.optionCounts.tasteGroups, {
		"movie-1": 2,
		"show-2": 2,
		none: 2,
	})
	assert.equal(
		one.recoveries.find((r) => r.filter === "tasteGroups")?.titles,
		4,
	)
	assert.deepEqual(
		passes(plain, { tasteGroups: filter(groups) }).rows,
		[0, 1, 2, 4],
	)
	// Correct counts for another filter's removal: only the chosen groups can recover.
	const narrowed = passes(plain, {
		minScore: 80,
		tasteGroups: filter([groups[1]]),
	})
	assert.deepEqual(narrowed.rows, [])
	assert.equal(
		narrowed.recoveries.find((r) => r.filter === "minScore")?.titles,
		2,
	)
	assert.equal(narrowed.optionCounts.minScore["0"], 2)
	assert.equal(narrowed.optionCounts.minScore["70"], 1)
	assert.deepEqual(passes(plain, {}).optionCounts.tasteGroups, {})
})

test("year counts replacing Years and Released still respect taste picks", () => {
	const facts = factsFixture(6)
	const base = passInput({ ...columns, facts }, plain)
	const calls: number[] = []
	const result = runPasses({
		...base,
		releasedCounts: true,
		yearRange: { min: 2000 },
		released: { from: 20000, to: 21000 },
		tasteGroups: {
			options: ["movie-1", "movie-2"],
			picked: ["movie-1"],
			sideOf: (key) => {
				const row = key - MOVIE - 1
				calls.push(row)
				return row % 2 ? "movie-1" : "movie-2"
			},
		},
	})
	assert.deepEqual(calls, plain)
	assert.equal(result.passing.length, 0)
	assert.deepEqual(result.optionCounts.years, { 1921: 1, 1923: 1, 1925: 1 })
})
