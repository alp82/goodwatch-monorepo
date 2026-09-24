import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { pillarLine, summary } from "~/ui/fingerprint/fingerprintText"
import { titleToDashed } from "~/utils/helpers"
import type { PageMeta } from "~/utils/meta"

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, text.lastIndexOf(" ", max)).replace(/[,.;:]$/, "")}…`)

// Title, description, and share image for a movie or show page. The
// description leads with the fingerprint summary, which only GoodWatch has,
// and names legal streaming as what the page offers.
export function detailsPageMeta(media: MovieResult | ShowResult): PageMeta {
	const { details, mediaType } = media
	const name = `${details.title} (${details.release_year})`
	const lead = media.fingerprint
		? `${summary({ title: details.title, mediaType, year: details.release_year, genres: details.genres, fingerprint: media.fingerprint })} ${pillarLine({ title: details.title, mediaType, year: details.release_year, genres: details.genres, fingerprint: media.fingerprint })}.`
		: details.synopsis
			? clip(details.synopsis, 140)
			: ""
	const backdrop = media.images?.backdrops?.[0]?.file_path || details.backdrop_path
	// The share card shows the poster and the score only when they exist.
	const score = details.goodwatch_overall_score_normalized_percent
	const cardParts = [details.poster_path && "poster", typeof score === "number" && score >= 0 && score <= 100 && "GoodWatch score"].filter(Boolean)
	return {
		title: `${name}: Where to Stream and Ratings | GoodWatch`,
		description: `${name}: ${lead} See where to stream it legally and how critics and audiences rate it.`.replace(/\s+/g, " ").trim(),
		url: `https://goodwatch.app/${mediaType}/${details.tmdb_id}-${titleToDashed(details.title)}`,
		image: backdrop ? `https://image.tmdb.org/t/p/w1280${backdrop}` : `https://image.tmdb.org/t/p/w780${details.poster_path}`,
		alt: cardParts.length ? `${name} on GoodWatch: ${cardParts.join(" and ")}` : `${name} on GoodWatch`,
	}
}
