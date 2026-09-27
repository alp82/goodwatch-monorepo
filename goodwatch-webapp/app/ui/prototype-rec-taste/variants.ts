// PROTOTYPE - throwaway. The Taste page variants, in switcher order.
import type { ComponentType } from "react"
import type { Taste } from "./useTaste"
import Deck from "./variants/Deck"
import Hub from "./variants/Hub"
import Map from "./variants/Map"
import Mirror from "./variants/Mirror"
import Rapid from "./variants/Rapid"
import Split from "./variants/Split"
import Tuner from "./variants/Tuner"
import Wall from "./variants/Wall"

export type Variant = { name: string; style: "existing" | "bolder"; View: ComponentType<{ taste: Taste }> }

export const VARIANTS: Record<string, Variant> = {
	hub: { name: "Every-visit hub", style: "existing", View: Hub },
	wall: { name: "Triage wall", style: "existing", View: Wall },
	split: { name: "Live preview", style: "existing", View: Split },
	deck: { name: "Swipe deck", style: "existing", View: Deck },
	tuner: { name: "Taste dials", style: "existing", View: Tuner },
	mirror: { name: "Taste portrait", style: "bolder", View: Mirror },
	rapid: { name: "Rapid fire", style: "bolder", View: Rapid },
	map: { name: "Taste map", style: "bolder", View: Map },
}
