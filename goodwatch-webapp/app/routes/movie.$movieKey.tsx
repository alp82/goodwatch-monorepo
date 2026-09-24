import { searchDetailShouldRevalidate } from "~/ui/search/search-navigation"
import { redirect } from "@remix-run/node"
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
import type { MovieQueryResult } from "~/server/types/details-types"
import { getUserSettings } from "~/server/user-settings.server"
import Details from "~/ui/details/Details"
import { getUserIdFromRequest } from "~/utils/auth"
import { titleToDashed } from "~/utils/helpers"
import useLocale from "~/utils/locale"
import { detailsPageMeta } from "~/utils/detailsMeta"
import { buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"
export { retryNetworkLoader as clientLoader } from "~/utils/retry-network-loader"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Not Found | GoodWatch" }]
	return buildMeta({ pageMeta: detailsPageMeta(data.media), item: data.media })
}

export type LoaderData = {
	media: MovieQueryResult
	params: {
		country: string
	}
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
	const country =
		url.searchParams.get("country") || userSettings?.country_default || ""
	const language = url.searchParams.get("language") || "en"
	const media = await getDetailsForMovie({
		movieId,
		country,
		language,
	})

	return {
		media,
		params: {
			country,
		},
	}
}

export default function DetailsMovie() {
	const { media, params } = useLoaderData<LoaderData>()
	const { country } = params
	const { locale } = useLocale()

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

	useEffect(() => {
		if (country === "") {
			const country = localStorage.getItem("country") || locale.country

			const newParams = {
				...currentParams,
				country,
			}
			updateParams(newParams)
		}
	}, [])

	return <Details media={media} country={country} />
}

// Search refinements do not change the currently loaded title.
export const shouldRevalidate = searchDetailShouldRevalidate
