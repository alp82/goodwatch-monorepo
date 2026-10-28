// PROTOTYPE (Discover lab): the "age" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { AgeA } from "./a"
import { AgeB } from "./b"
import { AgeC } from "./c"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Ladder, country and age", View: AgeA },
	{ key: "b", name: "Who's watching", View: AgeB },
	{ key: "c", name: "Today's card", View: AgeC },
]
