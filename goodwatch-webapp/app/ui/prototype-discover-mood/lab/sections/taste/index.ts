// PROTOTYPE (Discover lab): the "taste" section's variants. `a` is the baseline. Round 8 (d, e, f): no title boxes,
// taste filters only (Titles steers by titles now).
import type { SectionVariant } from "../../types"
import { TasteA } from "./a"
import { TasteB } from "./b"
import { TasteC } from "./c"
import { TasteD } from "./d"
import { TasteE } from "./e"
import { TasteF } from "./f"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Find, shelves, match", View: TasteA },
	{ key: "b", name: "Match first, lanes", View: TasteB },
	{ key: "c", name: "Poster wall, thumbs", View: TasteC },
	{ key: "d", name: "Taste board", View: TasteD },
	{ key: "e", name: "Taste shelf, one row", View: TasteE },
	{ key: "f", name: "Taste in this list", View: TasteF },
]
