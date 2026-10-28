// PROTOTYPE (Discover lab): the "origin" (Made in) section's variants. `a` is the baseline.
import type { SectionVariant } from "../../types"
import { OriginA } from "./a"
import { OriginB } from "./b"
import { OriginC } from "./c"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Popular and regions", View: OriginA },
	{ key: "b", name: "Region columns", View: OriginB },
	{ key: "c", name: "Hollywood or world", View: OriginC },
]
