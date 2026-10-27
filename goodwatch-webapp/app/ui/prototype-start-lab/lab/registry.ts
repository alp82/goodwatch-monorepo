// PROTOTYPE (start page lab): every section's variants. The scene section's variants are the scene images (data).
import { VARIANTS as BROWSE } from "../sections/browse"
import { VARIANTS as HERO } from "../sections/hero"
import { VARIANTS as HOW } from "../sections/how"
import { VARIANTS as LAYOUT } from "../sections/layout"
import { VARIANTS as MEMBER } from "../sections/member"
import { VARIANTS as RECS } from "../sections/recs"
import { VARIANTS as SHELF } from "../sections/shelf"
import { VARIANTS as TV } from "../sections/tv"

export const REGISTRY = { layout: LAYOUT, hero: HERO, recs: RECS, shelf: SHELF, tv: TV, how: HOW, browse: BROWSE, member: MEMBER }

export const pick = <T extends { key: string }>(list: T[], key: string | undefined): T =>
	list.find((v) => v.key === key) ?? (list[0] as T)
