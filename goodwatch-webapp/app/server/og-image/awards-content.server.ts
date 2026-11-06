// What the cards of the awards pages show (AwardsCard.tsx, and the title card for a body), from the same reads as
// the pages (server/award-pages.server.ts). A page that answers 404 has no card: its read returns null here too.
// Posters are TMDB URLs here; og-image.server.tsx inlines them.
import { bodyBySlug } from "~/domain/award-pages"
import type {
	AwardTitle,
	getAwardBody,
	getAwardCategory,
	getAwardCeremony,
} from "~/server/award-pages.server"
import type { OgAwardsContent } from "~/ui/og-image/AwardsCard"
import type { OgTitleContent } from "~/ui/og-image/OgCard"
import { AWARDS_CARD_COPY as COPY } from "~/ui/og-image/copy"
import { TMDB_IMAGE_BASE } from "~/utils/tmdb-image"

export interface AwardDeps {
	body: typeof getAwardBody
	ceremony: typeof getAwardCeremony
	category: typeof getAwardCategory
}

type Poster = Pick<AwardTitle, "poster_path">

const poster = (title: Poster | undefined, size: "w342" | "w500") =>
	title?.poster_path ? `${TMDB_IMAGE_BASE}/${size}${title.poster_path}` : null

const MAX_SLUG_LENGTH = 120
// The category card's row holds six years (AwardsCard.tsx).
const ROW_YEARS = 6

/**
 * The canonical card path of an awards page, or null for an address that has none: /awards, /awards/<body>,
 * /awards/<body>/<year> and /awards/<body>/category/<slug>. As in the routes, "awards" and "category" match in any
 * case and the body and category slugs only as written. A year or category without a page is found when the card is
 * drawn.
 */
export function canonicalAwardsPath(
	segments: readonly string[],
): string | null {
	const [, slug, third, fourth] = segments
	if (segments.length === 1) return "/awards"
	const body = bodyBySlug(slug)
	if (!body) return null
	if (segments.length === 2) return `/awards/${body.slug}`
	if (segments.length === 3)
		return /^\d{4}$/.test(third) ? `/awards/${body.slug}/${third}` : null
	if (
		segments.length === 4 &&
		third.toLowerCase() === "category" &&
		fourth.length <= MAX_SLUG_LENGTH
	)
		return `/awards/${body.slug}/category/${fourth}`
	return null
}

/** The card of a canonical awards path (see canonicalAwardsPath), or null when its page answers 404. */
export async function awardsContent(
	path: string,
	deps: AwardDeps,
): Promise<OgAwardsContent | OgTitleContent | null> {
	const [, slug, third, fourth] = path.split("/").filter(Boolean)

	if (!slug) {
		// Each body's latest ceremony leads with its top category, so its first result is the top winner.
		const latest = await Promise.all(
			COPY.hubBodies.map(async (bodySlug) => {
				const page = await deps.body(bodySlug)
				const winner = page?.latest.results[0]?.winner
				return page && winner?.poster_path
					? { src: poster(winner, "w342"), label: page.body.name }
					: null
			}),
		)
		const posters = latest.filter((p) => p !== null)
		if (!posters.length) return null
		return {
			kind: "awards",
			layout: "row",
			labels: "name",
			tag: COPY.hubTag,
			headline: COPY.hub,
			posters,
		}
	}

	if (!third) {
		const page = await deps.body(slug)
		if (!page) return null
		const { body } = page
		return {
			kind: "title",
			tag:
				body.official !== body.name ? body.official : COPY.kindTag(body.kind),
			title: COPY.body(body.name),
			score: null,
			poster: poster(page.latest.results[0]?.winner, "w500"),
		}
	}

	if (third !== "category") {
		const page = await deps.ceremony(slug, third)
		if (!page) return null
		return {
			kind: "awards",
			layout: "year",
			tag: page.body.name,
			year: page.year,
			poster: poster(page.categories[0]?.winners[0], "w500"),
		}
	}

	const page = await deps.category(slug, fourth)
	if (!page) return null
	// Newest first; a year whose winner has no poster is left out of the row.
	const years = page.years.filter((y) => y.winners[0]?.poster_path)
	if (years.length > 1)
		return {
			kind: "awards",
			layout: "row",
			labels: "year",
			tag: page.body.name,
			headline: page.name,
			posters: years.slice(0, ROW_YEARS).map((y) => ({
				src: poster(y.winners[0], "w342"),
				label: String(y.year),
			})),
		}
	// One winner reads better as a big poster beside the category.
	return {
		kind: "title",
		tag: page.body.name,
		title: page.name,
		score: null,
		poster: poster((years[0] ?? page.years[0]).winners[0], "w500"),
	}
}
