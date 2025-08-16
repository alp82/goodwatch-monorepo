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
import { type PageMeta, buildMeta } from "~/utils/meta"

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const pageMeta: PageMeta = {
		title: `${data.media.details.title} (${data.media.details.release_year}) | Movie | GoodWatch`,
		description: `Discover '${data.media.details.title}' (${data.media.details.release_year}) and find movies with similar plotlines, cast, genre, or tone. Dive deep into movie details and watch availability.`,
		url: `https://goodwatch.app/movie/${data.media.details.tmdb_id}-${titleToDashed(data.media.details.title)}`,
		image: `https://image.tmdb.org/t/p/w1280/${data.media.images.backdrops?.[0]?.file_path}`,
		alt: `${data.media.details.title} (${data.media.details.release_year}) movie poster`,
	}

	return buildMeta({ pageMeta, item: data.media.details })
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
