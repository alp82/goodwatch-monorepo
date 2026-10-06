import { searchDetailShouldRevalidate } from "~/ui/search/search-navigation"
import { json, redirect } from "@remix-run/node"
import { canonicalTitleId } from "~/utils/title-identity"
import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import React, { useEffect } from "react"
import { useUpdateUrlParams } from "~/hooks/updateUrlParams"
import { getDetailsForMovie } from "~/server/details.server"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { isCrawler } from "~/server/crawlers.server"
import { relatedPrefetchBudgetMs } from "~/server/related-budget"
import { relatedPanelEmbedded } from "~/server/related-prefetch"
import { prefetchRelatedTitlesState } from "~/server/related.server"
import { prefetchTitleExtrasState } from "~/server/title-extras.server"
import { titleExtrasEmbedded } from "~/server/title-extras-prefetch"
import { mergeDehydratedStates } from "~/utils/title-extras"
import type { MovieQueryResult } from "~/server/types/details-types"
import { resolveCountry } from "~/server/country.server"
import { getUserSettings } from "~/server/user-settings.server"
import Details from "~/ui/details/Details"
import { getUserIdFromRequest } from "~/utils/auth"
import { titleToDashed } from "~/utils/helpers"
import { detailsPageMeta } from "~/utils/detailsMeta"
import { buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Not Found | GoodWatch" }]
	return buildMeta({ pageMeta: detailsPageMeta(data.media), item: data.media })
}

export type LoaderData = {
	media: MovieQueryResult
	params: {
		country: string
	}
	countryIsFallback: boolean
}

export const loader: LoaderFunction = async ({
	params,
	request,
}: LoaderFunctionArgs) => {
	const movieId = (params.movieKey || "").split("-")[0]

	const canonicalId = canonicalTitleId("movie", Number(movieId))
	if (Number.isSafeInteger(canonicalId) && canonicalId !== Number(movieId)) {
		const url = new URL(request.url)
		url.pathname = `/movie/${canonicalId}`
		return redirect(url.pathname + url.search, 301)
	}

	const userId = await getUserIdFromRequest({ request })
	const userSettings = await getUserSettings({ userId })

	const url = new URL(request.url)
	const { country, countryIsFallback } = resolveCountry({
		request,
		countryDefault: userSettings?.country_default,
	})
	const language = url.searchParams.get("language") || "en"
	const budgetMs = relatedPrefetchBudgetMs(isCrawler(request))
	const details = getDetailsForMovie({
		movieId,
		country,
		language,
	})
	const [media, relatedState, extrasState] = await Promise.all([
		details,
		prefetchRelatedTitlesState({
			tmdbId: Number(movieId),
			sourceMediaType: "movie",
			budgetMs,
		}),
		// The header's genre links and the collection's movies, which the page requested after load before.
		details.then(
			(media) =>
				prefetchTitleExtrasState({
					genres: media.details.genres,
					movieSeries: media.movie_series,
					budgetMs,
				}),
			// A failed details read fails the page above.
			() => null,
		),
	])
	const dehydratedState = mergeDehydratedStates(relatedState, extrasState)

	const data = {
		media,
		params: {
			country,
		},
		countryIsFallback,
		dehydratedState,
	}
	// Without the embedded related panel or an extra (a lookup ran out of its budget or failed) the page is incomplete:
	// no cache may keep it. The page cache and a cache in front follow this header.
	const complete =
		relatedPanelEmbedded(relatedState) &&
		titleExtrasEmbedded(extrasState, {
			genres: media.details.genres,
			movieSeries: media.movie_series,
		})
	return complete
		? data
		: json(data, { headers: INCOMPLETE_PAGE_HEADERS })
}

export default function DetailsMovie() {
	const { media, params, countryIsFallback } = useLoaderData<LoaderData>()
	const { country } = params

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

	return <Details media={media} country={country} />
}

// Search refinements do not change the currently loaded title.
export const shouldRevalidate = searchDetailShouldRevalidate
