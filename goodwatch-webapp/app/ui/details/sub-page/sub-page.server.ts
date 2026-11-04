// What every sub-page's address loads (routes/movie.$movieKey_.*, show.$showKey_.*): the title as the title page has
// it (so the frame shows the same bar and rail), the member's taste groups, the country, and for a show its episodes
// as find reads them (code, name, score), so find on a sub-page searches the episodes as the title page's does. A
// wrong or missing slug moves to the canonical address, as the title page's does. Each route adds its own content.
import { type LoaderFunctionArgs, redirect } from "@remix-run/node"
import { isCrawler } from "~/server/crawlers.server"
import { getDetailsForMovie, getDetailsForShow } from "~/server/details.server"
import { getEpisodeGrid } from "~/server/episode-grid.server"
import { overlayAlignedGrid } from "~/server/episode-text-overlay.server"
import { resolveMediaContext } from "~/server/media-context.server"
import { titleBreadcrumb } from "~/server/title-breadcrumb.server"
import {
	TITLE_EPISODES_BUDGET_MS,
	optionalTitlePart,
	titleDetailsWithin,
} from "~/server/title-page-budget"
import {
	TITLE_BUDGET_MS,
	type TitleSides,
	titleSides,
	titleSidesWithin,
} from "~/server/title-sides.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { FindGrid } from "~/ui/details/find/find-index"
import { seasonSummary } from "~/ui/details/season-summary"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
import { getUserIdFromRequest } from "~/utils/auth"
import { canonicalTitleId } from "~/utils/title-identity"
import { type SubKind, subPagePath } from "./paths"

export interface SubPageData {
	media: MovieResult | ShowResult
	/** Where the title sits in the signed-in member's taste (taste groups); null for everyone else. */
	sides: TitleSides | null
	country: string
	/** The hub and genre page above the title (title-breadcrumb.server.ts), for the structured data's trail. */
	breadcrumb: Crumb[]
	/** A show's episodes for find; null for a movie or when the grid isn't there in time. */
	findGrid: FindGrid | null
	/** False when a part ran out of time: the page must not be cached. */
	complete: boolean
}

/** Loads a sub-page's title, or throws the redirect to its canonical address or a 404. */
export async function loadSubPage(
	{ params, request }: LoaderFunctionArgs,
	type: "movie" | "show",
	kind: SubKind,
): Promise<SubPageData> {
	const key = (type === "movie" ? params.movieKey : params.showKey) ?? ""
	const id = Number(key.split("-")[0])
	if (!Number.isSafeInteger(id) || id < 1)
		throw new Response("Not found", { status: 404 })
	const url = new URL(request.url)
	const canonicalId = canonicalTitleId(type, id)
	if (Number.isSafeInteger(canonicalId) && canonicalId !== id)
		throw redirect(`/${type}/${canonicalId}/${kind}${url.search}`, 301)

	const userId = await getUserIdFromRequest({ request })
	const sidesStart = Date.now()
	const sidesWork = titleSides(request, userId, type, id)
	sidesWork.catch(() => {})
	const gridWork =
		type === "show" ? getEpisodeGrid({ showId: String(id) }) : null
	gridWork?.catch(() => {})
	const { effectiveContext } = await resolveMediaContext(request, userId)
	const { country } = effectiveContext
	const canonicalContent = isCrawler(request)
	const language = canonicalContent ? "en" : effectiveContext.language
	const media = await titleDetailsWithin<MovieResult | ShowResult>(
		type === "movie"
			? getDetailsForMovie(
					{ movieId: String(id), country, language },
					{ canonical: canonicalContent },
				)
			: getDetailsForShow(
					{ showId: String(id), country, language },
					{ canonical: canonicalContent },
				),
	)

	// One URL per sub-page: a wrong, missing or decorated slug moves to the canonical path. A canonical path that a URL
	// parser would rewrite could never be asked for as it is written, so it gets no redirect instead of a loop.
	const canonical = subPagePath(kind, media)
	if (
		url.pathname !== canonical &&
		new URL(canonical, url.origin).pathname === canonical
	)
		throw redirect(`${canonical}${url.search}`, 301)

	const grid = gridWork
		? await optionalTitlePart(
				"episode grid",
				async () => {
					const plain = await gridWork
					if (!plain) return null
					return {
						plain,
						shown: canonicalContent
							? plain
							: await overlayAlignedGrid(plain, language),
					}
				},
				TITLE_EPISODES_BUDGET_MS,
			)
		: { complete: true as const, value: null }
	const findGrid: FindGrid | null = grid.value
		? {
				seasons: grid.value.shown.seasons.map((s) => ({
					number: s.number,
					episodes: s.episodes.map((e) => ({
						number: e.number,
						name: e.name,
						score: e.score,
						unrated: e.unrated,
					})),
				})),
			}
		: null
	const sides = await titleSidesWithin(sidesWork, sidesStart, TITLE_BUDGET_MS)
	return {
		// A show's season summary, as the title page's questions read it.
		media:
			grid.value && media.mediaType === "show"
				? {
						...media,
						season_summary: seasonSummary(
							grid.value.plain,
							media.details.title,
						),
					}
				: media,
		sides,
		country,
		breadcrumb: titleBreadcrumb(type, media.details.genres),
		findGrid,
		complete: grid.complete,
	}
}
