// PROTOTYPE - throwaway. The round-2 Explorer variants, in switcher order.
import type { ComponentType } from "react"
import type { Ex } from "./useExplorer2"
import Doors from "./variants/Doors"
import Eras from "./variants/Eras"
import Moods from "./variants/Moods"
import People from "./variants/People"
import Rings from "./variants/Rings"
import Trail from "./variants/Trail"
import Zoom from "./variants/Zoom"

export type Variant = {
	name: string
	style: "existing" | "bolder"
	View: ComponentType<{ ex: Ex }>
}

export const VARIANTS: Record<string, Variant> = {
	zoom: { name: "Nested map", style: "existing", View: Zoom },
	rings: { name: "Core and edges", style: "existing", View: Rings },
	trail: { name: "Follow the thread", style: "existing", View: Trail },
	people: { name: "Directors", style: "existing", View: People },
	eras: { name: "Through the decades", style: "bolder", View: Eras },
	moods: { name: "Mood rooms", style: "bolder", View: Moods },
	doors: { name: "Choose a direction", style: "bolder", View: Doors },
}
