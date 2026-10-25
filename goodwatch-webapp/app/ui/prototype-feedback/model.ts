// PROTOTYPE - throwaway. What a report can be about, the questions each part of a page asks, and where a report ends
// up: live now (a trusted member's correction), pending review (everyone else's), or a flag (title analysis, scores).
// Everything is in memory; nothing is sent.
import title from "~/ui/prototype-feedback/fixture-title.json"

export type Variant = "A" | "B" | "C"
export type Screen = "title" | "person" | "feedback" | "contact" | "staff"
export type Viewer = "guest" | "member" | "trusted"

export const VARIANTS: Record<Variant, string> = {
	A: "Report links per section, bottom sheet",
	B: "One “Something wrong?” sheet, edit in place",
	C: "Feedback tab: fix mode or send feedback, side panel",
}
export const SCREENS: Record<Screen, string> = {
	title: "Title",
	person: "Person",
	feedback: "Feedback tab",
	contact: "Contact",
	staff: "Staff post",
}
export const VIEWERS: Record<Viewer, string> = {
	guest: "Guest",
	member: "Member",
	trusted: "Trusted",
}

export type Area =
	| "watch"
	| "scores"
	| "analysis"
	| "episodes"
	| "details"
	| "cast"
	| "credits"
	| "person"

export type Problem = {
	id: string
	label: string
	/** Flag-only problems are never applied; staff look at them. */
	flag?: boolean
	/** Always checked by staff, even from trusted members ("Something else"). */
	review?: boolean
	/** The questions after "what's wrong". */
	ask: (
		| "provider"
		| "missingProvider"
		| "country"
		| "offer"
		| "episode"
		| "person"
		| "credit"
		| "source"
		| "date"
	)[]
	/** The suggested value's label; none for a problem that only removes something. */
	suggest?: string
}

export type AreaDef = {
	label: string
	/** The words in the entry point ("Report a problem with where to watch"). */
	what: string
	problems: Problem[]
}

export const AREAS: Record<Area, AreaDef> = {
	watch: {
		label: "Where to watch",
		what: "where to watch",
		problems: [
			{
				id: "not-there",
				label: "It's not on a service listed here",
				ask: ["provider", "country"],
			},
			{
				id: "missing",
				label: "A service has it, but it's missing",
				ask: ["missingProvider", "offer", "country"],
			},
			{
				id: "link",
				label: "A link opens the wrong page",
				ask: ["provider", "country"],
				suggest: "Right link",
			},
		],
	},
	scores: {
		label: "Scores",
		what: "the scores",
		problems: [
			{
				id: "score-wrong",
				label: "A score looks wrong or old",
				ask: ["source"],
				flag: true,
			},
			{
				id: "score-title",
				label: "A score belongs to another title",
				ask: ["source"],
				flag: true,
			},
		],
	},
	analysis: {
		label: "Title analysis",
		what: "the title analysis",
		problems: [
			{
				id: "analysis-off",
				label: "The description doesn't fit",
				ask: [],
				flag: true,
			},
			{
				id: "analysis-scale",
				label: "A scale is off (pace, tone, …)",
				ask: [],
				flag: true,
			},
			{
				id: "analysis-goodfor",
				label: "“Good for” doesn't fit",
				ask: [],
				flag: true,
			},
		],
	},
	episodes: {
		label: "Episodes",
		what: "an episode",
		problems: [
			{
				id: "ep-title",
				label: "Wrong episode title",
				ask: ["episode"],
				suggest: "Right title",
			},
			{
				id: "ep-date",
				label: "Wrong air date",
				ask: ["episode"],
				suggest: "Right date",
			},
			{
				id: "ep-missing",
				label: "An episode is missing",
				ask: ["episode"],
				suggest: "Its title",
			},
			{
				id: "ep-score",
				label: "An episode score looks wrong",
				ask: ["episode"],
				flag: true,
			},
		],
	},
	details: {
		label: "Details",
		what: "the details",
		problems: [
			{
				id: "date",
				label: "Wrong year or date",
				ask: ["date"],
				suggest: "Right date",
			},
			{
				id: "seasons",
				label: "Wrong number of seasons or episodes",
				ask: [],
				suggest: "Right count",
			},
			{ id: "about", label: "The description is wrong", ask: [], flag: true },
		],
	},
	cast: {
		label: "Cast and crew",
		what: "cast and crew",
		problems: [
			{
				id: "character",
				label: "Wrong character name",
				ask: ["person"],
				suggest: "Right name",
			},
			{ id: "not-in-it", label: "Someone isn't in it", ask: ["person"] },
			{
				id: "missing-person",
				label: "Someone is missing",
				ask: [],
				suggest: "Name and role",
			},
		],
	},
	credits: {
		label: "Credits",
		what: "their credits",
		problems: [
			{ id: "not-theirs", label: "A title isn't theirs", ask: ["credit"] },
			{
				id: "role",
				label: "Wrong role or character",
				ask: ["credit"],
				suggest: "Right role",
			},
			{
				id: "missing-credit",
				label: "A title is missing",
				ask: [],
				suggest: "Title and year",
			},
		],
	},
	person: {
		label: "Details",
		what: "their details",
		problems: [
			{
				id: "department",
				label: "Wrong main job",
				ask: [],
				suggest: "Right job",
			},
			{
				id: "career",
				label: "Wrong career years",
				ask: [],
				suggest: "Right years",
			},
			{ id: "photo", label: "Wrong photo", ask: [], flag: true },
		],
	},
}

export const TITLE_AREAS: Area[] = [
	"watch",
	"scores",
	"analysis",
	"episodes",
	"details",
	"cast",
]
export const PERSON_AREAS: Area[] = ["credits", "person"]

/** Every chip list ends with "Something else", which opens a free-text field. */
export const SOMETHING_ELSE = "Something else"

/** The area's problems, ending with "Something else" (a flag where the area only takes flags, else staff review it). */
export function problemsOf(area: Area): Problem[] {
	const list = AREAS[area].problems
	const flagOnly = list.every((p) => p.flag)
	return [
		...list,
		{
			id: "other",
			label: SOMETHING_ELSE,
			ask: [],
			flag: flagOnly || undefined,
			review: true,
		},
	]
}

export type Outcome = "live" | "pending" | "flag"
export function outcomeOf(problem: Problem, viewer: Viewer): Outcome {
	if (problem.flag) return "flag"
	if (problem.review) return "pending"
	return viewer === "trusted" ? "live" : "pending"
}

/** A trusted fix only goes live when every answer was picked from the page; a typed "Something else" waits for staff. */
export function outcomeOfDraft(d: Draft, viewer: Viewer): Outcome | null {
	if (!d.problem) return null
	const o = outcomeOf(d.problem, viewer)
	return o === "live" && Object.values(d.others).some((v) => v?.trim())
		? "pending"
		: o
}

export const OUTCOME_COPY: Record<Outcome, { title: string; body: string }> = {
	live: {
		title: "Fixed. Thanks!",
		body: "Your change is on the page now. Staff can see it, and you can undo it.",
	},
	pending: {
		title: "Thanks, we'll review it",
		body: "Someone on the team checks it, usually within a few days.",
	},
	flag: {
		title: "Thanks, we'll take a look",
		body: "This part isn't edited by hand. We check the source and fix the match.",
	},
}

/** Streaming services for "missing": real TMDB entries (ids and logos), most common first. */
export const OTHER_SERVICES = [
	{
		tmdb_id: 8,
		name: "Netflix",
		logo: "/rK1KljqmbvO9HQa1PBFLILWah72.png",
		order_default: 0,
	},
	{
		tmdb_id: 1899,
		name: "HBO Max",
		logo: "/skypuy7SXuugIQeYg0IglmzoKaS.png",
		order_default: 153,
	},
	{
		tmdb_id: 9,
		name: "Amazon Prime Video",
		logo: "/gMZdpavHmxFNnLpMHwVxfqeux2g.png",
		order_default: 3,
	},
	{
		tmdb_id: 350,
		name: "Apple TV",
		logo: "/9icYBfYFcwgCbky5VdGUIKJ4C5i.png",
		order_default: 4,
	},
]

export const COUNTRIES = [
	["US", "United States"],
	["GB", "United Kingdom"],
	["DE", "Germany"],
	["CA", "Canada"],
	["AU", "Australia"],
] as const

export const SCORE_SOURCES = [
	{ id: "gw", label: "GoodWatch score", value: "84" },
	{ id: "imdb", label: "IMDb", value: "8.5" },
	{ id: "mc", label: "Metacritic critics", value: "83" },
	{ id: "mcu", label: "Metacritic audience", value: "7.7" },
	{ id: "rt", label: "Rotten Tomatoes critics", value: "93%" },
	{ id: "rtu", label: "Rotten Tomatoes audience", value: "79%" },
]

type Grid = {
	seasons: [
		number,
		number,
		[number, string, number | null, number | null][],
		...unknown[],
	][]
}
const grid = title.episodeGrid as unknown as Grid
export const SEASONS = grid.seasons.map((s) => ({
	number: s[0],
	episodes: s[2].map((e) => ({ number: e[0], title: e[1], score: e[2] })),
}))
export const episodeOf = (season: number, episode: number) =>
	SEASONS.find((s) => s.number === season)?.episodes.find(
		(e) => e.number === episode,
	)

export const CAST = title.media.cast.slice(0, 8).map((c) => ({
	id: c.id,
	name: c.name,
	character: c.characters.join(" / "),
	profile_path: c.profile_path,
}))

export const FIRST_AIRED = "June 23, 2022"

/** Everything a report says, filled in step by step. */
export type Draft = {
	area: Area
	problem?: Problem
	provider?: number
	country: string
	offer: "flatrate" | "rent" | "buy"
	season: number
	episode: number
	person?: number
	credit?: string
	source?: string
	suggested: string
	link: string
	note: string
	/** Questions answered with "Something else": the question's key and the typed answer. */
	others: Partial<Record<Question, string>>
}
export type Question =
	| "provider"
	| "offer"
	| "country"
	| "season"
	| "person"
	| "credit"
	| "source"
export const newDraft = (area: Area): Draft => ({
	area,
	country: "US",
	offer: "flatrate",
	season: 1,
	episode: 7,
	suggested: "",
	link: "",
	note: "",
	others: {},
})

export type Correction = {
	id: number
	area: Area
	problem: Problem
	draft: Draft
	outcome: Outcome
	/** What the page showed. */
	before: string
	/** What the member suggested (or "Not there"). */
	after: string
	undone?: boolean
}
