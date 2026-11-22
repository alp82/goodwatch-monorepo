import type { ShowTitle } from "~/domain/browse/types"
import { copyMediaPresentation } from "~/utils/media-presentation"
import type { PlacePageData } from "./place-page.server"

/** Every title in the tuning pool can enter the grid. Keep the fields read by its poster,
 * service and rating marks, quick view, title actions, and localized canonical link. */
function stageTitle({ card }: ShowTitle) {
	return {
		card: {
			key: card.key,
			media_type: card.media_type,
			tmdb_id: card.tmdb_id,
			title: card.title,
			poster_path: card.poster_path,
			release_year: card.release_year,
			goodwatch_overall_score_normalized_percent: card.goodwatch_overall_score_normalized_percent,
			services: card.services,
			rating: card.rating,
			...copyMediaPresentation(card),
		},
	}
}

/** The lattice and steering previews need artwork and names. Keep their identity and provenance
 * for the route's localization overlay, including localized poster artwork. */
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
		pool: data.pool.map(({ t, s, m }) => ({ t: stageTitle(t), s, m })),
		list: { ...data.list, titles: data.list.titles.map(stageTitle) },
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
