// PROTOTYPE (Discover lab, round 13): You's lab-only choices (taste groups, Outside your usual, On your wishlist,
// Seen before, Taste match 60%+), kept for the page's life. The grid doesn't follow them; the You badge, the Search
// badge and summary, the footer and status chips and Clear all read them here. Not seen yet and Taste match 70/80/90
// are real filters; the real match filter only takes 0, 70, 80, 90 (MIN_MATCHES), so 60 is lab-only.
import { useSyncExternalStore } from "react"

export const GROUP_NAME: Record<string, string> = {
	g1: "Eerie, cerebral sci-fi",
	g2: "Sharp, tense family drama",
	g3: "Gentle, magical animation",
	g4: "Quiet, tender romance",
}

export interface YouExtras {
	groups: string[]
	outside: boolean
	/** Taste match 60%+ (the real minMatch stays 0). */
	sixty: boolean
	wishlist: boolean
	seen: boolean
}
const EMPTY: YouExtras = { groups: [], outside: false, sixty: false, wishlist: false, seen: false }

let extras = EMPTY
const subs = new Set<() => void>()
const subscribe = (f: () => void) => {
	subs.add(f)
	return () => subs.delete(f)
}
export function setYou(patch: Partial<YouExtras>) {
	extras = { ...extras, ...patch }
	for (const f of subs) f()
}
export const youExtras = () => extras
export const useYouExtras = () => useSyncExternalStore(subscribe, youExtras, () => EMPTY)
export const clearYou = () => setYou(EMPTY)

export interface YouChip {
	key: string
	label: string
	/** The filter accent of its dot. */
	group: "minMatch" | "notSeenYet"
	remove: () => void
}

/** One removable chip per lab-only choice that is on. */
export function youChips(x: YouExtras = extras): YouChip[] {
	return [
		...x.groups.map((id): YouChip => ({ key: `group:${id}`, label: GROUP_NAME[id] ?? id, group: "minMatch", remove: () => setYou({ groups: extras.groups.filter((g) => g !== id) }) })),
		...(x.outside ? [{ key: "outside", label: "Outside your usual", group: "minMatch" as const, remove: () => setYou({ outside: false }) }] : []),
		...(x.sixty ? [{ key: "sixty", label: "Match 60%+", group: "minMatch" as const, remove: () => setYou({ sixty: false }) }] : []),
		...(x.wishlist ? [{ key: "wishlist", label: "On your wishlist", group: "notSeenYet" as const, remove: () => setYou({ wishlist: false }) }] : []),
		...(x.seen ? [{ key: "seen", label: "Seen before", group: "notSeenYet" as const, remove: () => setYou({ seen: false }) }] : []),
	]
}
export const youCount = () => youChips().length
