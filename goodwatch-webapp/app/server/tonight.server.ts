// Tonight's pick: the single title GoodWatch puts forward for tonight. The navigation dock and the Living room's TV
// both show it.
// - A member with a Wishlist: the first title of Watch next under the default sort, On my services, and no moods.
// - A member with an empty Wishlist: the best worthwhile suggestion.
// - A guest: the last title added to their guest Wishlist, else nothing (the dock then shows a Wishlist icon).
import { loadTaste } from "~/server/taste/index.server"
import { type TitleCard, getTitleCards } from "~/server/title-cards.server"
import type { ViewerContext } from "~/server/viewer.server"
import {
	planWatchNext,
	sortFactsOutsideSnapshot,
	worthwhileSuggestions,
} from "~/server/watch-next.server"

export type TonightReason =
	| "bestMatch" // the top of Watch next by Best match, on the person's services
	| "lastAdded" // the top by Last added (no taste yet, or a guest)
	| "notOnServices" // nothing on the Wishlist is on the person's services; the closest title
	| "suggestion" // the Wishlist is empty; a worthwhile suggestion

export interface TonightsPick {
	title: TitleCard
	reason: TonightReason
}

export async function getTonightsPick(
	ctx: ViewerContext,
): Promise<TonightsPick | null> {
	const taste = await loadTaste(ctx.viewer)
	if (ctx.viewer.kind === "guest") {
		let last: { key: number; at: number } | null = null
		for (const [key, added] of ctx.wishlist) {
			const at = added.getTime()
			if (!last || at > last.at || (at === last.at && key < last.key))
				last = { key, at }
		}
		if (!last) return null
		const [title] = await getTitleCards([last.key], ctx, taste)
		return title ? { title, reason: "lastAdded" } : null
	}

	if (!ctx.wishlist.size) {
		const [key] = worthwhileSuggestions(ctx, taste, {
			moods: [],
			onMyServices: true,
			count: 1,
		})
		if (key === undefined) return null
		const [title] = await getTitleCards([key], ctx, taste)
		return title ? { title, reason: "suggestion" } : null
	}

	const outside = await sortFactsOutsideSnapshot(ctx.wishlist.keys())
	const plan = planWatchNext(
		ctx,
		taste,
		{ onMyServices: true, moods: [] },
		outside,
	)
	// Try the next titles when the first has no display fields in Crate.
	const cards = await getTitleCards(
		plan.head.map((e) => e.key),
		ctx,
		taste,
	)
	const title = cards[0]
	if (!title) return null
	return {
		title,
		reason: !plan.heroFits
			? "notOnServices"
			: plan.sort === "match"
				? "bestMatch"
				: "lastAdded",
	}
}
