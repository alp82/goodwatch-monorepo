// PROTOTYPE (Discover lab, round 16, round 17, round 18): the "more" section's variants (popularity, money, shows;
// all lab-only), each as own Watch sub-tabs Popularity, Shows and Budget (lab/layouts.ts withMore). a is the owner's
// pick (preset tiles, slider); d, e and g keep a's layout and vary how the tiles look. g is d's glyphs in e's color.
import type { SectionVariant } from "../../types"
import { MoreA } from "./a"
import { MoreD } from "./d"
import { MoreE } from "./e"
import { MoreG } from "./g"

export const VARIANTS: SectionVariant[] = [
	{ key: "a", name: "Own sub-tabs, preset tiles", View: MoreA },
	{ key: "d", name: "a with glyphs and ramps", View: MoreD },
	{ key: "e", name: "a in muted color", View: MoreE },
	{ key: "g", name: "d's glyphs in e's muted color", View: MoreG },
]
