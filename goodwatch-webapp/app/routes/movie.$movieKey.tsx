import { normalizeCountry } from "~/utils/media-language"
import { mayAdoptLegacyCountry } from "~/utils/legacy-country"
import { json, redirect } from "@remix-run/node"
import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import React, { useEffect } from "react"
import { useUpdateUrlParams } from "~/hooks/updateUrlParams"
import { resolveMediaContext } from "~/server/media-context.server"
import { isCrawler } from "~/server/crawlers.server"
import { getDetailsForMovie } from "~/server/details.server"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { relatedPrefetchBudgetMs } from "~/server/related-budget"
import { prefetchRelatedSection, relatedSectionData } from "~/server/related-map.server"
import { titleExtrasEmbedded } from "~/server/title-extras-prefetch"
import { prefetchTitleExtrasState } from "~/server/title-extras.server"
import type { MovieQueryResult } from "~/server/types/details-types"
import Details from "~/ui/details/Details"
import { searchDetailShouldRevalidate } from "~/ui/search/search-navigation"
import { getUserIdFromRequest } from "~/utils/auth"
import { detailsPageMeta } from "~/utils/detailsMeta"
import { titleRedirectPath } from "~/utils/helpers"
import { buildMeta } from "~/utils/meta"
import { mergeDehydratedStates } from "~/utils/title-extras"
import { canonicalTitleId } from "~/utils/title-identity"

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
	const url = new URL(request.url)
	const { effectiveContext } = await resolveMediaContext(request, userId)
	const { country } = effectiveContext
	const countryIsFallback = !normalizeCountry(url.searchParams.get("country"))
	const language = url.searchParams.get("language") || "en"
	const budgetMs = relatedPrefetchBudgetMs(isCrawler(request))
	const details = getDetailsForMovie({
		movieId,
		country,
		language,
	})
	const parts = Promise.all([
		details,
		prefetchRelatedSection({
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
	// The await below throws a failed details read. This keeps the same failure from also counting as unhandled.
	parts.catch(() => {})

	// One URL per title: a wrong, missing, or decorated slug moves to the canonical path. The title's name comes from
	// the details read, so the answer doesn't wait for the related titles.
	const { details: titleDetails } = await details
	const canonical = titleRedirectPath({
		pathname: url.pathname,
		search: url.search,
		mediaType: "movie",
		tmdbId: titleDetails.tmdb_id,
		title: titleDetails.title,
	})
	if (canonical) return redirect(canonical, 301)

	const [media, relatedSection, extrasState] = await parts
	// The related map's section, or with the map off the related titles carousel's first panel.
	const related = relatedSectionData(
		relatedSection,
		media.details.title,
		request,
	)
	const dehydratedState = mergeDehydratedStates(related.panelState, extrasState)

	const data = {
		media,
		params: {
			country,
		},
		countryIsFallback,
		dehydratedState,
		...(related.relatedMap && { relatedMap: related.relatedMap }),
	}
	// Without the related titles or an extra (a lookup ran out of its budget or failed) the page is incomplete:
	// no cache may keep it. The page cache and a cache in front follow this header.
	const complete =
		related.complete &&
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

	return <Details media={media} country={country} />
}

// Search refinements do not change the currently loaded title.
export const shouldRevalidate = searchDetailShouldRevalidate
