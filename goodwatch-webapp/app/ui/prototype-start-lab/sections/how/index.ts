// PROTOTYPE (start page lab): the "how" section's variants, in bar order.
import type { BlockVariant } from "../../lab/types"
import { Essentials } from "./essentials"
import { OneLine } from "./one-line"
import { TvSide } from "./tv-side"

export const VARIANTS: BlockVariant[] = [
	{ key: "a", name: "Three essentials", C: Essentials },
	{ key: "b", name: "TV on the side", C: TvSide },
	{ key: "c", name: "One line", C: OneLine },
]
