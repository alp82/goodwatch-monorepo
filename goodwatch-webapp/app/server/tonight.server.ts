// Tonight's pick: the single title GoodWatch puts forward for tonight. The navigation dock and the Living room's TV
// both show it.
// Discord can narrow member picks by mood, title type, and recent-pick exclusions.
// - A member with a Wishlist: the first title of Watch next under the default sort, On my services, and no moods.
// - A member with an empty Wishlist: the best worthwhile suggestion.
// - A guest: the last title added to their guest Wishlist, else nothing (the dock then shows a Wishlist icon).
import { maskOfMoods } from "~/domain/moods"
import { episodeCode, tonightsPickOf } from "~/domain/my-shows"
import { getTonightParts } from "~/server/home-doors.server"
import { type Taste, loadTaste } from "~/server/taste/index.server"
import { type TitleCard, getTitleCards } from "~/server/title-cards.server"
import type { ViewerContext } from "~/server/viewer.server"
import {
	planWatchNext,
	sortFactsOutsideSnapshot,
	worthwhileSuggestions,
} from "~/server/watch-next.server"
import { DOOR_HREF } from "~/ui/living-room/tv/tv-machine"
import { titleKey } from "~/utils/title-key"

export type TonightReason =
	| "bestMatch" // the top of Watch next by Best match, on the person's services
	| "lastAdded" // the top by Last added (no taste yet, or a guest)
	| "notOnServices" // nothing on the Wishlist is on the person's services; the closest title
	| "suggestion" // the Wishlist is empty; a worthwhile suggestion
	// A member's (#385):
	| "nextEpisode" // the Next episode of the Watching show the member was last active on in the last 90 days
	| "startShow" // no such show and no movie: the first show to start
	| "landed" // the pick's door is led by a title that landed on the member's services in the last 14 days (#489)

export interface TonightsPick {
	title: TitleCard
	reason: TonightReason
	/** When a member's pick is an episode: "S2 E3" and its name. */
	episode?: { code: string; name: string | null }
	/** A member's pick: the page the pick is the first thing on. Without it the pick opens Watch next. */
	href?: string
}

/**
 * Tonight's pick for a member: the Next episode of the Watching show they were last active on in
 * the last 90 days; without one, the first movie of My movies; without one, the first show to start. The pick is
 * what its door shows first, so a movie or a show to start that landed lately is the pick when its door is (#489).
 * Null when the member has none of them, and the pick is then the top of Watch next.
 */
async function trackedPick(
	ctx: ViewerContext,
	taste: Taste,
): Promise<TonightsPick | null> {
	const parts = await getTonightParts(ctx, taste)
	const movie = parts.movies[0] ?? null
	const choice = tonightsPickOf(parts.shows, movie?.tmdb_id ?? null)
	if (!choice) return null
	if (choice.kind === "movie" && movie)
		return {
			title: movie,
			reason: parts.newOn.movie
				? "landed"
				: !parts.movieFits
					? "notOnServices"
					: parts.movieByMatch
						? "bestMatch"
						: "lastAdded",
			href: DOOR_HREF.movie,
		}
	if (choice.kind === "movie") return null
	const [title] = await getTitleCards(
		[titleKey("show", choice.showId)],
		ctx,
		taste,
	)
	if (!title) return null
	if (choice.kind === "start")
		return {
			title,
			reason: parts.newOn.start ? "landed" : "startShow",
			href: DOOR_HREF.start,
		}
	const next = parts.shows.continue.find((row) => row.id === choice.showId)?.next
	return {
		title,
		reason: "nextEpisode",
		...(next
			? { episode: { code: episodeCode(next), name: next.name } }
			: {}),
		href: DOOR_HREF.continue,
	}
}

export async function getTonightsPick(
	ctx: ViewerContext,
	givenTaste?: Taste,
	options: Partial<
		Pick<Parameters<typeof worthwhileSuggestions>[2], "moods" | "fits">
	> = {},
): Promise<TonightsPick | null> {
	const taste = givenTaste ?? (await loadTaste(ctx.viewer))
	if (ctx.viewer.kind === "member") {
		const pick = await trackedPick(ctx, taste)
		if (
			pick &&
			!options.moods?.length &&
			(!options.fits ||
				options.fits(titleKey(pick.title.media_type, pick.title.tmdb_id)))
		)
			return pick
	}
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
			moods: options.moods ?? [],
			fits: options.fits,
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
		{ onMyServices: true, moods: options.moods ?? [] },
		outside,
	)
	const filtered = !!options.fits || !!options.moods?.length
	const moodMask = maskOfMoods(options.moods ?? [])
	const candidates = filtered
		? [
				...new Set([
					...plan.head.map((e) => e.key),
					...plan.tiers.flatMap((tier) => tier.keys),
				]),
			]
				.filter(
					(key) =>
						plan.entries.get(key)!.fit === plan.need &&
						(!options.fits || options.fits(key)) &&
						(!moodMask || !!(plan.entries.get(key)!.moodMask & moodMask)),
				)
				.slice(0, 4)
		: plan.head.map((e) => e.key)
	// Try the next titles when the first has no display fields in Crate.
	const cards = await getTitleCards(candidates, ctx, taste)
	const title = cards[0]
	if (!title) {
		if (!filtered) return null
		const [key] = worthwhileSuggestions(ctx, taste, {
			moods: options.moods ?? [],
			fits: options.fits,
			onMyServices: true,
			count: 1,
		})
		if (key === undefined) return null
		const [suggestion] = await getTitleCards([key], ctx, taste)
		return suggestion ? { title: suggestion, reason: "suggestion" } : null
	}
	return {
		title,
		reason: !plan.heroFits
			? "notOnServices"
			: plan.sort === "match"
				? "bestMatch"
				: "lastAdded",
	}
}
