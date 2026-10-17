// PROTOTYPE - throwaway. Extra data for the landing variants of the start page: the first start titles as cards
// (score, services in the viewer's country, backdrop) with the three moods their title analysis is strongest in.
import { availabilityLoaded } from "~/server/availability-index.server"
import { getTopFingerprintKeys } from "~/server/fingerprint-preview.server"
import { adjective, isWorded } from "~/server/taste-portrait/words.server"
import { NO_TASTE } from "~/server/taste/taste.server"
import { type TitleCard, getTitleCards } from "~/server/title-cards.server"
import { getViewerContext } from "~/server/viewer.server"
import type { StartTitle } from "~/ui/living-room/living-room-data"
import { titleKey } from "~/utils/title-key"

export type LandingCard = TitleCard & { feels: string[] }

export async function loadLandingCards(request: Request, start: StartTitle[], count = 12): Promise<LandingCard[]> {
	const keys = start.slice(0, count).map((t) => titleKey(t.media_type, t.tmdb_id))
	const viewer = await getViewerContext(request)
	// The country's availability loads in the background after a restart: wait for it, so cards carry services.
	// Locally the US read can time out over the tunnel; the prototype then shows Germany's services.
	const ok = await availabilityLoaded(viewer.country, 15000)
	const cards = await getTitleCards(keys, ok ? viewer : { ...viewer, country: "DE" }, NO_TASTE)
	return Promise.all(
		cards.map(async (card) => {
			const top = await getTopFingerprintKeys({
				likedItems: [{ tmdb_id: card.tmdb_id, media_type: card.media_type }],
				topN: 8,
			}).catch(() => [])
			const feels = top.filter((k) => isWorded(k.key)).slice(0, 3).map((k) => adjective(k.key))
			return { ...card, feels }
		}),
	)
}
