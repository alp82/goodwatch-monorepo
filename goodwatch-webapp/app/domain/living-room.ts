import { MOOD_KEYS, type MoodKey } from "~/domain/moods"
import type { CardService, TitleCard } from "~/server/title-cards.server"
import type { TvContext } from "~/ui/living-room/tv-flow"

export interface LivingRoomData {
	context: TvContext
	country: string
	services: CardService[]
	selectedServiceIds: number[]
	wishlistTotal: number
	/** All Wishlist titles per mood, before service filtering. Null for guests or while the snapshot loads. */
	wishlistMoodCounts: Record<MoodKey, number> | null
	taste: { signal: "none" | "some"; ratings: number; liked: number }
}

export interface LivingRoomPicks {
	titles: (TitleCard & { tvKey: string })[]
	pickKeys: string[]
	source: "wishlist" | "new"
}

/** Overlay on-demand results and browser-owned quiz/service progress before calling useTvFlow. */
export function livingRoomContext(
	data: LivingRoomData,
	progress: Partial<Omit<TvContext, "member" | "moodKeys">> = {},
): TvContext {
	return { ...data.context, ...progress }
}

export function emptyLivingRoomContext(): TvContext {
	return {
		member: false,
		pickKeys: [],
		wishlistKeys: [],
		serviceNames: [],
		moodKeys: [...MOOD_KEYS],
		hasServices: false,
		answered: 0,
		pairsLeft: 0,
	}
}
