// PROTOTYPE - throwaway. Types for /prototype/rec-taste-3: round 2's taste report plus an edge for each side.
import type { Payload, Ref } from "~/ui/prototype-rec-taste-2/model"

export type * from "~/ui/prototype-rec-taste-2/model"

/** The kind of story just past one side of your taste: close to it, but somewhere you've rarely gone from there. */
export type Edge = {
	key: string // fingerprint attribute
	name: string // "Melancholy", "Sharp dialogue"
	phrase: string // "melancholy"
	rated: number // titles you rated on this side that already lean this way
	of: number // titles you rated on this side
	avg: number | null
	line: string
	evidence: string[] // those titles, best first
	picks: Ref[] // unseen titles close to the side that lean this way
}

export type Payload3 = Payload & {
	edges: Record<string, Edge | null> // by side id
	further: Record<string, string[]> // round 2 frontier ids (country, language, decade) by side id
}
