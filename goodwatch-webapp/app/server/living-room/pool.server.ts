import { MOOD_BY_KEY, type MoodKey } from "~/domain/moods"
import { loadTaste } from "~/server/taste/index.server"
import {
	MAX_KEYS,
	type TitleCard,
	getServiceCards,
	getTitleCards,
} from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import type {
	LivingRoomData,
	LivingRoomTitle,
	TvPair,
} from "~/ui/living-room/living-room-data"
import { livingRoomServices } from "./data.server"
import { LivingRoomUnavailable, rankOf } from "./picks.server"
import { poolCandidates, selectPoolKeys } from "./pool-keys.server"

// Contrasting moods for "Which one, tonight?".
const PAIRS: [MoodKey, MoodKey][] = [
	["funny", "heavy"],
	["action", "romance"],
	["feelgood", "scary"],
	["mind", "worlds"],
	["crime", "growing"],
	["history", "funny"],
]

export async function getLivingRoomPool(
	ctx: ViewerContext,
): Promise<LivingRoomData> {
	const snapshot = getTitleSnapshot()
	if (!snapshot)
		throw new LivingRoomUnavailable("The title snapshot is loading")
	const taste = await loadTaste(ctx.viewer)
	const member = ctx.viewer.kind === "member"

	// The best few for any mood, then a few per mood, without repeats. The candidates are kept per snapshot version and
	// UTC day. The viewer's seen, skipped, and Want to See titles and their taste order apply on every request (see
	// pool-keys.server.ts).
	const today = Math.floor(Date.now() / 86_400_000)
	const candidates = poolCandidates(snapshot, today)
	const { keys, byMood } = selectPoolKeys(
		candidates,
		ctx,
		ctx.forYou && taste.signal === "some" ? (key) => rankOf(taste, key) : null,
	)

	const [cards, wishlist, saved, catalog] = await Promise.all([
		getTitleCards(keys.slice(0, MAX_KEYS), ctx, taste),
		member ? livingRoomWishlistCards(ctx, taste) : [],
		getServiceCards(ctx.services),
		livingRoomServices(ctx.country, ctx.services),
	])
	const withMoods = (card: TitleCard): LivingRoomTitle => ({
		...card,
		moods: snapshot?.facts(card.key)?.moods ?? [],
	})
	const suggestions = cards.map(withMoods)

	const pairs: TvPair[] = []
	const used = new Set<number>()
	const firstOf = (mood: MoodKey) => {
		const key = (byMood.get(mood) ?? []).find(
			(k) => !used.has(k) && suggestions.some((t) => t.key === k),
		)
		if (key !== undefined) used.add(key)
		return key
	}
	for (const [ma, mb] of PAIRS) {
		const a = firstOf(ma)
		const b = firstOf(mb)
		if (a === undefined || b === undefined) continue
		pairs.push({
			a,
			b,
			aLabel: MOOD_BY_KEY[ma].name,
			bLabel: MOOD_BY_KEY[mb].name,
			aMoods: [ma],
			bMoods: [mb],
		})
	}

	return {
		member,
		suggestions,
		wishlist,
		catalog,
		savedServices: member ? saved.map((s) => s.name) : [],
		pairs,
	}
}

// Read all Wishlist cards in bounded batches so the UI's mood counts cover the full Wishlist.
export async function livingRoomWishlistCards(
	ctx: ViewerContext,
	taste: Awaited<ReturnType<typeof loadTaste>>,
): Promise<LivingRoomTitle[]> {
	const keys = [...ctx.wishlist.keys()]
	const ordered = keys
		.map((key) => ({ key, rank: rankOf(taste, key) }))
		.sort((a, b) => b.rank - a.rank)
		.map(({ key }) => key)
	const snapshot = getTitleSnapshot()
	const cards: LivingRoomTitle[] = []
	for (let i = 0; i < ordered.length; i += MAX_KEYS) {
		const batch = await getTitleCards(
			ordered.slice(i, i + MAX_KEYS),
			ctx,
			taste,
		)
		cards.push(
			...batch.map((card) => ({
				...card,
				moods: snapshot?.facts(card.key)?.moods ?? [],
			})),
		)
	}
	return cards
}
