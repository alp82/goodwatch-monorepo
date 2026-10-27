// PROTOTYPE (start page lab): the "recs" section's variants, in bar order.
import type { BlockVariant } from "../../lab/types"
import { Both } from "./both"
import { ScoreFirst } from "./score-first"
import { ShareShelf } from "./share-shelf"
import { TapThree } from "./tap-three"
import { ThisOrThat } from "./this-or-that"

export const VARIANTS: BlockVariant[] = [
	{ key: "a", name: "Score first", C: ScoreFirst },
	{ key: "b", name: "Tap three", C: TapThree },
	{ key: "c", name: "Score + tap three", C: Both },
	{ key: "d", name: "Bolder: this or that", C: ThisOrThat },
	{ key: "e", name: "Share your shelf (bolder)", C: ShareShelf },
]
