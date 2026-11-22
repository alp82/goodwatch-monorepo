import type { ShowTitle } from "~/domain/browse/types"
import { copyMediaPresentation } from "~/utils/media-presentation"
import type { PlacePageData } from "./place-page.server"

/** The lattice and steering previews need artwork and names. Keep their identity and provenance
 * for the route's localization overlay, while the stage and quick views keep their full cards. */
function posterPreview({ card }: ShowTitle) {
	return {
		card: {
			key: card.key,
			media_type: card.media_type,
			tmdb_id: card.tmdb_id,
			title: card.title,
			poster_path: card.poster_path,
			tagline: card.tagline,
			...copyMediaPresentation(card),
		},
	}
}

export function placeDisplayData(data: PlacePageData) {
	return {
		...data,
		dz: {
			...data.dz,
			field: (data.dz.field ?? []).map((point) => ({
				...point,
				titles: point.titles.map(posterPreview),
			})),
		},
		kinds: data.kinds.map(({ id, name, share, mood, traits, titles }) => ({
			id,
			name,
			share,
			mood,
			traits: traits.slice(0, 2).map(({ word, color }) => ({ word, color })),
			titles: titles.slice(0, 3).map(posterPreview),
		})),
	}
}

export type PlaceDisplayData = ReturnType<typeof placeDisplayData>
