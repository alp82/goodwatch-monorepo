// PROTOTYPE (Discover lab, round 16): the "more" section's variants (popularity, money, shows; all lab-only). a and
// b add Watch sub-tabs Popularity, Budget and Shows; c adds one More sub-tab (lab/layouts.ts withMore).
import type { SectionVariant } from "../../types"
import { MoreA } from "./a"
import { MoreB } from "./b"
import { MoreC } from "./c"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Own sub-tabs, preset tiles", View: MoreA },
	{ key: "b", name: "Own sub-tabs, histograms", View: MoreB },
	{ key: "c", name: "One More sub-tab, chips", View: MoreC },
]
