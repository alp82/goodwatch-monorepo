import type { ViewerContext } from "../viewer.server.ts"
import type { TasteInteraction } from "../../ui/taste/types.ts"
import { type TitleKey, parseTitleKey, titleKey } from "../../utils/title-key.ts"
import { SAMPLE_RATINGS, SAMPLE_WANT_TO_SEE } from "./sample-ratings.ts"

/** Stable identity of every guest mark that affects portrait suggestions. */
export function guestMarksKey(ctx: ViewerContext): string {
	return JSON.stringify([
		[...ctx.ratings].sort((a, b) => a[0] - b[0]),
		[...ctx.seen].sort(),
		[...ctx.wishlist.keys()].sort(),
		[...ctx.skipped].sort(),
		[...ctx.notInterested].sort(),
		[...ctx.hidden].sort(),
	])
}

const keyOf = (id: string): TitleKey => {
	const [mediaType, tmdbId] = id.split("-")
	return titleKey(mediaType as "movie" | "show", Number(tmdbId))
}

/** The sample member, seen from where the guest watches. */
export function sampleContext(guest: ViewerContext): ViewerContext {
	const now = Date.now()
	const interactions: TasteInteraction[] = [
		...Object.entries(SAMPLE_RATINGS).map(([id, score]) => {
			const { mediaType, tmdbId } = parseTitleKey(keyOf(id))
			return {
				tmdb_id: tmdbId,
				media_type: mediaType,
				type: "score" as const,
				score: score as TasteInteraction["score"],
				timestamp: now,
			}
		}),
		...SAMPLE_WANT_TO_SEE.map((id) => {
			const { mediaType, tmdbId } = parseTitleKey(keyOf(id))
			return {
				tmdb_id: tmdbId,
				media_type: mediaType,
				type: "plan" as const,
				timestamp: now,
			}
		}),
	]
	const scores = new Map(
		Object.entries(SAMPLE_RATINGS).map(([id, score]) => [keyOf(id), score]),
	)
	return {
		...guest,
		viewer: { kind: "guest", progress: { interactions } },
		seen: new Set(scores.keys()),
		ratings: scores,
		wishlist: new Map(
			SAMPLE_WANT_TO_SEE.map((id) => [keyOf(id), new Date(now)]),
		),
		// The guest's own marks only keep titles out of the suggestions. `hidden` is read as an exclusion alone;
		// `skipped` would count as a dislike in the sample's portrait.
		skipped: new Set(),
		hidden: new Set([
			...guest.hidden,
			...guest.notInterested,
			...guest.skipped,
			...guest.seen,
			...guest.ratings.keys(),
			...guest.wishlist.keys(),
		]),
	}
}
