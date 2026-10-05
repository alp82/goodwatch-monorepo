// PROTOTYPE - throwaway. The round-3 Explorer variants, in switcher order.
import type { ComponentType } from "react"
import type { Ex3 } from "./useExplorer3"
import Compass from "./variants/Compass"
import Doors from "./variants/Doors"
import Leap from "./variants/Leap"
import Lens from "./variants/Lens"
import Roads from "./variants/Roads"
import Zoom from "./variants/Zoom"

export type Variant = {
	name: string
	style: "existing" | "bolder"
	View: ComponentType<{ ex: Ex3 }>
}

export const VARIANTS: Record<string, Variant> = {
	roads: { name: "Three roads", style: "bolder", View: Roads },
	compass: { name: "Compass", style: "existing", View: Compass },
	zoom: { name: "Zoom in", style: "existing", View: Zoom },
	doors: { name: "Three doors", style: "existing", View: Doors },
	lens: { name: "Change one thing", style: "existing", View: Lens },
	leap: { name: "One bold leap", style: "bolder", View: Leap },
}
