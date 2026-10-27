// PROTOTYPE (start page lab): how live posters meet the scene, in bar order.
import type { ShelfVariant } from "../../lab/types"
import { LiftCaption, LitSlot } from "./lit"
import { LiveSlot } from "./live"
import { PlainSlot } from "./plain"
import { PullOverlay, PullSlot } from "./pull"
import { RailOverlay, RailSlot } from "./rail"

export const VARIANTS: ShelfVariant[] = [
	{ key: "a", name: "Posters in the slots (baseline)", Slot: PlainSlot },
	{ key: "b", name: "Lit in place", Slot: LitSlot, Overlay: LiftCaption },
	{ key: "c", name: "Overlay rail", Slot: RailSlot, Overlay: RailOverlay },
	{ key: "d", name: "Pull from the shelf", Slot: PullSlot, Overlay: PullOverlay },
	{ key: "e", name: "Live changes", Slot: LiveSlot, Overlay: LiftCaption },
]
