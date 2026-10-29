// PROTOTYPE (Discover lab): the "more" section (popularity, money, shows; lab-only), as own Watch sub-tabs
// Popularity, Shows and Budget (lab/layouts.ts withMore). Round 20 locked g (glyphs in muted color); the others live
// in git history.
import type { SectionVariant } from "../../types"
import { MoreG } from "./g"

export const VARIANTS: SectionVariant[] = [{ key: "g", name: "Glyphs in muted color", View: MoreG }]
