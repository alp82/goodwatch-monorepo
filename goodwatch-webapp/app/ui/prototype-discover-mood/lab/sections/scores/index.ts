// PROTOTYPE (Discover lab): the "scores" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { ScoresA } from "./a"
import { ScoresB } from "./b"
import { ScoresC } from "./c"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Hero score, source lines", View: ScoresA },
	{ key: "b", name: "Stacked, source chips", View: ScoresB },
	{ key: "c", name: "Critics and audiences sides", View: ScoresC },
]
