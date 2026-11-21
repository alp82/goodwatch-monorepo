// PROTOTYPE - throwaway (prototype/explore-r6, reworked r7). What the tropes index and a trope page load: shared by
// the `tropes` and `trope` slots. Pure types and helpers, safe in the browser.
import type { Kind } from "../../../../kit/address"
import type { Play, TropeGroupId } from "../../../../kit/tropes"
import { hideBucket } from "~/ui/discover-bar/hide-count"
import type { Person, ShowTitle, Suggestion, TraitWord } from "../../../../kit/types"

/** One title's write-up of the trope: the first point, spoilers marked. */
export interface Example {
	title: ShowTitle
	/** The name the write-up files it under, when it isn't the trope's own. */
	as: string | null
	play: Play
	text: string
	spoilers: [number, number][]
}

export interface TropeRow {
	id: string
	slug: string
	label: string
	line: string
	group: TropeGroupId
	color: string
	/** Well-known titles of the kind that carry it. */
	n: number
	/** Its best-known titles, for the poster fan. */
	posters: ShowTitle[]
	/** One short write-up without spoilers, as a teaser: "In Jaws: ...". */
	teaser: Example | null
}

/**
 * Round 11: the spotlight never changes height ("this should never layout shift"), so it only takes tropes whose
 * name, line and teaser fit its fixed frame, whole, at every width.
 */
export const fitsSpotlight = (r: Pick<TropeRow, "label" | "line" | "teaser" | "posters">) =>
	Boolean(r.teaser && r.teaser.text.length <= 165 && r.label.length <= 24 && r.line.length <= 64) &&
	r.posters.length >= 3

export interface GroupBlock {
	id: TropeGroupId
	name: string
	line: string
	color: string
	tropes: TropeRow[]
}

export interface TropesIndexData {
	kind: Kind
	groups: GroupBlock[]
	/** The trope the page opens on, picked by the day. */
	feature: TropeRow | null
	/** Every trope slug with a page, for "Surprise me". */
	slugs: string[]
}

/** Another trope, as a link. */
export interface TropeLink {
	slug: string
	label: string
	line: string
	color: string
}

/** How often stories twist the trope, in words (see `twistWords`). */
export type TwistBand = "rare" | "sometimes" | "often" | "half"

export interface TropePageData {
	trope: Omit<TropeRow, "teaser"> & { opening: string | null; say: string }
	group: { id: TropeGroupId; name: string; color: string }
	/** How often it's twisted, among every write-up of it (not only the well-known titles). */
	twist: TwistBand
	/** Write-ups of well-known titles: the most watched first, then every twisted one we found. */
	examples: Example[]
	contrast: TropeLink | null
	/** Tropes it meets far more often than chance, strongest first. */
	travels: TropeLink[]
	/** Tropes it meets far less often than chance. */
	rarely: TropeLink[]
	feels: TraitWord[]
	/** Well-known titles per decade, oldest first; `share` against its busiest decade. */
	decades: { label: string; slug: string; n: number; share: number }[]
	/** Well-known titles with the trope that have no write-up shown here (never a repeat of the examples). */
	others: ShowTitle[]
	/** The other tropes of its group, for walking sideways. */
	siblings: { slug: string; label: string }[]
	/** Round 9, for the sections under the examples: each decade with its best-known titles that carry it. */
	timeline: { label: string; slug: string; n: number; share: number; titles: ShowTitle[] }[]
	/** Places it blends well with (moods, genres, decades, countries), each a full page with posters. */
	ways: Suggestion[]
	/** Who makes or stars in the most well-known titles with it. */
	people: Person[]
}

/** The plain words for how stories twist a trope; "straight" is the default and gets none. */
export const TWIST: Record<Exclude<Play, "straight">, string> = {
	subverted: "Set up, then undone",
	inverted: "Roles reversed",
	averted: "Doesn't happen here",
	lampshaded: "A character points it out",
	exaggerated: "Taken to the extreme",
	downplayed: "A milder version",
	"played-with": "A variation on it",
}

export const twistOf = (p: Play): string | null => (p === "straight" ? null : TWIST[p])

export const twistWords: Record<TwistBand, string> = {
	rare: "Almost always played straight",
	sometimes: "Usually played straight",
	often: "Often given a twist",
	half: "Twisted as often as not",
}

export const fmt = (n: number) => n.toLocaleString("en-US")

/** A count as people read it (round 9: never exact counts like 421): Discover's buckets, "400+" when rounded down. */
export const many = (n: number) => {
	const b = hideBucket(n)
	return b.lossy ? `${b.text}+` : b.text
}
