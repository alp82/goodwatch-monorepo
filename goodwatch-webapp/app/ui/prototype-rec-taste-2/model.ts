// PROTOTYPE - throwaway. Types for /prototype/rec-taste-2: a taste report computed on the server
// from someone's ratings, Wishlist, skipped and watched titles, and the title analysis (fingerprint) of each.
import type { PoolItem, Service } from "~/ui/prototype-rec-taste/model"

export type { Service }

/** A title as the client sees it: round 1's PoolItem (fingerprint stripped) plus a few extras. */
export type Title = PoolItem & {
	votes: number
	countries: string[]
	lang: string
	contexts: string[]
	cast: string[]
	mine?: number // the person's own rating, 1-10
	fav?: boolean
}

export type Ref = { key: string; match: number }

export type Attr = {
	key: string
	label: string
	phrase: string
	color: string
	emoji: string
	value: number
}

export type Trait = Attr & { evidence: string[] }

export type Side = {
	id: string
	name: string
	attrs: string[] // attribute keys, strongest first
	share: number // share of loved titles, 0-1
	avg: number
	titles: string[]
	picks: Ref[]
}

export type Frontier = {
	id: string
	kind: "country" | "attr" | "decade" | "language"
	name: string
	headline: string
	line: string
	evidence: string[]
	picks: Ref[]
}

export type Era = {
	decade: number
	count: number
	avg: number
	top: string[]
	trait: string | null
	picks: Ref[]
}

export type Mood = {
	id: string
	name: string
	line: string
	count: number
	avg: number
	delta: number
	top: string[]
	picks: Ref[]
}

export type PersonStat = {
	name: string
	count: number
	avg: number
	keys: string[]
}

export type CrowdRow = {
	key: string
	mine: number
	crowd: number
	delta: number
}

export type FriendReport = {
	id: string
	name: string
	blurb: string
	archetype: string
	overlap: number // 0-100
	shared: string[] // attr keys you both lean into
	split: { key: string; me: number; them: number }[]
	both: { key: string; me: number; them: number }[] // unseen by both, good for both
	agree: { key: string; me: number; them: number }[] // rated by both, close scores
	disagree: { key: string; me: number; them: number }[]
	canon: string[]
	vector: number[] // aligned with Report.vector order
}

export type Report = {
	who: {
		mode: "me" | "demo"
		fellBack: boolean // asked for "me" but not signed in
		name: string
		handle: string | null
		rated: number
		watched: number
		wish: number
		skipped: number
		favorites: number
		since: number | null
		avg: number
		country: string
	}
	archetype: { name: string; line: string }
	portrait: string[] // a few sentences about the person
	vector: Attr[] // all 74 attributes in fingerprint order
	loves: Trait[]
	avoids: Trait[]
	canon: { key: string; why: string[]; reason: string; next: Ref[] }[]
	attrEvidence: Record<string, string[]>
	sides: Side[]
	contradiction: { a: string; b: string; text: string } | null
	crowd: {
		offset: number // average (your score x10) - GoodWatch score
		agreement: number // correlation, -1..1
		higher: CrowdRow[]
		lower: CrowdRow[]
		attrs: { key: string; delta: number; count: number }[]
		genres: { name: string; delta: number; count: number }[]
		stance: string
	}
	frontiers: Frontier[]
	eras: Era[]
	drift: {
		toward: string[]
		away: string[]
		recent: string[]
		since: number
	} | null
	moods: Mood[]
	people: {
		directors: PersonStat[]
		actors: PersonStat[]
		countries: PersonStat[]
		languages: PersonStat[]
	}
	picks: Ref[]
	friends: FriendReport[]
}

export type Payload = {
	report: Report
	items: Record<string, Title>
	services: Service[]
}
