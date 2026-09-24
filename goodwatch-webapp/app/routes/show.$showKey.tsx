import { searchDetailShouldRevalidate } from "~/ui/search/search-navigation"
import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import React, { useEffect } from "react"
import { useUpdateUrlParams } from "~/hooks/updateUrlParams"
import { getDetailsForShow, getDetailsForMovie } from "~/server/details.server"
import { resolveCountry } from "~/server/country.server"
import { getUserSettings } from "~/server/user-settings.server"
import Details from "~/ui/details/Details"
import { getUserIdFromRequest } from "~/utils/auth"
import { titleToDashed } from "~/utils/helpers"
import { detailsPageMeta } from "~/utils/detailsMeta"
import { buildMeta } from "~/utils/meta"
import type { ShowQueryResult } from "~/server/types/details-types"

export { pageHeaders as headers } from "~/utils/headers"
export { retryNetworkLoader as clientLoader } from "~/utils/retry-network-loader"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Not Found | GoodWatch" }]
	return buildMeta({ pageMeta: detailsPageMeta(data.media), item: data.media })
}

type LoaderData = {
	media: ShowQueryResult
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
	const media = await getDetailsForShow({
		showId,
		country,
		language,
	})

	return {
		media,
		params: {
			country,
		},
		countryIsFallback,
	}
}

export default function DetailsTV() {
	const { media, params, countryIsFallback } = useLoaderData<LoaderData>()
	const { country } = params

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

	return <Details media={media} country={country} />
}

// Search refinements do not change the currently loaded title.
export const shouldRevalidate = searchDetailShouldRevalidate
