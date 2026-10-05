// PROTOTYPE - throwaway. Data shapes for /prototype/rec-discover (#179).
import type { ProtoTitle } from "~/server/prototype-rec-filter-bar.server"

// A title on a real Discover or Search list, with the person's taste match. It extends the filter bar's
// title so the chosen bar (#175) filters and counts it unchanged. `key` is crafted on the server so the
// bar's "Not seen yet" agrees with the person's real ratings and watch history; use `ref` as the id.
export type DiscTitle = ProtoTitle & {
	ref: string // "movie-603"
	seen: boolean // watched or rated
	rated: number | null // the person's own score
	wish: boolean
	match: number | null // 50..99, from the person's own percentile; null without a title analysis
	pct: number | null // 0..100 percentile within the person's own distribution
	why: string[] // up to two attribute phrases that pull this title toward the person
	against: string | null // the attribute the person usually tunes out, when this title is heavy on it
	like: { title: string; poster_path: string; score: number } | null // the closest title they rated highly
	hits: number[] // raw 0-10 scores for the person's top taste attributes (profile.top order)
	rel: number // search: relevance rank (0 = best); discover: popularity rank
	relScore: number // search: the served score; discover: popularity
}

export type TasteAttr = { key: string; label: string; phrase: string; emoji: string }

export type Who = {
	mode: "me" | "demo"
	fellBack: boolean
	name: string
	rated: number
	liked: number
	disliked: number
	wish: number
	watched: number
}

export type SearchList = { q: string; reading: { text: string; kind: string }[]; titles: DiscTitle[] }

export type Payload = {
	who: Who
	country: string
	mine: number[]
	demoServices: boolean
	top: TasteAttr[] // the person's strongest taste attributes, craft left out
	avoid: TasteAttr[]
	discover: DiscTitle[]
	search: SearchList[]
	ms: number
}
