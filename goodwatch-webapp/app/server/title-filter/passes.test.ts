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
	moods: new Uint16Array(SCORES.length),
	themes: new Uint16Array(SCORES.length),
	styles: new Uint16Array(SCORES.length),
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
		productionCountries?: PassInput["productionCountries"]
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

test("the viewer's ladder is their country's, plain ages without a column, and none without ratings", () => {
	assert.deepEqual(ladderFor(snapshotRatings, "de"), {
		country: "DE",
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
		moods: mask(moodMaskOf),
		themes: mask(themeMaskOf),
		styles: mask(styleMaskOf),
	}
}

/** Every group off over `rows` of the columns (-1 is a title the snapshot doesn't hold). */
function passInput(
	c: ReturnType<typeof ruleColumns>,
	rows: number[],
): PassInput {
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
		moods: Uint16Array.from({ length: N }, () => bits(MOOD_KEYS.length)),
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
	assert.equal(FILTER_NAMES.length, 23)
	assert.equal(FILTER_NAMES[18], "content")
	assert.equal(FILTER_NAMES.at(-1), "scoreGap")
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
	assert.deepEqual(passes(plain, { productionCountries: [us] }).rows, [0, 1])
	const result = passes(plain, { productionCountries: [us, gb] })
	assert.deepEqual(result.rows, [0, 1, 2])
	assert.equal(result.optionCounts.productionCountries.US, 2)
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
		assert.deepEqual(out.optionCounts[name], {}) // No extra SQL for option counts.
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
