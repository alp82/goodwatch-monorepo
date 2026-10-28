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

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Mood tiles, folds", View: MoodA },
	{ key: "b", name: "Island maps", View: MoodB },
	{ key: "c", name: "Mixes first", View: MoodC },
	{ key: "d", name: "Mixer with recipe", View: MoodD },
	{ key: "e", name: "Mixes follow your picks", View: MoodE },
	{ key: "f", name: "Build your own card", View: MoodF },
	{ key: "g", name: "Picture columns, best fit", View: MoodG },
	{ key: "h", name: "One ranked list", View: MoodH },
]
