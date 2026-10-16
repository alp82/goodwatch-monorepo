// PROTOTYPE - throwaway (#660). The Sides-of-you-on-Home prototype's view model. Types and pure helpers only, so
// browser code can import it.
import type { MoodKey } from "~/domain/moods"
import type { TvListTitle } from "~/ui/living-room/tv/TitleList"
import type { TvHomeData } from "~/ui/living-room/tv/tv-home"

export const VARIANTS = {
	tiles: { name: "Side tiles in the home row", style: "existing" },
	rows: { name: "A row per side", style: "existing" },
	tonight: { name: "A side for tonight", style: "existing" },
	channels: { name: "Sides as channels", style: "bolder" },
} as const
export type VariantKey = keyof typeof VARIANTS
export const isVariant = (v: unknown): v is VariantKey => typeof v === "string" && v in VARIANTS

export type HomePick = TvListTitle & {
	/** On one of the member's services. */
	streams: boolean
}

export interface HomeSide {
	id: string
	/** 1-based, in the engine's order (largest side first). */
	n: number
	/** Behind the words gate (#656): shown only with Names on. */
	name: string
	/** Attribute words ("Bleak · Psychological · Melancholy"): also behind the gate. */
	line: string
	/** Share of the loved titles, 0 to 1. */
	share: number
	count: number
	/** The side's own loved titles, most typical first, one per franchise. */
	loved: TvListTitle[]
	/** The two best-known of them: the names-off title ("Like Se7en and Zodiac"). */
	known: string[]
	/** Unseen titles of the side, in the member's personal order. */
	picks: HomePick[]
	/** The picks are the ones on the member's services. */
	onServices: boolean
	/** The moods Watch next opens with for this side. */
	moods: { key: MoodKey; name: string }[]
	/** Edge sentences: behind the gate. */
	edges: { chip: string; line: string }[]
	backdrop: string | null
	/** Where the side's best pick stands in personal order across all sides' picks (0 is the best). */
	rank: number
}

export interface SidesHomeView {
	member: { slot: string; label: string; ratings: number; loved: number }
	members: { slot: string; label: string; ratings: number }[]
	home: TvHomeData
	sides: HomeSide[]
	loose: number
	/** The member is under Home's floor: no sides on Home. */
	floor: boolean
	hasServices: boolean
	headline: string | null
	personalOrder: { on: boolean; note: string | null }
	computedMs: number
}

/** "A third of what you love": the side's summary, its share in words a TV reads at a glance. */
export function shareWords(share: number): string {
	const pct = Math.round(share * 100)
	if (pct >= 60) return "Most of what you love"
	if (pct >= 45) return "Half of what you love"
	if (pct >= 30) return "A third of what you love"
	if (pct >= 22) return "A quarter of what you love"
	if (pct >= 15) return "A fifth of what you love"
	return "A small part of what you love"
}

/**
 * How a side is called on screen. With names on, its contrasted name. Without, it's named only by grouping: the
 * loved titles it holds ("Like Se7en and Zodiac"), which says what is in it without describing the person.
 */
export function sideTitle(side: HomeSide, names: boolean): string {
	if (names && side.name) return side.name
	const [a, b] = (side.known.length ? side.known : side.loved.map((t) => t.title)).map(short)
	if (!a) return `Side ${side.n}`
	// The whole title stays short enough for one line of a row's header.
	return b && `Like ${a} and ${b}`.length <= 34 ? `Like ${a} and ${b}` : `Like ${a}`
}

/** A title's main name: "Robin Hood: Men in Tights" is "Robin Hood". */
const short = (title: string) => title.split(/: | - | \(/)[0].trim()

/** The Watch next address a side opens: the Wishlist's top under the side's moods. */
export function watchNextHref(side: HomeSide): string {
	return side.moods.length ? `/watch-next?moods=${side.moods.map((m) => m.key).join(",")}` : "/watch-next"
}
