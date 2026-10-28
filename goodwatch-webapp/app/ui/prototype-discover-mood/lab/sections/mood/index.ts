// PROTOTYPE (Discover lab): the "mood" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { MoodA } from "./a"
import { MoodB } from "./b"
import { MoodC } from "./c"
import { MoodD } from "./d"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Mood tiles, folds", View: MoodA },
	{ key: "b", name: "Island maps", View: MoodB },
	{ key: "c", name: "Mixes first", View: MoodC },
	{ key: "d", name: "Mixer with recipe", View: MoodD },
]
