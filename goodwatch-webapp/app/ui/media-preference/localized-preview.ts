// A titles language picked in the header pair, shown on the current title before it is kept: the title, poster,
// description and tagline from the read-only GET /api/media-title, laid over the page's own data. Nothing else on the
// page changes (seasons, related titles, offers follow after Keep, when the page reads its data again).
import {
	type LocalizedTitlePayload,
	type MediaPresentation,
	type PresentedMedia,
	presentationLanguage,
} from "../../utils/media-presentation.ts"

interface Overlaid {
	mediaType: "movie" | "show"
	details: PresentedMedia & {
		tmdb_id: number
		title: string
		poster_path: string
		synopsis: string
		tagline: string | null
	}
}

/** The language the page's text is in: what the server laid over it, or the canonical English. */
export const textLanguage = (media: Overlaid) =>
	media.details.presentation?.language ?? "en"

/** Whether a picked language needs other text than the page has. `language` is a code, never "browser". */
export const needsText = (media: Overlaid, language: string) =>
	presentationLanguage(language) !== textLanguage(media)

/**
 * The page's media with the payload's text fields, or null when the payload answers another title or another language
 * (a late answer for an earlier pick): it is never shown.
 */
export function withLocalizedText<M extends Overlaid>(
	media: M,
	payload: LocalizedTitlePayload | undefined,
	language: string,
): M | null {
	if (
		!payload ||
		payload.tmdb_id !== media.details.tmdb_id ||
		payload.media_type !== media.mediaType ||
		payload.presentation?.language !== presentationLanguage(language)
	)
		return null
	const { details } = media
	const presentation: MediaPresentation = payload.presentation
	return {
		...media,
		details: {
			...details,
			canonical_title: payload.canonical_title,
			title: payload.title || details.title,
			// A title without a poster keeps the one it has: the picked language has none to offer either.
			poster_path: payload.poster_path ?? details.poster_path,
			synopsis: payload.overview ?? payload.synopsis ?? details.synopsis,
			tagline: payload.tagline,
			presentation,
		},
	}
}
