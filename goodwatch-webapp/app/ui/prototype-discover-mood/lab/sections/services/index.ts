// PROTOTYPE (Discover lab): the "services" section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { ServicesA } from "./a"
import { ServicesB } from "./b"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Pill and logo chips", View: ServicesA },
	{ key: "b", name: "Rail and logo wall", View: ServicesB },
]
