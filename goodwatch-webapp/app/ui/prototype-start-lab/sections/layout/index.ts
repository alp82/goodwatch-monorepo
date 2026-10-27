// PROTOTYPE (start page lab): the guest page's layouts, in bar order.
import type { LayoutVariant } from "../../lab/types"
import { HeroThenBand } from "./band"
import { RoomFrame } from "./frame"
import { RoomBehind } from "./room-behind"
import { Split } from "./split"
import { Stacked } from "./stacked"

export const VARIANTS: LayoutVariant[] = [
	{ key: "a", name: "Stacked (baseline)", C: Stacked },
	{ key: "b", name: "Room behind hero", C: RoomBehind },
	{ key: "c", name: "Hero, room band", C: HeroThenBand },
	{ key: "d", name: "Split, sticky room", C: Split },
	{ key: "e", name: "Room frame (bolder)", C: RoomFrame },
]
