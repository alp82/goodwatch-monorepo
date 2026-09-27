// PROTOTYPE - throwaway. Types for /prototype/rec-fingerprint (#181): a page whose star is the person's
// aggregated fingerprint, the 74 attribute scores from the title analysis of everything they rated,
// weighted by how they rated it, and read against everyone else's.
import type { Report, Service, Title } from "~/ui/prototype-rec-taste-2/model"

export type { Service, Title }

export type FamilyId = "mood" | "humor" | "world" | "story" | "craft"

export type Family = {
	id: FamilyId
	name: string
	line: string // what the family is about, in plain words
	keys: string[] // attribute keys in fingerprint order
}

/** One attribute of the person's fingerprint. Units of you/crowd/edge match round 2's signature. */
export type FpAttr = {
	key: string
	label: string
	family: FamilyId
	meaning: string // the attribute definition, plain language
	phrase: string // "the surreal"
	noun: string // "surreal trips"
	you: number // the person's signature value
	crowd: number // the same formula over everyone's viewing and scores
	edge: number // you - crowd: how much more (or less) you seek it than most people
	tier: -3 | -2 | -1 | 0 | 1 | 2 | 3 // edge in steps: steer clear .. defining
	share: number // share of your rated titles that carry it strongly (top quarter of all titles for it), 0-1
	crowdShare: number // the same share across what everyone watches, 0-1
	lift: number | null // your average rating for those titles minus your usual, null if too few
	n: number // how many of your rated titles carry it strongly
	carriers: string[] // titles that carry it for you: strong in it and rated at or above your usual
	against: string[] // titles strong in it that you rated lowest or skipped
	exception: string | null // the title that went against your usual stance on it
}

/** A slice of the person's rating history with its own signature. */
export type Period = {
	id: string
	label: string
	sub: string
	count: number
	edge: number[] // aligned with attrs, you - crowd for this period's ratings alone
	top: string[] // the period's best-rated titles
}

/** A title whose fingerprint can be laid over the person's. */
export type Probe = {
	key: string
	kind: "pick" | "loved" | "clash"
	match: number
	z: number[] // the title's fingerprint against the catalog, aligned with attrs, 1 decimal
}

/** An unseen title the recommendation tuner can rank, with its z-scored fingerprint. */
export type Candidate = { key: string; z: number[]; q: number }

export type FriendFp = {
	id: string
	name: string
	blurb: string
	archetype: string
	overlap: number
	edge: number[] // aligned with attrs
	both: { key: string; me: number; them: number }[]
	canon: string[]
}

export type FpPayload = {
	who: Report["who"]
	archetype: Report["archetype"]
	headline: { seek: string[]; avoid: string[] } // attribute keys, strongest first
	families: Family[]
	attrs: FpAttr[] // all 74, fingerprint order
	you: number[] // the raw signature, aligned with attrs, for ranking
	periods: Period[]
	datedPeriods: boolean // false for the demo member, whose periods follow list order
	probes: Probe[]
	candidates: Candidate[]
	friends: FriendFp[]
	items: Record<string, Title>
	services: Service[]
}

export const FAMILY_DEFS: Omit<Family, "keys">[] = [
	{ id: "mood", name: "Mood", line: "How it makes you feel" },
	{ id: "humor", name: "Humor", line: "What makes you laugh" },
	{ id: "world", name: "World", line: "What it's about" },
	{ id: "story", name: "Story", line: "How it's told" },
	{ id: "craft", name: "Craft", line: "How it looks and sounds" },
]

/** The fingerprint's own five groups, in key order: 13, 7, 20, 19 and 15 attributes. */
export const FAMILY_SIZES: Record<FamilyId, number> = {
	mood: 13,
	humor: 7,
	world: 20,
	story: 19,
	craft: 15,
}

export const TIER_WORDS: Record<number, string> = {
	3: "Defining",
	2: "You seek it",
	1: "You lean toward it",
	0: "Neither here nor there",
	[-1]: "You lean away",
	[-2]: "You avoid it",
	[-3]: "You steer clear",
}

/** Seek and avoid colors: a warm/cool diverging pair, CVD-checked on the page surface. Everyone is gray. */
export const SEEK = "#f59e0b"
export const AVOID = "#38bdf8"
export const CROWD = "#9ca3af"
