// PROTOTYPE (Discover lab): the "people" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { PeopleA } from "./a"
import { PeopleB } from "./b"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Faces follow the bar", View: PeopleA },
	{ key: "b", name: "Split by role", View: PeopleB },
]
