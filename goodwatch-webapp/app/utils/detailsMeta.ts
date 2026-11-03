import { canonicalMediaTitle } from "~/utils/media-presentation";
import type { MovieResult, ShowResult } from "~/server/types/details-types";
import { splitLead } from "~/ui/details/synopsis-fold";
import { summary } from "~/ui/fingerprint/fingerprintText";
import { titlePath } from "~/utils/helpers";
import { type Crumb, titleTrail } from "~/ui/nav/breadcrumb-trail";
import { type PageMeta, buildMeta } from "~/utils/meta";

const clip = (text: string, max: number) =>
	text.length <= max
		? text
		: `${text.slice(0, text.lastIndexOf(" ", max)).replace(/[,.;:]$/, "")}…`;

/**
 * A title page's meta tags and structured data, with its trail from the hub (title-breadcrumb.server.ts) and the
 * watch links of the country the page shows offers for.
 */
export function detailsMetaTags(
	media: MovieResult | ShowResult,
	breadcrumb: readonly Crumb[] = [],
	country?: string,
) {
	const pageMeta = detailsPageMeta(media);
	return buildMeta({
		pageMeta,
		item: media,
		country,
		breadcrumbs: titleTrail(
			breadcrumb,
			media.details.title,
			new URL(pageMeta.url).pathname,
		),
	});
}

/**
 * What the description says the title is, as the page's Summary does: the synopsis's first sentence, then its first
 * two essence tags as a short pulse ("Feels like Samurai Epic and Heroic Last Stand."). Only a title with neither falls
 * back to the fingerprint's template sentence.
 */
export function metaLead(media: MovieResult | ShowResult): string {
	const { details, mediaType } = media;
	const first = details.synopsis
		? clip(splitLead(details.synopsis)[0], 160)
		: "";
	const tags = (media.fingerprint?.essenceTags ?? []).slice(0, 2);
	const pulse = tags.length ? `Feels like ${tags.join(" and ")}.` : "";
	if (first || pulse) return [first, pulse].filter(Boolean).join(" ");
	return media.fingerprint
		? summary({
				title: details.title,
				mediaType,
				year: details.release_year,
				genres: details.genres,
				fingerprint: media.fingerprint,
			})
		: "";
}

// Title, description, and share image for a movie or show page. The description says what the title is, then names
// legal streaming as what the page offers.
export function detailsPageMeta(media: MovieResult | ShowResult): PageMeta {
	const { details, mediaType } = media;
	const name = `${details.title} (${details.release_year})`;
	const typedName = `${name} ${mediaType === "movie" ? "Movie" : "TV Show"}`;
	// Shorten the page's promise before ever shortening a proper name.
	const title =
		[
			`${typedName}: Ratings and Streaming`,
			`${typedName}: Ratings`,
			typedName,
		].find((candidate) => candidate.length <= 60) ?? typedName;
	const lead = metaLead(media);
	const backdrop =
		media.images?.backdrops?.[0]?.file_path || details.backdrop_path;
	// The share card shows the poster and the score only when they exist.
	const score = details.goodwatch_overall_score_normalized_percent;
	const cardParts = [
		details.poster_path && "poster",
		typeof score === "number" &&
			score >= 0 &&
			score <= 100 &&
			"GoodWatch score",
	].filter(Boolean);
	return {
		title: `${title} | GoodWatch`,
		description:
			`${name}: ${lead} See where to stream it legally and how critics and audiences rate it.`
				.replace(/\s+/g, " ")
				.trim(),
		url: `https://goodwatch.app${titlePath(mediaType, details.tmdb_id, canonicalMediaTitle(details))}`,
		image: backdrop
			? `https://image.tmdb.org/t/p/w1280${backdrop}`
			: `https://image.tmdb.org/t/p/w780${details.poster_path}`,
		alt: cardParts.length
			? `${name} on GoodWatch: ${cardParts.join(" and ")}`
			: `${name} on GoodWatch`,
	};
}
