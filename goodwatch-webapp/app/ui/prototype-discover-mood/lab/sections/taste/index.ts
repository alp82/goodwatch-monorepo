// PROTOTYPE (Discover lab): the "taste" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { TasteA } from "./a"
import { TasteB } from "./b"
import { TasteC } from "./c"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Find, shelves, match", View: TasteA },
	{ key: "b", name: "Match first, lanes", View: TasteB },
	{ key: "c", name: "Poster wall, thumbs", View: TasteC },
]
