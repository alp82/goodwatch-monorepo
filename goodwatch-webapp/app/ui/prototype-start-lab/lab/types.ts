// PROTOTYPE (start page lab, 2026-10-27): what a variant of each lab section is, and the lab's shared state.
//
// The guest page is a `layout` variant composing four blocks: Hero, Recs, How and Browse (each the chosen variant of
// its section). Any block may show the room with <Room/> from useLab(): the chosen scene, with the chosen `shelf`
// variant drawing posters into its slots and the chosen `tv` variant drawing the TV hint. Pressing the hint calls
// playIntro(from), and the chosen tv variant's Theater takes over the screen. The member page is one `member`
// variant, which may use <Room/> the same way.
import { createContext, useContext, type ComponentType, type CSSProperties, type ReactNode } from "react"
import type { LabCard, LabData } from "~/server/prototype-start-lab.server"
import type { SceneLayout } from "../scene/SceneStage"
import type { ScenePair, SceneSlot } from "../scene/types"
import type { Choice } from "./choice"

export type { LabCard, LabData }

type Base = {
	/** "a", "b", "c", … unique within the section. */
	key: string
	/** Two to four words, shown in the bar. */
	name: string
}

/** hero, recs, how, browse, member: a block that reads everything it needs from useLab(). */
export type BlockVariant = Base & { C: ComponentType }

/** layout: arranges the guest page's blocks (and decides where the room goes, if a block doesn't). */
export type LayoutVariant = Base & {
	C: ComponentType<{ Hero: ComponentType; Recs: ComponentType; How: ComponentType; Browse: ComponentType }>
}

export type SlotProps = {
	/** The title for this slot; null when there are more slots than titles. */
	card: LabCard | null
	slot: SceneSlot
	index: number
	/** The slot element's size in px (300 wide, the slot's own proportions); the element is transformed onto the slot. */
	size: { w: number; h: number }
}

/** shelf: how live posters meet the scene. Slot draws into each slot in perspective; Overlay draws over the room. */
export type ShelfVariant = Base & {
	Slot?: ComponentType<SlotProps>
	Overlay?: ComponentType<{ cards: LabCard[]; layout: SceneLayout | null }>
}

export type Rect = { left: number; top: number; width: number; height: number }

/** Where the intro starts from: the TV on screen, in viewport px, and the room it sits in. */
export type IntroFrom = {
	/** The TV screen's four corners (TL, TR, BR, BL) in viewport px. */
	tvPoints: [number, number][]
	/** The rectangle around them. */
	tvRect: Rect
	/** The room's box in viewport px, and how the scene image is drawn in it (box px). */
	roomRect: Rect
	image: { src: string; left: number; top: number; width: number; height: number }
}

/** tv: the TV hint in the scene and the full-screen intro it opens. */
export type TvVariant = Base & {
	/** Drawn on the TV screen, in perspective (inside the screen quad). */
	Hint: ComponentType<{ size: { w: number; h: number }; onPlay: () => void }>
	/** Drawn over the room, unrotated, with the TV screen's rect in the room box's px (labels, glows, pointers). */
	Near?: ComponentType<{ tvRect: Rect; onPlay: () => void }>
	/** Full screen. `from` is null when the intro opens without a TV on screen (a plain link). */
	Theater: ComponentType<{ from: IntroFrom | null; onClose: () => void }>
}

export type RoomProps = {
	className?: string
	style?: CSSProperties
	/** The image point (0..1) to keep in view; the TV's center by default. */
	focal?: [number, number]
	/** Above 1 crops closer around the focal point. */
	zoom?: number
	/** Posters for the slots; the lab's shelf titles by default. */
	posters?: LabCard[]
	/** Leave out the TV hint. */
	noTv?: boolean
	/** Leave out the shelf variant's overlay. */
	noOverlay?: boolean
	/** Drawn over the scene, filling the box. */
	children?: ReactNode
	/** Use the phone version when the box's width/height is below this (0.8 by default). */
	portraitBelow?: number
}

export type Lab = {
	data: LabData
	choice: Choice
	/** The chosen scene. */
	scene: ScenePair
	/** The posters the room shows: popular titles until a block replaces them (a search's results, picks). */
	shelfTitles: LabCard[]
	setShelfTitles: (cards: LabCard[]) => void
	/** Opens the chosen tv variant's Theater. */
	playIntro: (from: IntroFrom | null) => void
	Room: ComponentType<RoomProps>
}

export const LabContext = createContext<Lab | null>(null)

export function useLab(): Lab {
	const lab = useContext(LabContext)
	if (!lab) throw new Error("useLab outside the start page lab")
	return lab
}
