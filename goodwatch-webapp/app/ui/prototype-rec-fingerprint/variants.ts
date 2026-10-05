// PROTOTYPE - throwaway. The fingerprint page variants (#181), in switcher order.
import type { ComponentType } from "react"
import type { ViewProps } from "./parts"
import Everyone from "./variants/Everyone"
import Families from "./variants/Families"
import Fit from "./variants/Fit"
import Friend from "./variants/Friend"
import Glyph from "./variants/Glyph"
import Reel from "./variants/Reel"
import Shift from "./variants/Shift"
import Tuner from "./variants/Tuner"

export type Variant = {
	name: string
	style: "existing" | "bolder"
	View: ComponentType<ViewProps>
}

export const VARIANTS: Record<string, Variant> = {
	families: { name: "Five families", style: "existing", View: Families },
	reel: { name: "The reel", style: "bolder", View: Reel },
	everyone: { name: "You vs everyone", style: "existing", View: Everyone },
	glyph: { name: "The glyph", style: "bolder", View: Glyph },
	fit: { name: "Why this fits you", style: "bolder", View: Fit },
	tuner: { name: "What it does to your picks", style: "existing", View: Tuner },
	shift: { name: "How it shifted", style: "existing", View: Shift },
	friend: { name: "You and a friend", style: "existing", View: Friend },
}
