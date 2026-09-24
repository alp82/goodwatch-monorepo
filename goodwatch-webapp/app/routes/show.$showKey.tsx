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
import {
	getDetailsForShow,
	getDetailsForMovie,
} from "~/server/details.server"
import { getUserSettings } from "~/server/user-settings.server"
import Details from "~/ui/details/Details"
import { getUserIdFromRequest } from "~/utils/auth"
import { titleToDashed } from "~/utils/helpers"
import useLocale from "~/utils/locale"
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
}

export const loader: LoaderFunction = async ({
	params,
	request,
}: LoaderFunctionArgs) => {
	const showId = (params.showKey || "").split("-")[0]

	const userId = await getUserIdFromRequest({ request })
	const userSettings = await getUserSettings({ userId })

	const url = new URL(request.url)
	const country =
		url.searchParams.get("country") || userSettings?.country_default || ""
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
	}
}

export default function DetailsTV() {
	const { media, params } = useLoaderData<LoaderData>()
	const { country } = params
	const { locale } = useLocale()

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
