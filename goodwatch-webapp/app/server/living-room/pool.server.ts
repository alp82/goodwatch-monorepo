import { MOOD_BY_KEY, MOOD_KEYS, type MoodKey } from "~/domain/moods"
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
import { LivingRoomUnavailable } from "./picks.server"

const PER_MOOD = 3
const BEST = 6

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

	// The best few for any mood, then a few per mood, without repeats.
	const keys: number[] = []
	const byMood = new Map<MoodKey, number[]>()
	const add = (list: number[]) => {
		for (const k of list) if (!keys.includes(k)) keys.push(k)
	}
	// Rank directly from the current snapshot on each request, without a process-cached suggestion pool.
	const today = Math.floor(Date.now() / 86_400_000)
	const ranked: {
		key: number
		rank: number
		popularity: number
		moods: MoodKey[]
	}[] = []
	snapshot.forEach((key) => {
		if (ctx.seen.has(key) || ctx.skipped.has(key) || ctx.wishlist.has(key))
			return
		const facts = snapshot.facts(key)
		if (
			!facts ||
			facts.adult ||
			!facts.hasPoster ||
			(facts.releaseDay !== null && facts.releaseDay > today) ||
			(facts.score ?? 0) < 70 ||
			facts.votes < 1000
		)
			return
		ranked.push({
			key,
			rank:
				ctx.forYou && taste.signal === "some"
					? (taste.match([key])[0] ?? 0)
					: facts.popularity,
			popularity: facts.popularity,
			moods: facts.moods,
		})
	})
	ranked.sort(
		(a, b) => b.rank - a.rank || b.popularity - a.popularity || a.key - b.key,
	)
	add(ranked.slice(0, BEST).map(({ key }) => key))
	for (const mood of MOOD_KEYS) {
		const list = ranked
			.filter((title) => title.moods.includes(mood))
			.slice(0, PER_MOOD + 2)
			.map(({ key }) => key)
		byMood.set(mood, list)
		add(list.slice(0, PER_MOOD))
	}

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
	const matches = taste.match(keys)
	const ordered = keys
		.map((key, i) => ({ key, match: matches[i] ?? 0 }))
		.sort((a, b) => b.match - a.match)
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
