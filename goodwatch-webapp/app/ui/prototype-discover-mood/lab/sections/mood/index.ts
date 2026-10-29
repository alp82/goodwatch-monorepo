// PROTOTYPE (Discover lab): the "mood" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { MoodA } from "./a"
import { MoodB } from "./b"
import { MoodC } from "./c"
import { MoodD } from "./d"
import { MoodE } from "./e"
import { MoodF } from "./f"
import { MoodG } from "./g"
import { MoodH } from "./h"
import { useAndResults } from "./and"
import { MoodI } from "./i"
import { MoodJ } from "./j"
import { MoodK } from "./k"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Mood tiles, folds", View: MoodA },
	{ key: "b", name: "Island maps", View: MoodB },
	{ key: "c", name: "Mixes first", View: MoodC },
	{ key: "d", name: "Mixer with recipe", View: MoodD },
	{ key: "e", name: "Mixes follow your picks", View: MoodE, ownFind: true },
	{ key: "f", name: "Build your own card", View: MoodF },
	{ key: "g", name: "Columns, best fit", View: MoodG },
	{ key: "h", name: "One ranked list", View: MoodH },
	// i, j, k: every pick ANDed; the grid and Show N titles show the AND list, Find a filter sits on the recipe row.
	{ key: "i", name: "Columns, all of each", View: MoodI, ownFind: true, useResults: useAndResults },
	{ key: "j", name: "Mix row over columns", View: MoodJ, ownFind: true, useResults: useAndResults },
	{ key: "k", name: "Mixes, then choose", View: MoodK, ownFind: true, useResults: useAndResults },
]
