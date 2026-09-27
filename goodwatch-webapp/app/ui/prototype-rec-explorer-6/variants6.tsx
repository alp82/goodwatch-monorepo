// PROTOTYPE - throwaway. The round-6 Explorer variants (#180), in switcher order. All share the living islands map;
// they differ in how a title comes forward (the activation) and in what an island's surface is made of.
import type { ComponentType } from "react"
import type { Ex4 } from "~/ui/prototype-rec-explorer-4/useExplorer4"
import { Explorer6 } from "./Explorer6"
import type { Config6 } from "./wire6"

export type Variant6 = { name: string; style: "existing" | "bolder"; View: ComponentType<{ ex: Ex4 }> }

const v = (cfg: Config6): Variant6["View"] =>
	function V({ ex }) {
		return <Explorer6 ex={ex} cfg={cfg} />
	}

export const VARIANTS6: Record<string, Variant6> = {
	near: {
		name: "Proximity cards, backdrop islands",
		style: "bolder",
		View: v({ activation: "near", surface: "backdrop", arr: "orbit" }),
	},
	focus: {
		name: "Focus ring, mosaic islands",
		style: "bolder",
		View: v({ activation: "focus", surface: "mosaic", arr: "plus" }),
	},
	drawer: {
		name: "Following drawer, contour islands",
		style: "bolder",
		View: v({ activation: "drawer", surface: "contour", arr: "corners" }),
	},
	peek: {
		name: "Hover peek and pin",
		style: "existing",
		View: v({ activation: "peek", surface: "backdrop", arr: "plus" }),
	},
	pin: {
		name: "Tap to pin, spotlight",
		style: "existing",
		View: v({ activation: "pin", surface: "mosaic", arr: "orbit" }),
	},
}
