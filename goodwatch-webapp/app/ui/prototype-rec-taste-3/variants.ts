// PROTOTYPE - throwaway. Round 3's takes on two sections, in switcher order: five on Sides (with Frontiers
// merged in as each side's edge) and two refinements of You vs everyone. ?variant= picks one; the other
// section keeps its first take.
import type { ComponentType } from "react"
import type { View3Props } from "./kit3"
import Deck from "./variants/Deck"
import Duel from "./variants/Duel"
import Focus from "./variants/Focus"
import Horizon from "./variants/Horizon"
import Ledger from "./variants/Ledger"
import Steps from "./variants/Steps"
import Verdicts from "./variants/Verdicts"

export type Variant = {
	name: string
	style: "existing" | "bolder"
	section: "sides" | "crowd"
	View: ComponentType<View3Props>
}

export const VARIANTS: Record<string, Variant> = {
	focus: {
		name: "Sides: one at a time",
		style: "existing",
		section: "sides",
		View: Focus,
	},
	ledger: {
		name: "Sides: side and edge",
		style: "existing",
		section: "sides",
		View: Ledger,
	},
	steps: {
		name: "Sides: how far to go",
		style: "existing",
		section: "sides",
		View: Steps,
	},
	horizon: {
		name: "Sides: horizon",
		style: "bolder",
		section: "sides",
		View: Horizon,
	},
	deck: {
		name: "Sides: deck",
		style: "bolder",
		section: "sides",
		View: Deck,
	},
	verdicts: {
		name: "Crowd: verdicts",
		style: "existing",
		section: "crowd",
		View: Verdicts,
	},
	duel: {
		name: "Crowd: hot takes",
		style: "bolder",
		section: "crowd",
		View: Duel,
	},
}

export const DEFAULT_KEY = Object.keys(VARIANTS)[0]

/** The variant a section renders: the chosen one if it belongs to this section, else the section's first. */
export function variantFor(section: "sides" | "crowd", key: string | null) {
	const chosen = key ? VARIANTS[key] : undefined
	if (chosen?.section === section) return chosen
	return Object.values(VARIANTS).find((v) => v.section === section) as Variant
}
