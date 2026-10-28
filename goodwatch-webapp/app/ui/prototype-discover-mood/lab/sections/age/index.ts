// PROTOTYPE (Discover lab): the "age" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { AgeA } from "./a"
import { AgeB } from "./b"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Rating ladder and checklist", View: AgeA },
	{ key: "b", name: "Who's watching", View: AgeB },
]
