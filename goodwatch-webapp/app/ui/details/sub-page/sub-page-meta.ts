// A sub-page's meta tags: its own title, description and canonical address, its own share card (og-image
// title-sub-page-content.server.ts) and the trail from the hub through the title page
// to the sub-page as BreadcrumbList structured data. The title's own Movie or TVSeries data stays on its page.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { type Crumb, titleTrail } from "~/ui/nav/breadcrumb-trail"
import { buildMeta } from "~/utils/meta"
import { SUB, type SubKind, subPagePath, titlePagePath } from "./paths"

type Media = MovieResult | ShowResult

const SITE = "https://goodwatch.app"

/** The page's title before " | GoodWatch": the longest that fits 60 characters. */
function pageTitle(kind: SubKind, media: Media) {
	const name = `${media.details.title} (${media.details.release_year})`
	const options =
		kind === "fingerprint"
			? [`${name} Fingerprint: How It Feels`, `${name} Fingerprint`]
			: kind === "tropes"
				? [`${name} Tropes, from TV Tropes`, `${name} Tropes`]
				: [`${name} at a Glance: Facts, Content, Cast`, `${name} at a Glance`]
	return options.find((o) => o.length <= 60) ?? options[options.length - 1]
}

function description(kind: SubKind, media: Media, tropes?: number | null) {
	const { title } = media.details
	const noun = media.mediaType === "movie" ? "movie" : "show"
	if (kind === "fingerprint") {
		const tags = (media.fingerprint?.essenceTags ?? []).slice(0, 3)
		return `What ${title} does to you, effect by effect, and how strongly compared with popular ${noun}s.${
			tags.length ? ` In short: ${tags.join(", ")}.` : ""
		}`
	}
	if (kind === "tropes")
		return `${
			tropes ? `All ${tropes.toLocaleString("en-US")} tropes` : "Every trope"
		} of ${title} from TV Tropes, and how each one plays out in the ${noun}.`
	return `${title} at a glance: release, genres and language, the age ratings and what's in it, the cast and who made it.`
}

export function subPageMetaTags(
	kind: SubKind,
	media: Media,
	breadcrumb: readonly Crumb[],
	tropes?: number | null,
) {
	const path = subPagePath(kind, media)
	const title = media.details.title
	return buildMeta({
		pageMeta: {
			title: `${pageTitle(kind, media)} | GoodWatch`,
			description: description(kind, media, tropes),
			url: `${SITE}${path}`,
			image: media.details.backdrop_path
				? `https://image.tmdb.org/t/p/w1280${media.details.backdrop_path}`
				: `https://image.tmdb.org/t/p/w780${media.details.poster_path}`,
			alt: `${title} on GoodWatch: ${SUB[kind].label.toLowerCase()}`,
		},
		breadcrumbs: [
			...titleTrail(breadcrumb, title, titlePagePath(media)),
			{ label: SUB[kind].label, path },
		],
	})
}
