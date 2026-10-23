import { parseTitleKey } from "../../utils/title-key.ts"
import type { guestContext } from "../viewer.server.ts"
import type { worthwhileSuggestions } from "../watch-next.server.ts"
import type { Taste } from "../taste/index.server.ts"
import type { ViewerPlace } from "./place.server.ts"
import type { WatchOptions } from "./watch-id.ts"

interface PickDependencies {
	context: typeof guestContext
	suggest: typeof worthwhileSuggestions
	taste: Taste
}
/** Discord guests have place settings but no browser progress or Wishlist. */
export async function guestWatchPick(
	place: ViewerPlace,
	options: WatchOptions,
	given?: PickDependencies,
): Promise<string | null> {
	const deps = given ?? {
		context: (await import("../viewer.server.ts")).guestContext,
		suggest: (await import("../watch-next.server.ts")).worthwhileSuggestions,
		taste: (await import("../taste/taste.server.ts")).NO_TASTE,
	}
	const ctx = deps.context(
		{
			interactions: [],
			country: place.country,
			services: place.services ?? [],
		},
		place.country,
	)
	const idOf = (key: number) => {
		const { mediaType, tmdbId } = parseTitleKey(key)
		return `${mediaType}:${tmdbId}`
	}
	const [key] = deps.suggest(ctx, deps.taste, {
		moods: options.mood ? [options.mood] : [],
		onMyServices: !!place.services?.length,
		count: 1,
		fits: (key) => {
			const id = idOf(key)
			return (
				(options.type === "any" || id.startsWith(`${options.type}:`)) &&
				!options.recent.includes(id)
			)
		},
	})
	return key === undefined ? null : idOf(key)
}
