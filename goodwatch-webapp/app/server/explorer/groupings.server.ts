// Groupings split the Explorer's pool into islands. A layout is one grouping's islands over the whole pool, before
// the viewer's filters: which islands each title sits on, each island's titles best first, where the islands sit
// (similar islands close together), and what sets each one apart. Layouts that aren't personal are built once per
// snapshot version and kept for 6 hours; Your taste per taste.
import { type Grouping, MAX_ISLANDS } from "~/domain/explorer"
import type { CoreScores } from "~/server/utils/fingerprint"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import {
	DIMENSIONS as D,
	DESCRIPTIVE_KEYS,
	type ExplorerPool,
	OCCASION_FLAGS,
	type OccasionFlag,
} from "./pool.server"
import { normalize, pca2 } from "./positions.server"
import { phraseOf, sentence } from "./words.server"

export interface IslandDef {
	id: string
	name: string
	color: string
}

export interface Layout {
	grouping: Grouping
	islands: IslandDef[]
	/** Titles can sit on several islands (Mood, Theme, Style, Occasion, Genre). */
	multi: boolean
	/** Per pool title, bit j set when it sits on island j. */
	mask: Uint16Array
	/** Per island, its pool titles, best quality first. */
	members: Int32Array[]
	/** Per island, the unit-length mean of its titles' unit vectors, for "between" bridges and pairs. */
	centers: Float64Array[]
	x: number[]
	y: number[]
	apart: string[]
}

const MIN_ISLAND = 3
const KEEP_MS = 6 * 60 * 60 * 1000
const MAX_KEPT = 200

// Genre buckets and the TMDB genres each takes in. A title sits on every bucket one of its genres belongs to.
const GENRES: (IslandDef & { from: string[] })[] = [
	{ id: "animation", name: "Animation", color: "#e38fb8", from: ["Animation"] },
	{
		id: "documentary",
		name: "Documentary and reality",
		color: "#9aa3ad",
		from: ["Documentary", "Reality", "Talk", "News"],
	},
	{ id: "horror", name: "Horror", color: "#7fae3a", from: ["Horror"] },
	{
		id: "scifi",
		name: "Science fiction",
		color: "#3fc1b0",
		from: ["Science Fiction", "Sci-Fi & Fantasy"],
	},
	{
		id: "fantasy",
		name: "Fantasy",
		color: "#9b7bea",
		from: ["Fantasy", "Sci-Fi & Fantasy"],
	},
	{
		id: "war",
		name: "War and history",
		color: "#9a9460",
		from: ["War", "History", "War & Politics", "Western"],
	},
	{ id: "crime", name: "Crime", color: "#c2413a", from: ["Crime"] },
	{
		id: "thriller",
		name: "Mystery and thriller",
		color: "#5b7fa8",
		from: ["Mystery", "Thriller"],
	},
	{ id: "romance", name: "Romance", color: "#e0607e", from: ["Romance"] },
	{ id: "family", name: "Family", color: "#7cc4e8", from: ["Family", "Kids"] },
	{
		id: "action",
		name: "Action and adventure",
		color: "#e8793d",
		from: ["Action", "Adventure", "Action & Adventure"],
	},
	{ id: "comedy", name: "Comedy", color: "#e2cf55", from: ["Comedy"] },
	{
		id: "drama",
		name: "Drama",
		color: "#b98a5a",
		from: ["Drama", "Soap", "Music", "TV Movie"],
	},
]

// Mood, Theme, and Style islands come from the fingerprint. Each island has a level, 0 to 10 or so, worked out from a
// title's scores, and takes the titles at or above `from`. These are Explorer's own islands: Watch next's moods (the
// moods module) are a different, smaller set with their own rules.
type Score = (key: keyof CoreScores) => number

interface RuleIsland extends IslandDef {
	level: (score: Score) => number
	from: number
}

const humor = (s: Score) =>
	Math.max(
		s("situational_comedy"),
		s("wit_wordplay"),
		s("physical_comedy"),
		s("absurdist_humor"),
		s("satire_parody"),
	)

// Mood: how a title feels to watch.
const MOODS: RuleIsland[] = [
	{
		id: "laugh",
		name: "Laugh out loud",
		color: "#e2cf55",
		level: (s) => (s("bleakness") <= 5 ? humor(s) : 0),
		from: 8,
	},
	{
		id: "feelgood",
		name: "Feel-good",
		color: "#8ccf4d",
		level: (s) =>
			s("bleakness") <= 3 ? Math.min(s("wholesome"), s("hopefulness")) : 0,
		from: 7,
	},
	{
		id: "tense",
		name: "Edge of your seat",
		color: "#5b7fa8",
		level: (s) => s("tension"),
		from: 8,
	},
	{
		id: "rush",
		name: "Adrenaline rush",
		color: "#e8793d",
		level: (s) => Math.min(s("adrenaline"), s("fast_pace") + 1),
		from: 8,
	},
	{
		id: "creepy",
		name: "Creepy",
		color: "#7fae3a",
		level: (s) => Math.max(s("scare"), s("uncanny")),
		from: 7,
	},
	{
		id: "cry",
		name: "A good cry",
		color: "#7cc4e8",
		level: (s) => s("pathos"),
		from: 8,
	},
	{
		id: "bittersweet",
		name: "Bittersweet",
		color: "#b98a5a",
		level: (s) => (s("bleakness") <= 6 ? s("melancholy") : 0),
		from: 7,
	},
	{
		id: "dark",
		name: "Dark and heavy",
		color: "#6a5aa8",
		level: (s) => s("bleakness"),
		from: 8,
	},
	{
		id: "head",
		name: "Messes with your head",
		color: "#9b7bea",
		level: (s) =>
			Math.max(
				s("surrealism") + 2,
				Math.min(
					s("complexity"),
					Math.max(s("ambiguity"), s("non_linear_narrative")) + 1,
				),
			),
		from: 8,
	},
	{
		id: "think",
		name: "Makes you think",
		color: "#3fc1b0",
		level: (s) => Math.max(s("philosophical"), s("social_commentary") - 1),
		from: 7,
	},
	{
		id: "wonder",
		name: "Pure wonder",
		color: "#e9a23b",
		level: (s) => s("wonder"),
		from: 8,
	},
	{
		id: "twisted",
		name: "Twisted fun",
		color: "#c2413a",
		level: (s) => s("dark_humor"),
		from: 7,
	},
	{
		id: "weird",
		name: "Wonderfully weird",
		color: "#d4508a",
		level: (s) => Math.max(s("eccentricity"), s("absurdist_humor")),
		from: 8,
	},
	{
		id: "steamy",
		name: "Steamy",
		color: "#e0607e",
		level: (s) => s("eroticism"),
		from: 6,
	},
]

// Theme: what a title is about.
const THEMES: RuleIsland[] = [
	{
		id: "crime",
		name: "Crime",
		color: "#c2413a",
		level: (s) => s("crime"),
		from: 8,
	},
	{
		id: "mystery",
		name: "Mysteries",
		color: "#5b7fa8",
		level: (s) => s("mystery"),
		from: 8,
	},
	{
		id: "war",
		name: "War",
		color: "#9a9460",
		level: (s) => s("warfare"),
		from: 7,
	},
	{
		id: "politics",
		name: "Power and politics",
		color: "#8e62d6",
		level: (s) => s("political"),
		from: 7,
	},
	{
		id: "true",
		name: "True stories",
		color: "#b98a5a",
		level: (s) => s("biographical"),
		from: 6,
	},
	{
		id: "growing",
		name: "Growing up",
		color: "#7cc4e8",
		level: (s) => s("coming_of_age"),
		from: 8,
	},
	{
		id: "family",
		name: "Family ties",
		color: "#8ccf4d",
		level: (s) => s("family_dynamics"),
		from: 8,
	},
	{
		id: "mind",
		name: "Inside the mind",
		color: "#9b7bea",
		level: (s) => s("psychological"),
		from: 8,
	},
	{
		id: "showbiz",
		name: "Fame and showbiz",
		color: "#e2cf55",
		level: (s) => s("showbiz"),
		from: 6,
	},
	{
		id: "sports",
		name: "Sports",
		color: "#e8793d",
		level: (s) => s("sports"),
		from: 6,
	},
	{
		id: "money",
		name: "Rich and poor",
		color: "#7fae3a",
		level: (s) => s("class_and_capitalism"),
		from: 7,
	},
	{
		id: "tech",
		name: "Tech and the future",
		color: "#3fc1b0",
		level: (s) => Math.max(s("technology_and_humanity"), s("futuristic")),
		from: 7,
	},
	{
		id: "magic",
		name: "Magic and myth",
		color: "#d4508a",
		level: (s) => s("fantasy"),
		from: 7,
	},
	{
		id: "past",
		name: "Long ago",
		color: "#9c7a52",
		level: (s) => s("historical"),
		from: 8,
	},
]

// Style: how a title looks, sounds, and is told.
const STYLES: RuleIsland[] = [
	{
		id: "spectacle",
		name: "Big spectacle",
		color: "#e8793d",
		level: (s) => s("spectacle"),
		from: 8,
	},
	{
		id: "visual",
		name: "Eye candy",
		color: "#d4508a",
		level: (s) => s("visual_stylization"),
		from: 8,
	},
	{
		id: "music",
		name: "Music up front",
		color: "#e2cf55",
		level: (s) => s("music_centrality"),
		from: 7,
	},
	{
		id: "sound",
		name: "Sound you feel",
		color: "#3fc1b0",
		level: (s) => s("sound_centrality"),
		from: 8,
	},
	{
		id: "immersive",
		name: "Worlds to get lost in",
		color: "#9b7bea",
		level: (s) => s("world_immersion"),
		from: 9,
	},
	{
		id: "slow",
		name: "Slow burn",
		color: "#5b7fa8",
		level: (s) => s("slow_burn"),
		from: 8,
	},
	{
		id: "fast",
		name: "Non-stop",
		color: "#c2413a",
		level: (s) => s("fast_pace"),
		from: 8,
	},
	{
		id: "talk",
		name: "All about the talk",
		color: "#b98a5a",
		level: (s) => s("dialogue_centrality"),
		from: 8,
	},
	{
		id: "puzzle",
		name: "Told out of order",
		color: "#8e62d6",
		level: (s) => s("non_linear_narrative"),
		from: 7,
	},
	{
		id: "dream",
		name: "Like a dream",
		color: "#7cc4e8",
		level: (s) => Math.max(s("surrealism"), s("psychedelic")),
		from: 6,
	},
	{
		id: "meta",
		name: "Knows it's a movie",
		color: "#e9a23b",
		level: (s) => s("meta_narrative"),
		from: 7,
	},
	{
		id: "camp",
		name: "Over the top",
		color: "#e0607e",
		level: (s) => s("camp_and_irony"),
		from: 7,
	},
	{
		id: "real",
		name: "Raw and real",
		color: "#9aa3ad",
		level: (s) => s("contemporary_realism"),
		from: 9,
	},
	{
		id: "gross",
		name: "Not for the squeamish",
		color: "#7fae3a",
		level: (s) => Math.max(s("grotesque"), s("violence") - 1),
		from: 8,
	},
]

// Occasion: who and what a title suits, from the title analysis's suitability and viewing-context flags. A title sits
// on an island when any of the island's flags is set.
const OCCASIONS: (IslandDef & { flags: OccasionFlag[] })[] = [
	{
		id: "date",
		name: "Date night",
		color: "#e0607e",
		flags: ["suitability_date_night", "suitability_partner"],
	},
	{
		id: "family",
		name: "Family night",
		color: "#7cc4e8",
		flags: ["suitability_family", "suitability_intergenerational"],
	},
	{
		id: "friends",
		name: "With friends",
		color: "#e8793d",
		flags: ["suitability_friends"],
	},
	{
		id: "party",
		name: "Party",
		color: "#e2cf55",
		flags: ["suitability_group_party"],
	},
	{
		id: "solo",
		name: "Just you",
		color: "#5b7fa8",
		flags: ["suitability_solo_watch"],
	},
	{
		id: "kids",
		name: "For the kids",
		color: "#8ccf4d",
		flags: ["suitability_kids"],
	},
	{
		id: "teens",
		name: "For teens",
		color: "#3fc1b0",
		flags: ["suitability_teens"],
	},
	{
		id: "comfort",
		name: "Comfort watch",
		color: "#b98a5a",
		flags: ["context_is_comfort_watch"],
	},
	{
		id: "binge",
		name: "Binge it",
		color: "#c2413a",
		flags: ["context_is_binge_friendly"],
	},
	{
		id: "background",
		name: "On in the background",
		color: "#9aa3ad",
		flags: ["context_is_background_friendly"],
	},
	{
		id: "escape",
		name: "Total escape",
		color: "#9b7bea",
		flags: ["context_is_pure_escapism"],
	},
	{
		id: "dropin",
		name: "Easy to drop into",
		color: "#e9a23b",
		flags: ["context_is_drop_in_friendly"],
	},
]

// An island that takes in more than MOST of the pool says little, and one with less than FEWEST is too thin to browse.
// A rule island's `from` moves up while it's over MOST, or one step down when it's under FEWEST; an occasion over
// TOO_COMMON is left out.
const MOST = 0.25
const FEWEST = 0.01
const TOO_COMMON = 0.5
const MISSING = 255
// A title without a title analysis has fewer scores than this and sits on no rule island.
const MIN_SCORES = 10

const DECADES: (IslandDef & { from: number; to: number })[] = [
	{
		id: "before-1970",
		name: "Before 1970",
		color: "#9c7a52",
		from: 1,
		to: 1969,
	},
	{ id: "1970s", name: "1970s", color: "#c0703c", from: 1970, to: 1979 },
	{ id: "1980s", name: "1980s", color: "#d4508a", from: 1980, to: 1989 },
	{ id: "1990s", name: "1990s", color: "#8e62d6", from: 1990, to: 1999 },
	{ id: "2000s", name: "2000s", color: "#4f86d9", from: 2000, to: 2009 },
	{ id: "2010s", name: "2010s", color: "#37b3a4", from: 2010, to: 2019 },
	{ id: "2020s", name: "2020s", color: "#8ccf4d", from: 2020, to: 9999 },
]

// Your taste: bands of the viewer's match.
export const TASTE_BANDS: (IslandDef & { min: number })[] = [
	{ id: "near", name: "Near you", color: "#f5a524", min: 90 },
	{ id: "close", name: "Close by", color: "#c9a04e", min: 80 },
	{ id: "edges", name: "The edges", color: "#7d8fa3", min: 65 },
	{ id: "far", name: "Unexplored", color: "#6a5aa8", min: 0 },
]

/** Colors for islands without a color of their own (countries), in order. */
const PALETTE = [
	"#5b7fa8",
	"#c2413a",
	"#3fc1b0",
	"#9b7bea",
	"#e8793d",
	"#7fae3a",
	"#b98a5a",
	"#7cc4e8",
	"#e0607e",
	"#e2cf55",
	"#d4508a",
	"#e9a23b",
	"#8e62d6",
]
const REST_COLOR = "#9aa3ad"
const MIN_COUNTRY = 50
export const REST_OF_WORLD = "rest"

// ---------------------------------------------------------------- building a layout

/**
 * A layout from island definitions and, per pool title, the bit mask of the islands it sits on (bit j is defs[j]).
 * Islands with fewer than 3 titles are dropped, then the largest MAX_ISLANDS are kept.
 */
export function buildLayout(
	pool: ExplorerPool,
	grouping: Grouping,
	defs: IslandDef[],
	maskOf: (i: number) => number,
	multi: boolean,
): Layout {
	const n = pool.n
	const raw = new Uint32Array(n)
	const sizes = new Array<number>(defs.length).fill(0)
	for (let i = 0; i < n; i++) {
		const m = maskOf(i)
		raw[i] = m
		for (let j = 0; j < defs.length; j++) if (m & (1 << j)) sizes[j]++
	}
	const kept = defs
		.map((_, j) => j)
		.filter((j) => sizes[j] >= MIN_ISLAND)
		.sort((a, b) => sizes[b] - sizes[a] || a - b)
		.slice(0, MAX_ISLANDS)
		.sort((a, b) => a - b)
	const islands = kept.map((j) => defs[j])
	const mask = new Uint16Array(n)
	const lists: number[][] = kept.map(() => [])
	for (let i = 0; i < n; i++) {
		let m = 0
		kept.forEach((j, at) => {
			if (raw[i] & (1 << j)) {
				m |= 1 << at
				lists[at].push(i)
			}
		})
		mask[i] = m
	}
	const members = lists.map((list) =>
		Int32Array.from(
			list.sort((a, b) => pool.quality[b] - pool.quality[a] || a - b),
		),
	)

	// Island means: of the z-scores for where islands sit and what sets them apart, of the unit vectors for closeness.
	const means = members.map((list) => {
		const v = new Float64Array(D)
		for (const i of list) for (let d = 0; d < D; d++) v[d] += pool.z[i * D + d]
		for (let d = 0; d < D; d++) v[d] /= Math.max(1, list.length)
		return v
	})
	const centers = members.map((list) => {
		const v = new Float64Array(D)
		for (const i of list)
			for (let d = 0; d < D; d++) v[d] += pool.unit[i * D + d]
		return normalize(v)
	})
	const positions = pca2(means)
	return {
		grouping,
		islands,
		multi,
		mask,
		members,
		centers,
		x: positions.map((p) => round3(p[0])),
		y: positions.map((p) => round3(p[1])),
		apart: apartLines(means),
	}
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

/** What sets each island apart: the two attributes its mean exceeds the average island's mean by most. */
function apartLines(means: Float64Array[]): string[] {
	const average = new Float64Array(D)
	for (const v of means)
		for (let d = 0; d < D; d++) average[d] += v[d] / Math.max(1, means.length)
	return means.map((v) =>
		sentence(
			DESCRIPTIVE_KEYS.map((key, d) => ({ key, lead: v[d] - average[d] }))
				.sort((a, b) => b.lead - a.lead)
				.slice(0, 2)
				.map((r) => phraseOf(r.key)),
		),
	)
}

// ---------------------------------------------------------------- the groupings

function genreLayout(pool: ExplorerPool): Layout {
	const bucketsOf = new Map<string, number>()
	GENRES.forEach((g, j) => {
		for (const genre of g.from)
			bucketsOf.set(genre, (bucketsOf.get(genre) ?? 0) | (1 << j))
	})
	return buildLayout(
		pool,
		"genre",
		GENRES,
		(i) => {
			let m = 0
			for (const genre of pool.facts[i].genres) m |= bucketsOf.get(genre) ?? 0
			return m
		},
		true,
	)
}

const KEY_INDEX = Object.fromEntries(
	VALID_FINGERPRINT_KEYS.map((key, k) => [key, k]),
) as Record<keyof CoreScores, number>

function ruleLayout(
	pool: ExplorerPool,
	grouping: Grouping,
	rules: RuleIsland[],
): Layout {
	const n = pool.n
	const R = rules.length
	const levels = new Uint8Array(n * R)
	for (let i = 0; i < n; i++) {
		const fp = pool.snapshot.fingerprintAt(pool.rows[i])
		let present = 0
		for (let k = 0; k < fp.length; k++) if (fp[k] !== MISSING) present++
		if (present < MIN_SCORES) continue
		const score: Score = (key) => {
			const v = fp[KEY_INDEX[key]]
			return v === MISSING ? 0 : v
		}
		for (let j = 0; j < R; j++)
			levels[i * R + j] = Math.max(0, rules[j].level(score))
	}
	const from = rules.map((rule, j) => {
		const sizeAt = (t: number) => {
			let size = 0
			for (let i = 0; i < n; i++) if (levels[i * R + j] >= t) size++
			return size
		}
		let t = rule.from
		while (t < 10 && sizeAt(t) > n * MOST) t++
		if (t === rule.from && sizeAt(t) < n * FEWEST) t--
		return t
	})
	const layout = buildLayout(
		pool,
		grouping,
		rules,
		(i) => {
			let m = 0
			for (let j = 0; j < R; j++) if (levels[i * R + j] >= from[j]) m |= 1 << j
			return m
		},
		true,
	)
	report(pool, layout, (id) => {
		const j = rules.findIndex((rule) => rule.id === id)
		return from[j] === rules[j].from ? "" : ` from ${from[j]}`
	})
	return layout
}

function occasionLayout(pool: ExplorerPool): Layout {
	const bitOf = new Map(OCCASION_FLAGS.map((flag, bit) => [flag, 1 << bit]))
	const wanted = OCCASIONS.map((o) =>
		o.flags.reduce((m, flag) => m | (bitOf.get(flag) ?? 0), 0),
	)
	const sizes = wanted.map((w) => {
		let size = 0
		for (let i = 0; i < pool.n; i++) if (pool.display[i].occasions & w) size++
		return size
	})
	const layout = buildLayout(
		pool,
		"occasion",
		OCCASIONS,
		(i) => {
			let m = 0
			for (let j = 0; j < wanted.length; j++)
				if (
					sizes[j] <= pool.n * TOO_COMMON &&
					pool.display[i].occasions & wanted[j]
				)
					m |= 1 << j
			return m
		},
		true,
	)
	report(pool, layout, () => "")
	return layout
}

/** Logs a layout's island sizes and how much of the pool sits on an island, once per build, for tuning the rules. */
function report(
	pool: ExplorerPool,
	layout: Layout,
	note: (id: string) => string,
): void {
	let placed = 0
	for (let i = 0; i < pool.n; i++) if (layout.mask[i]) placed++
	console.info(
		`Explorer ${layout.grouping} islands: ${layout.islands
			.map(
				(island, j) =>
					`${island.id} ${layout.members[j].length}${note(island.id)}`,
			)
			.join(
				", ",
			)}; ${Math.round((100 * placed) / Math.max(1, pool.n))}% of ${pool.n} titles on an island`,
	)
}

function decadeLayout(pool: ExplorerPool): Layout {
	return buildLayout(
		pool,
		"decade",
		DECADES,
		(i) => {
			const year = pool.years[i]
			if (!year) return 0
			const j = DECADES.findIndex((d) => year >= d.from && year <= d.to)
			return j < 0 ? 0 : 1 << j
		},
		false,
	)
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
const isCountryCode = (origin: string | null): origin is string =>
	!!origin && /^[A-Z]{2}$/.test(origin)

function countryLayout(pool: ExplorerPool): Layout {
	// Origins are the first production country, else the original language; only countries get islands.
	const counts = new Map<string, number>()
	for (const facts of pool.facts)
		if (isCountryCode(facts.origin))
			counts.set(facts.origin, (counts.get(facts.origin) ?? 0) + 1)
	const countries = [...counts.entries()]
		.filter(([, count]) => count >= MIN_COUNTRY)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, MAX_ISLANDS - 1)
		.map(([code]) => code)
	const defs: IslandDef[] = [
		...countries.map((code, j) => ({
			id: code.toLowerCase(),
			name: regionNames.of(code) ?? code,
			color: PALETTE[j % PALETTE.length],
		})),
		{ id: REST_OF_WORLD, name: "Rest of world", color: REST_COLOR },
	]
	const at = new Map(countries.map((code, j) => [code, j]))
	return buildLayout(
		pool,
		"country",
		defs,
		(i) => 1 << (at.get(pool.facts[i].origin ?? "") ?? countries.length),
		false,
	)
}

/** Your taste: the viewer's match bands; `match[i]` is 0 for a title without a match. */
export function tasteLayout(pool: ExplorerPool, match: Uint8Array): Layout {
	return buildLayout(
		pool,
		"taste",
		TASTE_BANDS,
		(i) => {
			if (!match[i]) return 0
			return 1 << TASTE_BANDS.findIndex((band) => match[i] >= band.min)
		},
		false,
	)
}

// ---------------------------------------------------------------- the shared layouts

const kept = new Map<string, { at: number; layout: Layout }>()

/** A layout that's the same for everyone (every grouping but Your taste), kept for 6 hours per snapshot version. */
export function sharedLayout(
	pool: ExplorerPool,
	grouping: Exclude<Grouping, "taste">,
): Layout {
	return keep(`${pool.version}|${grouping}`, () => {
		if (grouping === "mood") return ruleLayout(pool, "mood", MOODS)
		if (grouping === "theme") return ruleLayout(pool, "theme", THEMES)
		if (grouping === "style") return ruleLayout(pool, "style", STYLES)
		if (grouping === "occasion") return occasionLayout(pool)
		if (grouping === "genre") return genreLayout(pool)
		if (grouping === "decade") return decadeLayout(pool)
		return countryLayout(pool)
	})
}

/** Keeps a layout for 6 hours under a key; the oldest go beyond MAX_KEPT. */
export function keep(key: string, build: () => Layout): Layout {
	const now = Date.now()
	const hit = kept.get(key)
	if (hit && now - hit.at < KEEP_MS) return hit.layout
	const layout = build()
	kept.delete(key)
	kept.set(key, { at: now, layout })
	for (const [k, entry] of kept) {
		if (kept.size <= MAX_KEPT && now - entry.at < KEEP_MS) break
		kept.delete(k)
	}
	return layout
}
