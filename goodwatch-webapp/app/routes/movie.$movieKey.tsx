import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import React, { useEffect } from "react"
import { useUpdateUrlParams } from "~/hooks/updateUrlParams"
import { type MovieDetails, getDetailsForMovie } from "~/server/details.server"
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
		title: `${data.details.title} (${data.details.release_year}) | Movie | GoodWatch`,
		description: `Discover '${data.details.title}' (${data.details.release_year}) and find movies with similar plotlines, cast, genre, or tone. Dive deep into movie details and watch availability.`,
		url: `https://goodwatch.app/movie/${data.details.tmdb_id}-${titleToDashed(data.details.title)}`,
		image: `https://image.tmdb.org/t/p/w1280/${data.details.images.backdrops?.[0]?.file_path}`,
		alt: `${data.details.title} (${data.details.release_year}) movie poster`,
	}

	return buildMeta({ pageMeta, item: data.details })
}

export type LoaderData = {
	details: Awaited<MovieDetails>
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

	const details = await getDetailsForMovie({
		movieId,
		country,
		language,
	})

	return {
		details,
		params: {
			country,
		},
	}
}

export default function DetailsMovie() {
	const { details, params } = useLoaderData<LoaderData>()
	const { country } = params
	const { locale } = useLocale()

	// return (
	// 	<>
	// 		{details.images.backdrops.map((backdrop) => (
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

	return <Details details={details} country={country} />
}
