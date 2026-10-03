// The islands of every Explorer grouping and the rule that puts a title on each: the one place to read or change them.
// The machinery that turns these into layouts is in groupings.server.ts.
//
// How to read a rule:
// - Mood, Theme, Style: `level` works a number out of a title's fingerprint scores (each 0 to 10), and the title sits
//   on the island when that number is at least `from`. `Math.max(a, b)` means either score counts, `Math.min(a, b)`
//   means both must be high, and `x <= n ? ... : 0` keeps titles out when x is above n. A `+ 1` or `- 1` next to a
//   score loosens or tightens that score by one step against `from`.
//   Style's Animated and Documentary go by TMDB genre instead: level 10 with the genre, 0 without.
// - Occasion: any of the listed title-analysis flags.
// - Decade: the release year. Your taste: the viewer's match.
// - Country has no list: every origin country with at least MIN_COUNTRY pool titles gets an island.
//
// An island's titles are ordered by how well they fit it together with how good and well known they are (FIT_WEIGHT).
// Each layout build logs "Explorer <grouping> islands: ..." with every island's size, any threshold that moved, and
// the share of the pool that sits on an island.
import type { CoreScores } from "~/server/utils/fingerprint"
import type { OccasionFlag } from "./pool.server"

export interface IslandDef {
	id: string
	name: string
	color: string
}

/**
 * How much a title's fit to an island counts against its quality when the island's titles are ordered, 0 to 1. Fit is
 * the title's rank on the island by its level (Mood, Theme, Style) and by how typical it is of the island's titles.
 * At 0 the best-known titles lead every island they sit on.
 */
export const FIT_WEIGHT = 0.6

// Mood, Theme, and Style islands come from the fingerprint. Each island has a level, 0 to 10 or so, worked out from a
// title's scores, and takes the titles at or above `from`. These are Explorer's own islands: Watch next's moods (the
// moods module) are a different, smaller set with their own rules.
//
// What keeps the islands apart, so that combining two shows something worth finding (Funny + Scary, Romantic + Dark):
// - One island, one idea: each island stands on a score of its own, and no score feeds two islands, in its own
//   grouping or another (the surreal is Trippy in Mood, so Style has no island for it).
// - Where two ideas share most of their titles, the narrower one leaves the other's titles out: Tense is suspense
//   without action or horror (Thrilling and Scary hold those), History is the past without war.
// - No other island is kept out of another, so any two can share titles; Cozy alone also asks for nothing grim.
// - Names are one or two plain words.
export type Score = (key: keyof CoreScores) => number

export interface RuleIsland extends IslandDef {
	level: (score: Score, genres: readonly string[]) => number
	from: number
}

export const humor = (s: Score) =>
	Math.max(
		s("situational_comedy"),
		s("wit_wordplay"),
		s("physical_comedy"),
		s("absurdist_humor"),
		s("satire_parody"),
	)

// Mood: how a title feels to watch.
export const MOODS: RuleIsland[] = [
	{
		id: "funny",
		name: "Funny",
		color: "#e2cf55",
		level: (s) => humor(s),
		from: 8,
	},
	{
		id: "cozy",
		name: "Cozy",
		color: "#8ccf4d",
		level: (s) =>
			s("bleakness") <= 3 ? Math.min(s("wholesome"), s("hopefulness")) : 0,
		from: 7,
	},
	{
		id: "romantic",
		name: "Romantic",
		color: "#e0607e",
		level: (s) => s("romance"),
		from: 8,
	},
	{
		id: "thrilling",
		name: "Thrilling",
		color: "#e8793d",
		level: (s) => s("adrenaline"),
		from: 8,
	},
	{
		id: "tense",
		name: "Tense",
		color: "#5b7fa8",
		level: (s) => (s("adrenaline") <= 6 && s("scare") <= 6 ? s("tension") : 0),
		from: 8,
	},
	{
		id: "scary",
		name: "Scary",
		color: "#7fae3a",
		level: (s) => s("scare"),
		from: 7,
	},
	{
		id: "sad",
		name: "Sad",
		color: "#7cc4e8",
		level: (s) => s("pathos"),
		from: 8,
	},
	{
		id: "dark",
		name: "Dark",
		color: "#6a5aa8",
		level: (s) => s("bleakness"),
		from: 8,
	},
	{
		id: "trippy",
		name: "Trippy",
		color: "#9b7bea",
		level: (s) => Math.max(s("surrealism"), s("psychedelic")),
		from: 6,
	},
	{
		id: "deep",
		name: "Deep",
		color: "#3fc1b0",
		level: (s) => s("philosophical"),
		from: 8,
	},
	{
		id: "magical",
		name: "Magical",
		color: "#e9a23b",
		level: (s) => s("wonder"),
		from: 8,
	},
	{
		id: "quirky",
		name: "Quirky",
		color: "#b98a5a",
		level: (s) => s("eccentricity"),
		from: 8,
	},
]

// Theme: what a title is about.
export const THEMES: RuleIsland[] = [
	{
		id: "crime",
		name: "Crime",
		color: "#c2413a",
		level: (s) => s("crime"),
		from: 8,
	},
	{
		id: "mystery",
		name: "Mystery",
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
		name: "Politics",
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
		id: "history",
		name: "History",
		color: "#9c7a52",
		level: (s) => (s("warfare") <= 5 ? s("historical") : 0),
		from: 8,
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
		name: "Family",
		color: "#8ccf4d",
		level: (s) => s("family_dynamics"),
		from: 8,
	},
	{
		id: "mind",
		name: "The mind",
		color: "#9b7bea",
		level: (s) => s("psychological"),
		from: 8,
	},
	{
		id: "showbiz",
		name: "Showbiz",
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
		name: "Money",
		color: "#7fae3a",
		level: (s) => s("class_and_capitalism"),
		from: 7,
	},
	{
		id: "future",
		name: "Future",
		color: "#3fc1b0",
		level: (s) => Math.max(s("futuristic"), s("technology_and_humanity")),
		from: 7,
	},
	{
		id: "fantasy",
		name: "Fantasy",
		color: "#d4508a",
		level: (s) => s("fantasy"),
		from: 7,
	},
]

// Style: how a title looks, sounds, and is told, kept to the essentials. Animated and Documentary are forms the
// fingerprint doesn't score, so they go by TMDB genre: a title has the form or it doesn't.
const DOCUMENTARY_GENRES = ["Documentary", "Reality", "Talk", "News"]
export const STYLES: RuleIsland[] = [
	{
		id: "animated",
		name: "Animated",
		color: "#e38fb8",
		level: (_s, genres) => (genres.includes("Animation") ? 10 : 0),
		from: 10,
	},
	{
		id: "documentary",
		name: "Documentary",
		color: "#9aa3ad",
		level: (_s, genres) =>
			genres.some((g) => DOCUMENTARY_GENRES.includes(g)) ? 10 : 0,
		from: 10,
	},
	{
		id: "spectacle",
		name: "Spectacle",
		color: "#e8793d",
		level: (s) => s("spectacle"),
		from: 8,
	},
	{
		id: "stylized",
		name: "Stylized",
		color: "#d4508a",
		level: (s) => s("visual_stylization"),
		from: 8,
	},
	{
		id: "music",
		name: "Music",
		color: "#e2cf55",
		level: (s) => Math.max(s("music_centrality"), s("sound_centrality") - 1),
		from: 7,
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
		name: "Fast-paced",
		color: "#c2413a",
		level: (s) => s("fast_pace"),
		from: 8,
	},
	{
		id: "talky",
		name: "Talky",
		color: "#b98a5a",
		level: (s) => s("dialogue_centrality"),
		from: 8,
	},
	{
		id: "nonlinear",
		name: "Nonlinear",
		color: "#8e62d6",
		level: (s) => s("non_linear_narrative"),
		from: 7,
	},
	{
		id: "graphic",
		name: "Graphic",
		color: "#7fae3a",
		level: (s) => Math.max(s("grotesque"), s("violence") - 1),
		from: 8,
	},
]

// Occasion: who and what a title suits, from the title analysis's suitability and viewing-context flags. A title sits
// on an island when any of the island's flags is set.
export const OCCASIONS: (IslandDef & { flags: OccasionFlag[] })[] = [
	{
		id: "date",
		name: "Date night",
		color: "#e0607e",
		flags: ["suitability_date_night", "suitability_partner"],
	},
	{
		id: "family",
		name: "Family",
		color: "#7cc4e8",
		flags: ["suitability_family", "suitability_intergenerational"],
	},
	{
		id: "friends",
		name: "Friends",
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
		name: "Solo",
		color: "#5b7fa8",
		flags: ["suitability_solo_watch"],
	},
	{
		id: "kids",
		name: "Kids",
		color: "#8ccf4d",
		flags: ["suitability_kids"],
	},
	{
		id: "teens",
		name: "Teens",
		color: "#3fc1b0",
		flags: ["suitability_teens"],
	},
	{
		id: "comfort",
		name: "Comfort",
		color: "#b98a5a",
		flags: ["context_is_comfort_watch"],
	},
	{
		id: "binge",
		name: "Binge",
		color: "#c2413a",
		flags: ["context_is_binge_friendly"],
	},
	{
		id: "background",
		name: "Background",
		color: "#9aa3ad",
		flags: ["context_is_background_friendly"],
	},
	{
		id: "escape",
		name: "Escape",
		color: "#9b7bea",
		flags: ["context_is_pure_escapism"],
	},
	{
		id: "dropin",
		name: "Easy watch",
		color: "#e9a23b",
		flags: ["context_is_drop_in_friendly"],
	},
]

// An island that takes in more than MOST of the pool says little, and one with less than FEWEST is too thin to browse.
// A rule island's `from` moves up while it's over MOST, or one step down when it's under FEWEST; an occasion over
// TOO_COMMON is left out.
export const MOST = 0.25
export const FEWEST = 0.01
export const TOO_COMMON = 0.5
// A title without a title analysis has fewer scores than this and sits on no rule island.
export const MIN_SCORES = 10

export const DECADES: (IslandDef & { from: number; to: number })[] = [
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
export const PALETTE = [
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
export const REST_COLOR = "#9aa3ad"
export const MIN_COUNTRY = 50
export const REST_OF_WORLD = "rest"
