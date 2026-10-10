import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import React, { useEffect, useMemo } from "react"
import { useUpdateUrlParams } from "~/hooks/updateUrlParams"
import { resolveCountry } from "~/server/country.server"
import { isCrawler } from "~/server/crawlers.server"
import { getDetailsForMovie, getDetailsForShow } from "~/server/details.server"
import { getEpisodeGrid } from "~/server/episode-grid.server"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { relatedPrefetchBudgetMs } from "~/server/related-budget"
import { prefetchRelatedSection, relatedSectionData } from "~/server/related-map.server"
import { titleExtrasEmbedded } from "~/server/title-extras-prefetch"
import { prefetchTitleExtrasState } from "~/server/title-extras.server"
import type { ShowQueryResult } from "~/server/types/details-types"
import { getUserSettings } from "~/server/user-settings.server"
import Details from "~/ui/details/Details"
import { searchDetailShouldRevalidate } from "~/ui/search/search-navigation"
import { getUserIdFromRequest } from "~/utils/auth"
import { detailsPageMeta } from "~/utils/detailsMeta"
import { type EpisodeGridWire, packEpisodeGrid, unpackEpisodeGrid } from "~/utils/episode-grid-wire"
import { titleToDashed } from "~/utils/helpers"
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
	const userSettings = await getUserSettings({ userId })

	const url = new URL(request.url)
	const { country, countryIsFallback } = resolveCountry({
		request,
		countryDefault: userSettings?.country_default,
	})
	const language = url.searchParams.get("language") || "en"
	const budgetMs = relatedPrefetchBudgetMs(isCrawler(request))
	const details = getDetailsForShow({
		showId,
		country,
		language,
	})
	let episodeGridFailed = false
	const [media, episodeGrid, relatedSection, extrasState] = await Promise.all([
		details,
		// A failed grid read hides the grid; it never fails the page.
		getEpisodeGrid({ showId })
			.then((grid) => grid && packEpisodeGrid(grid))
			.catch((error) => {
				episodeGridFailed = true
				console.error("episode grid failed", { showId, error })
				return null
			}),
		prefetchRelatedSection({
			tmdbId: Number(showId),
			sourceMediaType: "show",
			budgetMs,
		}),
		// The header's genre links, which the page requested after load before.
		details.then(
			(media) =>
				prefetchTitleExtrasState({ genres: media.details.genres, budgetMs }),
			// A failed details read fails the page above.
			() => null,
		),
	])
	// The related map's section, or with the map off the related titles carousel's first panel.
	const related = relatedSectionData(relatedSection, media.details.title)
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
	return complete
		? data
		: json(data, { headers: INCOMPLETE_PAGE_HEADERS })
}

export default function DetailsTV() {
	const { media, episodeGrid: episodeGridWire, params, countryIsFallback } = useLoaderData<LoaderData>()
	const { country } = params
	const episodeGrid = useMemo(() => episodeGridWire && unpackEpisodeGrid(episodeGridWire), [episodeGridWire])

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

	// The server guessed the country (Accept-Language or US). A country the
	// visitor picked earlier on this device wins, so switch to it; otherwise
	// keep the server's choice and leave the URL alone.
	useEffect(() => {
		if (!countryIsFallback) return
		let stored: string | null = null
		try {
			stored = localStorage.getItem("country")
		} catch {}
		if (!stored || !/^[A-Z]{2}$/.test(stored) || stored === country) return
		updateParams({ ...currentParams, country: stored }, true)
	}, [media, country, countryIsFallback])

	return <Details media={media} country={country} episodeGrid={episodeGrid} />
}

// Search refinements do not change the currently loaded title.
export const shouldRevalidate = searchDetailShouldRevalidate
