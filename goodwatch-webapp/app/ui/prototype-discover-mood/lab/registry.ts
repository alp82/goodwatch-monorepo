// PROTOTYPE (Discover lab): every section's variants, and the pick for the current choice.
import { VARIANTS as age } from "./sections/age"
import { VARIANTS as length } from "./sections/length"
import { VARIANTS as mood } from "./sections/mood"
import { VARIANTS as origin } from "./sections/origin"
import { VARIANTS as people } from "./sections/people"
import { VARIANTS as released } from "./sections/released"
import { VARIANTS as scores } from "./sections/scores"
import { VARIANTS as services } from "./sections/services"
import { VARIANTS as taste } from "./sections/taste"
import { VARIANTS as titles } from "./sections/titles"
import { type Choice, DEFAULTS } from "./choice"
import type { SectionId, SectionVariant } from "./types"

export const REGISTRY: Record<SectionId, SectionVariant[]> = { titles, people, taste, mood, services, origin, length, scores, released, age }

export function pick(choice: Choice, id: SectionId): SectionVariant {
	const list = REGISTRY[id]
	const key = choice[id] ?? DEFAULTS[id]
	return list.find((v) => v.key === key) ?? list[0]
}
