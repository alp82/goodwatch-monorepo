// PROTOTYPE - throwaway. Shapes shared by the server and browser for /prototype/rec-explorer-3 (#180, round 3).
// Titles travel in round 2's compact shape (W), so round 2's Store and Stage can draw them.
import type { Service } from "~/ui/prototype-rec-taste/model"
import type { W, Who } from "~/ui/prototype-rec-explorer-2/wire"

export type { W, Who }

/** One turn a person can take: where it leads, in words, and the few titles that show it. */
export type Opt = {
	id: string
	/** Short name of the turn, e.g. "Darker and slower". */
	label: string
	/** One sentence on what this turn changes and why these titles are here. */
	line: string
	/** The lead title first, then its companions. */
	items: W[]
	/** Fingerprint distance (1 - cosine over the title analysis) from where the person stands. */
	dist: number
	/** Compass variant: which side of the compass. */
	side?: "n" | "e" | "s" | "w"
	/** Lens variant: which one thing changes. */
	kind?: string
}

export type Turn = {
	/** Where the person stands: a title, or null for "your taste". */
	here: W | null
	hereLine: string
	options: Opt[]
	/** Average fingerprint distance between the offered options' leads (higher = more distinct choices). */
	spread: number
	/** Leap variant: the title that connects here and the jump. */
	bridge?: W | null
	bridgeLine?: string
	ms?: number
}

export type ZoomNode = {
	id: number
	name: string
	/** How this group differs from its siblings, in words. */
	line: string
	count: number
	/** Position inside the parent's circle, -1..1. */
	x: number
	y: number
	r: number
	items: W[]
	leaf: boolean
}
export type ZoomRes = {
	node: { id: number; name: string; line: string; count: number } | null
	kids: ZoomNode[]
	/** At the finest level: a handful of titles, each with why it's here. */
	titles: (W & { why: string })[]
	spread: number
	ms?: number
}

export type Loaded3 = {
	who: Who
	services: Service[]
	variant: string
}

export type PeekInfo = { why: string; people: string[]; role: string }
