import { timeRequestWork, withRequestTiming } from "~/utils/request-work"
import { canonicalMediaTitle } from "~/utils/media-presentation"
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
import { titleDetailsWithin } from "~/server/title-page-budget"
import { INCOMPLETE_PAGE_HEADERS } from "~/server/incomplete-page"
import { relatedPrefetchBudgetMs } from "~/server/related-budget"
import { relatedMapLookup, relatedSectionData } from "~/server/related-map.server"
import { titleExtrasEmbedded } from "~/server/title-extras-prefetch"
import { prefetchTitleExtrasState } from "~/server/title-extras.server"
import type { MovieQueryResult } from "~/server/types/details-types"
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
import {
	type GenreRow,
	genreRow,
	relatedMapKeys,
} from "~/server/genre-row/genre-row.server"
import { getUserIdFromRequest } from "~/utils/auth"
import { detailsMetaTags } from "~/utils/detailsMeta"
import { titleRedirectPath } from "~/utils/helpers"
import { mergeDehydratedStates } from "~/utils/title-extras"
import { canonicalTitleId } from "~/utils/title-identity"
import { titleKey } from "~/utils/title-key"
import { START_AFTER_PAINT } from "~/utils/start-after-paint"
import { heroHints } from "~/server/hero-hints.server"
import { heroBackdropFiles } from "~/ui/details/hero/Trailer"
import { cachedClientLoader } from "~/navigation/instant-navigation"

export { pageHeaders as headers } from "~/utils/headers"
// The page paints from the server's HTML alone; its scripts start after that (utils/start-after-paint.ts). A tap
// before then waits for its control (utils/replay-tap.ts).
export const handle = START_AFTER_PAINT

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Not Found | GoodWatch" }]
	return detailsMetaTags(data.media, data.breadcrumb, data.params.country)
}

export type LoaderData = {
	media: MovieQueryResult
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
	/** Eight titles of the breadcrumb's genre (genre-row.server.ts); missing without one. */
	genreRow?: GenreRow
}

const titleLoader = async ({
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
	// Taste groups for a signed-in member, alongside the reads below; the page waits for it within its budget only.
	const sidesStart = Date.now()
	const sidesWork = titleSides(request, userId, "movie", Number(movieId))
	sidesWork.catch(() => {})
	const url = new URL(request.url)
	const { effectiveContext } = await resolveMediaContext(request, userId)
	const { country } = effectiveContext
	const countryIsFallback = !normalizeCountry(url.searchParams.get("country"))
	const canonicalContent = isCrawler(request)
	const language = canonicalContent ? "en" : effectiveContext.language
	const budgetMs = relatedPrefetchBudgetMs(isCrawler(request))
	const details = titleDetailsWithin(
		timeRequestWork(request, "data", () =>
			getDetailsForMovie({ movieId, country, language }, { canonical: canonicalContent })),
	)
	const relatedWork = relatedMapLookup({ type: "movie", id: Number(movieId), budgetMs, language: canonicalContent ? undefined : language })
	const parts = Promise.all([
		details,
		relatedWork,
		// The header's genre links and the collection's movies, which the page requested after load before.
		details.then(
			(media) =>
				prefetchTitleExtrasState({
					genres: media.details.genres,
					movieSeries: media.movie_series,
					budgetMs,
					language: canonicalContent ? undefined : language,
				}),
			// A failed details read fails the page above.
			() => null,
		),
	])
	// The genre row starts with the details and reads its cards while the related map loads. It leaves out the
	// titles the related map and the collection show.
	const genreWork = details.then(
		(media) =>
			genreRow({
				mediaType: "movie",
				tmdbId: media.details.tmdb_id,
				genres: media.details.genres,
				exclude: (media.movie_series?.movie_ids ?? []).map((id) =>
					titleKey("movie", id),
				),
				later: relatedWork.then(relatedMapKeys, () => []),
				budgetMs,
				language: canonicalContent ? undefined : language,
			}).catch((error: unknown) => {
				console.error("Genre row failed", error)
				return "late" as const
			}),
		// A failed details read fails the page below.
		() => "late" as const,
	)
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
		title: canonicalMediaTitle(titleDetails),
	})
	if (canonical) return redirect(canonical, 301)

	const [media, relatedSection, extrasState] = await parts
	// The related map's section.
	const related = relatedSectionData(
		relatedSection,
		media.details.title,
		canonicalContent ? undefined : language,
	)
	const dehydratedState = mergeDehydratedStates(extrasState)

	const [sides, genre] = await Promise.all([
		titleSidesWithin(sidesWork, sidesStart, TITLE_BUDGET_MS),
		genreWork,
	])
	// The page's next 103 Early Hints response names its hero (server/hero-hints.ts).
	if (media.details.backdrop_path)
		heroHints.remember(new URL(request.url).pathname, heroBackdropFiles(media.details.backdrop_path))
	const data = {
		media,
		params: {
			country,
		},
		countryIsFallback,
		talkedAboutNow: talkedAboutNowEnabled("title", userId),
		sides,
		breadcrumb: titleBreadcrumb("movie", media.details.genres),
		dehydratedState,
		...(related.relatedMap && { relatedMap: related.relatedMap }),
		...(genre && genre !== "late" && { genreRow: genre }),
	}
	// Without the related titles or an extra (a lookup ran out of its budget or failed) the page is incomplete:
	// no cache may keep it. The page cache and a cache in front follow this header.
	const complete =
		related.complete &&
		genre !== "late" &&
		titleExtrasEmbedded(extrasState, {
			genres: media.details.genres,
			movieSeries: media.movie_series,
		})
	return complete
		? data
		: json(data, { headers: INCOMPLETE_PAGE_HEADERS })
}

export const loader: LoaderFunction = withRequestTiming(titleLoader)

export default function DetailsMovie() {
	const { media, params, countryIsFallback, talkedAboutNow, sides, breadcrumb, genreRow } = useLoaderData<LoaderData>()
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

	return <Details media={media} country={country} talkedAboutNow={talkedAboutNow} sides={sides} breadcrumb={breadcrumb} genreRow={genreRow} />
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/movie.$movieKey")
