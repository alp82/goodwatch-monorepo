// PROTOTYPE - throwaway. The round-8 Explorer variants (#180), in switcher order. All are round 7's `bridge` with
// `lit` posters on a page that never scrolls; they differ in how combining islands is part of the map itself.
import type { ComponentType } from "react"
import type { Ex4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { Explorer8 } from "./Explorer8"
import type { Config8 } from "./wire8"

export type Variant8 = { name: string; View: ComponentType<{ ex: Ex4 }> }

const v = (cfg: Config8): Variant8["View"] =>
	function V({ ex }) {
		return <Explorer8 ex={ex} cfg={cfg} />
	}

export const VARIANTS8: Record<string, Variant8> = {
	select: { name: "Tap to light an island, tap another to bridge", View: v({ gesture: "select" }) },
	stretch: { name: "Pull a band of light to another island", View: v({ gesture: "stretch" }) },
	preview: { name: "Light one, see what every island shares", View: v({ gesture: "preview" }) },
	gather: { name: "Push islands together, or pinch two", View: v({ gesture: "gather" }) },
	neighbors: { name: "Inside an island, bridges to its best neighbors", View: v({ gesture: "neighbors" }) },
	triple: { name: "Light up to three islands", View: v({ gesture: "triple" }) },
}
