// PROTOTYPE - throwaway. The round-7 Explorer variants (#180), in switcher order. All are round 6's `near`
// (proximity cards, backdrop-collage islands, the sea in WebGL); they differ in how posters look and fall off with
// distance and zoom (the lens), and the last two add a way to combine two islands.
import type { ComponentType } from "react"
import type { Ex4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { Explorer7 } from "./Explorer7"
import type { Config7 } from "./wire7"

export type Variant7 = { name: string; style: "existing" | "bolder"; View: ComponentType<{ ex: Ex4 }> }

const v = (cfg: Config7): Variant7["View"] =>
	function V({ ex }) {
		return <Explorer7 ex={ex} cfg={cfg} />
	}

export const VARIANTS7: Record<string, Variant7> = {
	lit: { name: "Lit cards that turn toward the pointer", style: "existing", View: v({ present: "lit", combine: null }) },
	rise: { name: "Posters rise from the island", style: "bolder", View: v({ present: "rise", combine: null }) },
	tiles: { name: "Match tiles, gold dots far out", style: "existing", View: v({ present: "tiles", combine: null }) },
	frames: { name: "Poster, then still, then name", style: "bolder", View: v({ present: "frames", combine: null }) },
	bridge: { name: "Tap two islands to combine", style: "bolder", View: v({ present: "lit", combine: "tap" }) },
	merge: { name: "Drag an island onto another", style: "bolder", View: v({ present: "tiles", combine: "drag" }) },
}
