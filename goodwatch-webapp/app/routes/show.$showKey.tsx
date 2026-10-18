import { overlayAlignedGrid } from "~/server/episode-text-overlay.server"
import { canonicalMediaTitle } from "~/utils/media-presentation"
import { normalizeCountry } from "~/utils/media-language"
import { mayAdoptLegacyCountry } from "~/utils/legacy-country"
import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
	redirect,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import React, { useEffect, useMemo } from "react"
import { useUpdateUrlParams } from "~/hooks/updateUrlParams"
import { resolveMediaContext } from "~/server/media-context.server"
import { isCrawler } from "~/server/crawlers.server"
import { getDetailsForMovie, getDetailsForShow } from "~/server/details.server"
import { getEpisodeGrid } from "~/server/episode-grid.server"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { relatedPrefetchBudgetMs } from "~/server/related-budget"
import {
	relatedMapLookup,
	relatedSectionData,
} from "~/server/related-map.server"
import { titleExtrasEmbedded } from "~/server/title-extras-prefetch"
import { prefetchTitleExtrasState } from "~/server/title-extras.server"
import type { ShowQueryResult } from "~/server/types/details-types"
import { talkedAboutNowEnabled } from "~/server/talked-about-now/flags.server"
import {
	TITLE_BUDGET_MS,
	type TitleSides,
	titleSides,
	titleSidesWithin,
} from "~/server/title-sides.server"
import Details from "~/ui/details/Details"
import type { Crumb } from "~/ui/nav/breadcrumb-trail"
import { titleBreadcrumb } from "~/server/title-breadcrumb.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { detailsMetaTags } from "~/utils/detailsMeta"
import {
	type EpisodeGridWire,
	packEpisodeGrid,
	unpackEpisodeGrid,
} from "~/utils/episode-grid-wire"
import { titleRedirectPath } from "~/utils/helpers"
import { windowEpisodeGrid } from "~/ui/details/episode-grid/window"
import { START_AFTER_PAINT } from "~/utils/start-after-paint"
import { mergeDehydratedStates } from "~/utils/title-extras"

export { pageHeaders as headers } from "~/utils/headers"
// The page paints from the server's HTML alone; its scripts start after that (utils/start-after-paint.ts). A tap
// before then waits for its control (utils/replay-tap.ts).
export const handle = START_AFTER_PAINT

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Not Found | GoodWatch" }]
	return detailsMetaTags(data.media, data.breadcrumb)
}

type LoaderData = {
	media: ShowQueryResult
	/** The whole grid, or its newest part when it is long (see episode-grid/window.ts). */
	episodeGrid: EpisodeGridWire | null
	params: {
		country: string
	}
	countryIsFallback: boolean
	/** Whether the viewer gets the "Talked about now" section (TALKED_ABOUT_NOW_TITLE). */
	talkedAboutNow: boolean
	/** Where the title sits in the signed-in member's taste (taste groups); null for everyone else. */
	sides: TitleSides | null
	/** The hub and genre page above the title (title-breadcrumb.server.ts). */
	breadcrumb: Crumb[]
}

export const loader: LoaderFunction = async ({
	params,
	request,
}: LoaderFunctionArgs) => {
	const showId = (params.showKey || "").split("-")[0]

	const userId = await getUserIdFromRequest({ request })
	// Taste groups for a signed-in member, alongside the reads below; the page waits for it within its budget only.
	const sidesStart = Date.now()
	const sidesWork = titleSides(request, userId, "show", Number(showId))
	sidesWork.catch(() => {})
	const url = new URL(request.url)
	const { effectiveContext } = await resolveMediaContext(request, userId)
	const { country } = effectiveContext
	const countryIsFallback = !normalizeCountry(url.searchParams.get("country"))
	const canonicalContent = isCrawler(request)
	const language = canonicalContent ? "en" : effectiveContext.language
	const budgetMs = relatedPrefetchBudgetMs(isCrawler(request))
	const details = getDetailsForShow(
		{
			showId,
			country,
			language,
		},
		{ canonical: canonicalContent },
	)
	let episodeGridFailed = false
	const parts = Promise.all([
		details,
		// A failed grid read hides the grid; it never fails the page. A long grid sends its newest part, which keeps
		// the page within what search engines read; the rest loads on request (api.episode-grid.ts).
		getEpisodeGrid({ showId })
			.then(async (grid) => {
				if (!grid) return null
				const first = windowEpisodeGrid(grid)
				const part =
					first.window && !canonicalContent
						? { ...first, window: { ...first.window, language } }
						: first
				return {
					wire: packEpisodeGrid(
						canonicalContent ? part : await overlayAlignedGrid(part, language),
					),
					// The whole grid's seasons, for the page's season list.
					seasons: grid.seasons
						.filter((s) => s.number > 0)
						.map((s) => ({
							season_number: s.number,
							episode_count: s.episodes.length,
						})),
					presentationVersion: grid.presentationVersion,
				}
			})
			.catch((error) => {
				episodeGridFailed = true
				console.error("episode grid failed", { showId, error })
				return null
			}),
		relatedMapLookup({
			type: "show",
			id: Number(showId),
			budgetMs,
			language: canonicalContent ? undefined : language,
		}),
		// The header's genre links, which the page requested after load before.
		details.then(
			(media) =>
				prefetchTitleExtrasState({
					genres: media.details.genres,
					budgetMs,
					language: canonicalContent ? undefined : language,
				}),
			// A failed details read fails the page above.
			() => null,
		),
	])
	// The await below throws a failed details read. This keeps the same failure from also counting as unhandled.
	parts.catch(() => {})

	// One URL per title: a wrong, missing, or decorated slug moves to the canonical path. The title's name comes from
	// the details read, so the answer doesn't wait for the related titles.
	const { details: titleDetails } = await details
	const canonical = titleRedirectPath({
		pathname: url.pathname,
		search: url.search,
		mediaType: "show",
		tmdbId: titleDetails.tmdb_id,
		title: canonicalMediaTitle(titleDetails),
	})
	if (canonical) return redirect(canonical, 301)

	const [catalogMedia, gridRead, relatedSection, extrasState] = await parts
	const episodeGrid = gridRead?.wire ?? null
	const alignedMedia = gridRead?.presentationVersion
		? {
				...catalogMedia,
				seasons: gridRead.seasons,
				details: {
					...catalogMedia.details,
					number_of_seasons: gridRead.seasons.length,
				},
			}
		: catalogMedia
	const media = alignedMedia
	// The related map's section.
	const related = relatedSectionData(
		relatedSection,
		media.details.title,
		request,
		canonicalContent ? undefined : language,
	)
	const dehydratedState = mergeDehydratedStates(extrasState)

	const sides = await titleSidesWithin(sidesWork, sidesStart, TITLE_BUDGET_MS)
	const data = {
		media,
		episodeGrid,
		params: {
			country,
		},
		countryIsFallback,
		talkedAboutNow: talkedAboutNowEnabled("title", userId),
		sides,
		breadcrumb: titleBreadcrumb("show", media.details.genres),
		dehydratedState,
		...(related.relatedMap && { relatedMap: related.relatedMap }),
	}
	// A failed grid read or missing related titles or a missing extra makes the page incomplete.
	// No cache may keep it. A grid read that resolves to null is complete.
	const complete =
		!episodeGridFailed &&
		related.complete &&
		titleExtrasEmbedded(extrasState, { genres: media.details.genres })
	return complete ? data : json(data, { headers: INCOMPLETE_PAGE_HEADERS })
}

export default function DetailsTV() {
	const {
		media,
		episodeGrid: episodeGridWire,
		params,
		countryIsFallback,
		talkedAboutNow,
		sides,
		breadcrumb,
	} = useLoaderData<LoaderData>()
	const { country } = params
	const episodeGrid = useMemo(
		() => episodeGridWire && unpackEpisodeGrid(episodeGridWire),
		[episodeGridWire],
	)

	// console.log(media)

	// return (
	// 	<>
	// 		{media.images.backdrops.map((backdrop) => (
	// 			<div key={backdrop.file_path}>
	// 				<span>{backdrop.file_path}</span>
	// 				<img src={`https://image.tmdb.org/t/p/w1280/${backdrop.file_path}`} />
	// 			</div>
	// 		))}
	// 	</>
	// )

	const { currentParams, updateParams } = useUpdateUrlParams({
		params,
	})

	// Check old device storage only when the URL has no country. Saved-cookie/account provenance
	// is fetched privately so this HTML can be shared with every visitor with the same effective pair.
	useEffect(() => {
		if (!countryIsFallback) return
		let stored: string | null = null
		try {
			stored = localStorage.getItem("country")
		} catch {}
		if (!stored || !/^[A-Z]{2}$/.test(stored) || stored === country) return
		const controller = new AbortController()
		void mayAdoptLegacyCountry(stored, country, controller.signal)
			.then((allowed) => {
				if (allowed && !controller.signal.aborted)
					updateParams({ ...currentParams, country: stored! }, true)
			})
			.catch(() => {})
		return () => controller.abort()
	}, [media, country, countryIsFallback])

	return (
		<Details media={media} country={country} episodeGrid={episodeGrid} talkedAboutNow={talkedAboutNow} sides={sides} breadcrumb={breadcrumb} />
	)
}
