// PROTOTYPE (Discover lab): the "length" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { LengthA } from "./a"
import { LengthB } from "./b"
import { LengthC } from "./c"
import { LengthD } from "./d"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Movie and episode picks", View: LengthA },
	{ key: "b", name: "Time ruler", View: LengthB },
	{ key: "c", name: "Time you have", View: LengthC },
	{ key: "d", name: "Movie and episode sliders", View: LengthD },
]
