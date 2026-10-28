// PROTOTYPE (Discover lab): the "released" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { ReleasedA } from "./a"
import { ReleasedB } from "./b"
import { ReleasedC } from "./c"
import { ReleasedD } from "./d"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Quick picks and range", View: ReleasedA },
	{ key: "b", name: "Decade histogram", View: ReleasedB },
	{ key: "c", name: "Era board, steppers", View: ReleasedC },
	{ key: "d", name: "Era board and range", View: ReleasedD },
]
