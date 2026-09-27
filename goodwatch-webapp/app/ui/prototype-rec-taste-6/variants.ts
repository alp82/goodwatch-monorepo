// PROTOTYPE - throwaway. Round 6's Sides of you variants, in switcher order (?variant=<key>). You vs everyone
// (round 4's Crowd) and Fingerprint (#181's families, refined) don't change with the switcher.
import type { ComponentType } from "react"
import type { VariantProps } from "./parts"
import Bands from "./views/Bands"
import Bridge from "./views/Bridge"
import Rail from "./views/Rail"
import Reveal from "./views/Reveal"

export type Variant = {
	name: string
	style: "existing" | "bolder"
	View: ComponentType<VariantProps>
}

export const VARIANTS: Record<string, Variant> = {
	reveal: { name: "Round 2, edge inside", style: "existing", View: Reveal },
	rail: { name: "Backdrop rail", style: "existing", View: Rail },
	bridge: { name: "Here, and just past it", style: "bolder", View: Bridge },
	bands: { name: "One band per side", style: "bolder", View: Bands },
}

export const DEFAULT_VARIANT = Object.keys(VARIANTS)[0]
