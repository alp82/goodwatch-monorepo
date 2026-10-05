// PROTOTYPE - throwaway. The round 2 Taste page variants, in switcher order.
import type { ComponentType } from "react"
import type { ViewProps } from "./kit"
import Canon from "./variants/Canon"
import Card from "./variants/Card"
import Crowd from "./variants/Crowd"
import Eras from "./variants/Eras"
import Friend from "./variants/Friend"
import Frontiers from "./variants/Frontiers"
import Portrait from "./variants/Portrait"
import Sides from "./variants/Sides"

export type Variant = {
	name: string
	style: "existing" | "bolder"
	View: ComponentType<ViewProps>
}

export const VARIANTS: Record<string, Variant> = {
	portrait: { name: "Taste portrait", style: "bolder", View: Portrait },
	canon: { name: "Your canon", style: "existing", View: Canon },
	sides: { name: "Sides of you", style: "existing", View: Sides },
	crowd: { name: "You vs everyone", style: "existing", View: Crowd },
	frontiers: { name: "Frontiers", style: "bolder", View: Frontiers },
	eras: { name: "Your eras", style: "existing", View: Eras },
	friend: { name: "You and a friend", style: "existing", View: Friend },
	card: { name: "Taste card", style: "bolder", View: Card },
}
