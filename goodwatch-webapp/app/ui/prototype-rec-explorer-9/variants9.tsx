// PROTOTYPE - throwaway. The round-9 Explorer variants (#180), in switcher order: round 8's six ways of combining
// islands, all on round 9's focus layout (the bridge forms between the islands it joins and becomes the main thing
// on screen; the rest shrink, move aside and go grey).
import type { ComponentType } from "react"
import type { Ex4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import type { Config8 } from "~/ui/prototype-rec-explorer-8/wire8"
import { Explorer9 } from "./Explorer9"

export type Variant9 = { name: string; View: ComponentType<{ ex: Ex4 }> }

const v = (cfg: Config8): Variant9["View"] =>
	function V({ ex }) {
		return <Explorer9 ex={ex} cfg={cfg} />
	}

export const VARIANTS9: Record<string, Variant9> = {
	select: {
		name: "Tap to light an island, tap another to bridge",
		View: v({ gesture: "select" }),
	},
	stretch: {
		name: "Pull a band of light to another island",
		View: v({ gesture: "stretch" }),
	},
	preview: {
		name: "Light one, see what every island shares",
		View: v({ gesture: "preview" }),
	},
	gather: {
		name: "Push islands together, or pinch two",
		View: v({ gesture: "gather" }),
	},
	neighbors: {
		name: "Inside an island, bridges to its best neighbors",
		View: v({ gesture: "neighbors" }),
	},
	triple: { name: "Light up to three islands", View: v({ gesture: "triple" }) },
}
