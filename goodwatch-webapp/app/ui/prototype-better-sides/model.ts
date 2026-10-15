// PROTOTYPE - throwaway (#657). The better-sides prototype's view model, shared by the server engines and the variants.
// Types only, so browser code can import it.
import type { MoodKey } from "~/domain/moods"
import type { PortraitService, PortraitTitle, SidesView } from "~/server/taste-portrait/view"
import type { TitleKey } from "~/utils/title-key"

export const VARIANTS = {
	today: { name: "Today (production)", style: "reference" },
	tighter: { name: "Tighter sides", style: "existing" },
	anchored: { name: "Named by a title", style: "existing" },
	moods: { name: "Sides as moods", style: "existing" },
	map: { name: "Map of you", style: "bolder" },
} as const
export type VariantKey = keyof typeof VARIANTS
export const isVariant = (v: unknown): v is VariantKey => typeof v === "string" && v in VARIANTS

export type EdgeKind = "country" | "language" | "decade" | "format" | "animation" | "step" | "bridge" | "mood"

export interface ProtoEdge {
	id: string
	kind: EdgeKind
	/** Chip label: "From South Korea", "+ Darkly funny", "Toward Spider-Verse". */
	chip: string
	/** Headline: "Bleak psychological stories, from South Korea". */
	line: string
	/** Why it's a place just past the side, in one sentence. */
	evidence: string
	/** The person's average there; null when they haven't rated any. */
	average: number | null
	count: number
	rated: TitleKey[]
	suggestions: TitleKey[]
	image: TitleKey | null
	/** Bridge edges: the other side. */
	toward?: string
	/** Mood edges: the moods to open in Watch next. */
	moods?: MoodKey[]
	/** Map: where the edge sits (0 to 1). */
	x?: number
	y?: number
}

export interface ProtoSide {
	id: string
	name: string
	/** Short attribute line: "Bleak · Psychological · Melancholy". */
	line: string
	attributes: { key: string; label: string }[]
	moods: MoodKey[]
	hues: string[]
	/** Share of the loved titles (sides may overlap in the moods variant). */
	share: number
	count: number
	average: number
	/** Average minus the person's usual, 1 decimal. */
	lift: number
	anchor: TitleKey | null
	/** Defining titles, most typical first, one per franchise. */
	here: TitleKey[]
	image: TitleKey | null
	edges: ProtoEdge[]
	moreOfThis: TitleKey[]
	/** Titles it shares with other sides (moods, anchored). */
	shared: number
	/** Map: region center and the posters placed on it. */
	x?: number
	y?: number
	dots?: { key: TitleKey; x: number; y: number }[]
}

export interface ProtoMemberInfo {
	slot: string
	label: string
	ratings: number
}

export interface ProtoView {
	variant: VariantKey
	member: ProtoMemberInfo & { rated: number; loved: number; usual: number }
	members: ProtoMemberInfo[]
	/** Production's view (today and tighter render with the production layout). */
	production: SidesView | null
	sides: ProtoSide[]
	/** Loved titles in no side. */
	loose: number
	headline: string | null
	notes: string[]
	titles: Record<string, PortraitTitle>
	services: PortraitService[]
	hasServices: boolean
	personalOrder: { on: boolean; note: string | null }
	computedMs: number
}
