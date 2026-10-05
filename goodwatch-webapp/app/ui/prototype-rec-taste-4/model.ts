// PROTOTYPE - throwaway. Types for /prototype/rec-taste-4: round 2's taste report plus the few extras the
// third-view candidates need (hidden gems, dealbreakers, the people you keep coming back to).
import type { Payload, Ref } from "~/ui/prototype-rec-taste-2/model"

export type Dealbreaker = {
	key: string // fingerprint attribute
	met: number // titles leaning hard into it that you rated or skipped
	panned: number // of those, the ones you skipped or rated 5 or lower
	lost: string[] // the ones you rated lowest, then famous ones you skipped
	exception: string | null // the one you loved anyway
}

export type Person = {
	name: string
	role: "director" | "actor"
	id: number | null
	portrait: string | null // TMDB profile path
	count: number
	avg: number
	keys: string[] // titles of theirs you rated, best first
	unseen: Ref[] // titles of theirs you haven't seen
}

export type Extra = {
	mu: number // your average rating
	gems: {
		keys: string[] // titles you love that few people have rated, most telling first
		loved: number // how many titles you love
		few: number // how many of those are known by few
		limit: number // "few" means fewer ratings than this
		relative: boolean // too few gems: keys are simply your least-known favorites
		picks: Ref[] // unseen titles known by few, close to your taste
	}
	dealbreakers: Dealbreaker[]
	pannedBase: number // share of everything you skip or rate 5 or lower, 0-1
	people: Person[]
}

export type Payload4 = Payload & { extra: Extra }
