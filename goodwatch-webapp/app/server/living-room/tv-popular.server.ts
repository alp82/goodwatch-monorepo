import { isOnServices } from "~/server/availability-index.server"
import type { Taste } from "~/server/taste/index.server"
import { getTitleCards } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import type { ViewerContext } from "~/server/viewer.server"
import type { TvHomeData } from "~/ui/living-room/tv/tv-home"
import { poolCandidates } from "./pool-keys.server"
import { popularHomeKeys } from "./popular-keys.server"

/** Member-only home row. Start titles below the room remain the shared, unfiltered list. */
export async function loadTvPopular(
	viewer: ViewerContext,
	taste: Taste,
): Promise<NonNullable<TvHomeData["popular"]>> {
	const snapshot = getTitleSnapshot()
	if (!snapshot)
		return {
			titles: [],
			scope: "unknown",
			country: viewer.country,
			failed: true,
		}
	const selected = popularHomeKeys(
		poolCandidates(snapshot, Math.floor(Date.now() / 86_400_000)),
		viewer,
		(key) => isOnServices(viewer.country, viewer.services, key),
	)
	return {
		titles: await getTitleCards(selected.keys, viewer, taste),
		scope: selected.scope,
		country: viewer.country,
	}
}
