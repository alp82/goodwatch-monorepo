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
import { getDetailsForMovie, getDetailsForShow, presentShowSeasonsAfterAlignment } from "~/server/details.server"
import { getEpisodeGrid } from "~/server/episode-grid.server"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { relatedPrefetchBudgetMs } from "~/server/related-budget"
import {
	prefetchRelatedSection,
	relatedSectionData,
} from "~/server/related-map.server"
import { titleExtrasEmbedded } from "~/server/title-extras-prefetch"
import { prefetchTitleExtrasState } from "~/server/title-extras.server"
import type { ShowQueryResult } from "~/server/types/details-types"
import Details from "~/ui/details/Details"
import { searchDetailShouldRevalidate } from "~/ui/search/search-navigation"
import { getUserIdFromRequest } from "~/utils/auth"
import { detailsPageMeta } from "~/utils/detailsMeta"
import {
	type EpisodeGridWire,
	packEpisodeGrid,
	unpackEpisodeGrid,
} from "~/utils/episode-grid-wire"
import { titleRedirectPath } from "~/utils/helpers"
import { buildMeta } from "~/utils/meta"
import { mergeDehydratedStates } from "~/utils/title-extras"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Not Found | GoodWatch" }]
	return buildMeta({ pageMeta: detailsPageMeta(data.media), item: data.media })
}

type LoaderData = {
	media: ShowQueryResult
	episodeGrid: EpisodeGridWire | null
	params: {
		country: string
	}
	countryIsFallback: boolean
}

export const loader: LoaderFunction = async ({
	params,
	request,
}: LoaderFunctionArgs) => {
	const showId = (params.showKey || "").split("-")[0]

	const userId = await getUserIdFromRequest({ request })
	const url = new URL(request.url)
	const { effectiveContext } = await resolveMediaContext(request, userId)
	const { country } = effectiveContext
	const countryIsFallback = !normalizeCountry(url.searchParams.get("country"))
	const canonicalContent = isCrawler(request)
	const language = canonicalContent ? "en" : effectiveContext.language
	const budgetMs = relatedPrefetchBudgetMs(isCrawler(request))
	const details = getDetailsForShow({
		showId,
		country,
		language,
	}, { canonical: canonicalContent })
	let episodeGridFailed = false
	const parts = Promise.all([
		details,
		// A failed grid read hides the grid; it never fails the page.
		getEpisodeGrid({ showId })
			.then(async (grid) => grid && packEpisodeGrid(canonicalContent ? grid : await overlayAlignedGrid(grid, language)))
			.catch((error) => {
				episodeGridFailed = true
				console.error("episode grid failed", { showId, error })
				return null
			}),
		prefetchRelatedSection({
			tmdbId: Number(showId),
			sourceMediaType: "show",
			budgetMs,
			language: canonicalContent ? undefined : language,
		}),
		// The header's genre links, which the page requested after load before.
		details.then(
			(media) =>
				prefetchTitleExtrasState({ genres: media.details.genres, budgetMs, language: canonicalContent ? undefined : language }),
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

	const [catalogMedia, episodeGrid, relatedSection, extrasState] = await parts
	const alignedMedia = episodeGrid?.presentationVersion
		? {
				...catalogMedia,
				seasons: episodeGrid.seasons
					.filter((s) => s[0] > 0)
					.map((s) => ({ season_number: s[0], episode_count: s[2].length })),
				details: {
					...catalogMedia.details,
					number_of_seasons: episodeGrid.seasons.filter((s) => s[0] > 0).length,
				},
			}
		: catalogMedia
	const media = canonicalContent ? alignedMedia : await presentShowSeasonsAfterAlignment(alignedMedia, language)
	// The related map's section, or with the map off the related titles carousel's first panel.
	const related = relatedSectionData(
		relatedSection,
		media.details.title,
		request,
	)
	const dehydratedState = mergeDehydratedStates(related.panelState, extrasState)

	const data = {
		media,
		episodeGrid,
		params: {
			country,
		},
		countryIsFallback,
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
		void mayAdoptLegacyCountry(stored, country, controller.signal).then(allowed => {
			if (allowed && !controller.signal.aborted) updateParams({ ...currentParams, country: stored! }, true)
		}).catch(() => {})
		return () => controller.abort()
	}, [media, country, countryIsFallback])

	return <Details media={media} country={country} episodeGrid={episodeGrid} />
}

// Search refinements do not change the currently loaded title.
export const shouldRevalidate = searchDetailShouldRevalidate
