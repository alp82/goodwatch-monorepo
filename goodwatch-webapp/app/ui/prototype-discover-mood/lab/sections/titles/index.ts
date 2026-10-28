// PROTOTYPE (Discover lab): the "titles" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { TitlesA } from "./a"
import { TitlesB } from "./b"
import { TitlesC } from "./c"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Lanes, one action set", View: TitlesA },
	{ key: "b", name: "Posters that turn over", View: TitlesB },
	{ key: "c", name: "One list for everything", View: TitlesC },
]
