// The living room's data, read once per page load: a pool of worthwhile titles per mood, the member's Wishlist, the
// services catalog, and the this-or-that pairs. The TV derives tonight's picks from it in the browser
// (`titlesFor` in ~/ui/living-room/living-room-data), so D-pad moves never rerun the loader.
//
// Interim version for the desktop build (#229). Serving the living room with caching, guest progress, and writes
// belongs to #231, which replaces this module's internals and keeps `LivingRoomData` as its contract.
import { MOOD_BY_KEY, MOOD_KEYS, type MoodKey } from "~/domain/moods"
import { loadTaste } from "~/server/taste/index.server"
import {
	type CardService,
	MAX_KEYS,
	type TitleCard,
	getServiceCards,
	getTitleCards,
} from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import { getViewerContext } from "~/server/viewer.server"
import { getWatchNext, worthwhileSuggestions } from "~/server/watch-next.server"
import type {
	LivingRoomData,
	LivingRoomTitle,
	TvPair,
} from "~/ui/living-room/living-room-data"

const PER_MOOD = 3
const BEST = 6
const CATALOG = 12

// Contrasting moods for "Which one, tonight?".
const PAIRS: [MoodKey, MoodKey][] = [
	["funny", "heavy"],
	["action", "romance"],
	["feelgood", "scary"],
	["mind", "worlds"],
	["crime", "growing"],
	["history", "funny"],
]

export async function getLivingRoomData(
	request: Request,
): Promise<LivingRoomData> {
	const ctx = await getViewerContext(request)
	const taste = await loadTaste(ctx.viewer)
	const member = ctx.viewer.kind === "member"

	// The best few for any mood, then a few per mood, without repeats.
	const keys: number[] = []
	const byMood = new Map<MoodKey, number[]>()
	const add = (list: number[]) => {
		for (const k of list) if (!keys.includes(k)) keys.push(k)
	}
	add(
		worthwhileSuggestions(ctx, taste, {
			moods: [],
			onMyServices: false,
			count: BEST,
		}),
	)
	for (const mood of MOOD_KEYS) {
		const list = worthwhileSuggestions(ctx, taste, {
			moods: [mood],
			onMyServices: false,
			count: PER_MOOD + 2,
		})
		byMood.set(mood, list)
		add(list.slice(0, PER_MOOD))
	}

	const [cards, watchNext, saved] = await Promise.all([
		getTitleCards(keys.slice(0, MAX_KEYS), ctx, taste),
		member ? getWatchNext(ctx, { onMyServices: false }, taste) : null,
		getServiceCards(ctx.services),
	])
	const snapshot = getTitleSnapshot()
	const withMoods = (card: TitleCard): LivingRoomTitle => ({
		...card,
		moods: snapshot?.facts(card.key)?.moods ?? [],
	})
	const suggestions = cards.map(withMoods)

	const wishlist: LivingRoomTitle[] = watchNext
		? [
				...(watchNext.hero ? [watchNext.hero] : []),
				...watchNext.thenColumn,
				...watchNext.tiers.flatMap((t) => t.titles ?? []),
			]
		: []

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
		catalog: catalogOf([...wishlist, ...suggestions], saved),
		savedServices: saved.map((s) => s.name),
		pairs,
	}
}

// The services the titles stream on, the viewer's own first, then the most common.
function catalogOf(titles: TitleCard[], saved: CardService[]): CardService[] {
	const counts = new Map<string, { service: CardService; n: number }>()
	for (const t of titles)
		for (const s of t.services ?? []) {
			const c = counts.get(s.name)
			if (c) c.n++
			else counts.set(s.name, { service: s, n: 1 })
		}
	const common = [...counts.values()]
		.sort((a, b) => b.n - a.n)
		.map((c) => c.service)
	const out: CardService[] = []
	for (const s of [...saved, ...common])
		if (!out.some((o) => o.name === s.name)) out.push(s)
	return out.slice(0, CATALOG)
}
