// PROTOTYPE (Discover lab, round 15): the main tabs choice. The shell reads the layout (lab/layouts.ts); this entry
// only puts it in the lab bar like any section, so it renders nothing itself. Round 20 locked c.
import { LAYOUT_KEYS } from "../../layouts"
import type { SectionVariant } from "../../types"

export const VARIANTS: SectionVariant[] = LAYOUT_KEYS.map(({ key, name }) => ({ key, name, View: () => null }))
