// PROTOTYPE (start page lab): every section's variants, per round. The scene section's variants are the scene
// images (data). Round 2 keeps round 1's scene, shelf, tv and how variants, and has its own stage, browse and member.
import { VARIANTS as BROWSE } from "../sections/browse"
import { VARIANTS as BROWSE2 } from "../sections/browse2"
import { VARIANTS as HERO } from "../sections/hero"
import { VARIANTS as HOW } from "../sections/how"
import { VARIANTS as LAYOUT } from "../sections/layout"
import { VARIANTS as MEMBER } from "../sections/member"
import { VARIANTS as MEMBER2 } from "../sections/member2"
import { VARIANTS as RECS } from "../sections/recs"
import { VARIANTS as SHELF } from "../sections/shelf"
import { VARIANTS as STAGE } from "../sections/stage"
import { VARIANTS as TV } from "../sections/tv"
import { VARIANTS as SEARCHBAR } from "../sections/searchbar"
import { VARIANTS as LIGHT } from "../sections/light"
import { VARIANTS as FLOW } from "../sections/flow" // Round 17

const SHARED = { shelf: SHELF, tv: TV, how: HOW, searchbar: SEARCHBAR, light: LIGHT }

export const REGISTRY = {
	1: { ...SHARED, layout: LAYOUT, hero: HERO, recs: RECS, browse: BROWSE, member: MEMBER, stage: STAGE },
	2: { ...SHARED, layout: LAYOUT, hero: HERO, recs: RECS, browse: BROWSE2, member: MEMBER2, stage: STAGE, flow: FLOW },
} as const

export const pick = <T extends { key: string }>(list: readonly T[], key: string | undefined, fallback?: string): T =>
	list.find((v) => v.key === key) ?? list.find((v) => v.key === fallback) ?? (list[0] as T)
