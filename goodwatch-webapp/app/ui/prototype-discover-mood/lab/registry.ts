// PROTOTYPE (Discover lab): every section's variants, and the pick for the current choice. Round 20 left one per section; round 21 adds the header's a, b, c.
import { VARIANTS as age } from "./sections/age"
import { VARIANTS as header } from "./sections/header"
import { VARIANTS as layout } from "./sections/layout"
import { VARIANTS as length } from "./sections/length"
import { VARIANTS as mood } from "./sections/mood"
import { VARIANTS as more } from "./sections/more"
import { VARIANTS as origin } from "./sections/origin"
import { VARIANTS as people } from "./sections/people"
import { VARIANTS as released } from "./sections/released"
import { VARIANTS as scores } from "./sections/scores"
import { VARIANTS as services } from "./sections/services"
import { VARIANTS as taste } from "./sections/taste"
import { VARIANTS as titles } from "./sections/titles"
import { type Choice, DEFAULTS, SECTIONS } from "./choice"
import type { SectionId, SectionVariant } from "./types"

export const REGISTRY: Record<SectionId, SectionVariant[]> = { layout, header, titles, people, taste, mood, services, origin, length, scores, released, age, more }

/** The chosen variant: the URL's, else the pick in DEFAULTS (also for an unknown key, e.g. a removed variant), else the first. */
export function pick(choice: Choice, id: SectionId): SectionVariant {
	const list = REGISTRY[id]
	const of = (key: string | undefined) => list.find((v) => v.key === key)
	return of(choice[id]) ?? of(DEFAULTS[id]) ?? list[0]
}

/** The sections the lab bar offers: those with more than one variant. */
export const PICKABLE = SECTIONS.filter((s) => REGISTRY[s.id].length > 1)
