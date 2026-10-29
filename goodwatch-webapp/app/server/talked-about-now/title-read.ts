import type { SocialEmbedItem } from "../../ui/social-embed/target.ts"
import type { TitleBuzz, TitleSocial } from "../../ui/talked-about-now/query.ts"
import { withinSocialBudget } from "./read-budget.ts"

export const TITLE_ITEMS_BUDGET_MS = 120
export const TITLE_BUZZ_BUDGET_MS = 20
export const EMPTY: TitleSocial = { items: [], buzz: null }
export type SocialTimings = Record<string, number>

/** Optional buzz must never discard already available posts or add a backend timeout to their response. */
export async function readTitleSocial(
	key: string,
	reads: { items: () => Promise<{ items: SocialEmbedItem[] }>; buzz: () => Promise<Record<string, TitleBuzz>> },
	timings: SocialTimings = {},
): Promise<TitleSocial> {
	const start = performance.now()
	const items = await withinSocialBudget(reads.items, TITLE_ITEMS_BUDGET_MS, null)
	timings.social_items = performance.now() - start
	if (items === null) return { ...EMPTY, pending: true }
	if (!items.items.length) return EMPTY
	const buzzStart = performance.now()
	const buzz = await withinSocialBudget(reads.buzz, TITLE_BUZZ_BUDGET_MS, {})
	timings.social_buzz = performance.now() - buzzStart
	return { items: items.items, buzz: buzz[key] ?? null }
}
