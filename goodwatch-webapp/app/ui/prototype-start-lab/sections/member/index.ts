// PROTOTYPE (start page lab): the "member" section's variants, in bar order: the signed-in member's start page.
import type { BlockVariant } from "../../lab/types"
import { DoorsSwitch } from "./doors-switch"
import { RoomStart } from "./room-start"
import { RowsStrip } from "./rows-strip"
import { SearchFirst } from "./search-first"
import { TonightFirst } from "./tonight-first"

export const VARIANTS: BlockVariant[] = [
	{ key: "a", name: "Rows with a room strip", C: RowsStrip },
	{ key: "b", name: "The room is the start (bolder)", C: RoomStart },
	{ key: "c", name: "Tonight first", C: TonightFirst },
	{ key: "d", name: "Search first", C: SearchFirst },
	{ key: "e", name: "Doors and a Movies | Shows switch", C: DoorsSwitch },
]
