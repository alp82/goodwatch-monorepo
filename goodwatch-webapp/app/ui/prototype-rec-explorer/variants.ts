// PROTOTYPE - throwaway. The Explorer variants, in switcher order.
import type { ComponentType } from "react"
import type { Explorer, FilterMode } from "./useExplorer"
import Atlas from "./variants/Atlas"
import Axes from "./variants/Axes"
import Lens from "./variants/Lens"
import Mine from "./variants/Mine"
import Mosaic from "./variants/Mosaic"
import Seed from "./variants/Seed"
import Stars from "./variants/Stars"
import Steer from "./variants/Steer"

export type Variant = { name: string; style: "existing" | "bolder"; filterMode: FilterMode; View: ComponentType<{ ex: Explorer }> }

export const VARIANTS: Record<string, Variant> = {
	atlas: { name: "Taste atlas", style: "existing", filterMode: "dim", View: Atlas },
	axes: { name: "Pick your axes", style: "existing", filterMode: "hide", View: Axes },
	mine: { name: "Your axes", style: "existing", filterMode: "dim", View: Mine },
	seed: { name: "Start from a title", style: "existing", filterMode: "hide", View: Seed },
	lens: { name: "The lens", style: "existing", filterMode: "dim", View: Lens },
	steer: { name: "Compass", style: "bolder", filterMode: "hide", View: Steer },
	stars: { name: "Night sky", style: "bolder", filterMode: "dim", View: Stars },
	mosaic: { name: "Poster wall", style: "bolder", filterMode: "hide", View: Mosaic },
}
