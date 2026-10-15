// PROTOTYPE - throwaway (#661, map #652). Sides of you on the title page: the view model the server builds and the
// variants read. Types only, so browser code can import it.
import type { MoodKey } from "~/domain/moods"
import type { PortraitTitle } from "~/server/taste-portrait/view"
import type { EdgeKind } from "~/ui/prototype-better-sides/model"
import type { TitleKey } from "~/utils/title-key"

export const VARIANTS = {
	line: { name: "One line in the overview", style: "existing" },
	panel: { name: "Your-side panels under the overview", style: "existing" },
	strip: { name: "All your sides, this title placed", style: "existing" },
	map: { name: "A pin on the map of you", style: "bolder" },
} as const
export type VariantKey = keyof typeof VARIANTS
export const isVariant = (v: unknown): v is VariantKey => typeof v === "string" && v in VARIANTS

/** One of the member's sides, as the title page shows it. */
export interface SideCard {
	id: string
	/** Behind the names toggle (the words gate). */
	name: string
	share: number
	count: number
	/** Its most typical loved titles, one per franchise. */
	here: TitleKey[]
	/** The moods its Watch next link opens with. */
	moods: MoodKey[]
	color: string
	/** Map: region center and its loved titles' dots (0 to 1). */
	x: number
	y: number
	dots: { key: TitleKey; x: number; y: number }[]
	edges: { id: string; kind: EdgeKind; chip: string; x: number; y: number; toward: string | null }[]
}

export type PlacementKind = "on" | "edge" | "none"

export interface Placement {
	kind: PlacementKind
	/** The side it sits on, or the side it sits just past (for a bridge, the first of the two). */
	side: string | null
	/** The member rated it and it is one of the loved titles that make the side. */
	member: boolean
	/** The member's own score, when they rated it. */
	mine: number | null
	/** Rated, and below what counts as loved: the page says so instead of "You're here". */
	lowRated?: boolean
	edge: {
		id: string
		kind: EdgeKind
		/** Behind the names toggle: "From South Korea", "+ Darkly funny". */
		chip: string
		/** Behind the names toggle: "Bleak crime stories, from South Korea". */
		line: string
		/** Behind the names toggle: why it's just past the side. */
		evidence: string
		/** Bridge: the other side. */
		toward: string | null
	} | null
	/** The side's loved titles closest to this title, closest first. For a bridge, the other side's follow in `nearOther`. */
	near: TitleKey[]
	nearOther: TitleKey[]
	/** Unseen titles from the same side (or the same place just past it), in personal order. */
	more: TitleKey[]
	/** Map: where the title's pin goes. */
	pin: { x: number; y: number } | null
	/** Why: the numbers behind the decision, for the prototype's data bar. */
	debug: string
}

export interface MemberInfo {
	slot: string
	label: string
	ratings: number
}

export interface SidesTitleView {
	title: TitleKey
	member: MemberInfo & { loved: number; loose: number }
	members: MemberInfo[]
	sides: SideCard[]
	placement: Placement
	titles: Record<string, PortraitTitle>
	personalOrder: { on: boolean; note: string | null }
	computedMs: number
}

export interface SampleRow {
	group: string
	kind: PlacementKind
	note: string
	keys: TitleKey[]
}

export interface SamplesView {
	member: MemberInfo & { loved: number; loose: number }
	members: MemberInfo[]
	sides: { id: string; name: string; count: number; share: number }[]
	rows: SampleRow[]
	titles: Record<string, PortraitTitle>
	/** Of a sample of popular unseen titles, how many land on, just past, or off every side. */
	spread: Record<PlacementKind, number>
	computedMs: number
}
