// PROTOTYPE (Discover lab): the "titles" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { TitlesA } from "./a"
import { TitlesB } from "./b"
import { TitlesC } from "./c"
import { TitlesD } from "./d"
import { TitlesE } from "./e"
import { TitlesF } from "./f"
import { TitlesG } from "./g"
import { TitlesH } from "./h"
import { TitlesI } from "./i"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Lanes, one action set", View: TitlesA },
	{ key: "b", name: "Posters that turn over", View: TitlesB },
	{ key: "c", name: "One list for everything", View: TitlesC },
	{ key: "d", name: "The bar is the search", label: "Titles", searchButton: true, View: TitlesD },
	{ key: "e", name: "Describe or find a title", label: "Describe or find", View: TitlesE },
	{ key: "f", name: "The grid is the preview", label: "Titles and people", liveGrid: true, View: TitlesF },
	{ key: "g", name: "Suggestions list", label: "Titles", searchButton: true, ownType: true, View: TitlesG },
	{ key: "h", name: "Steer board", label: "Steer", View: TitlesH },
	{ key: "i", name: "One sentence", label: "Titles", View: TitlesI },
]
