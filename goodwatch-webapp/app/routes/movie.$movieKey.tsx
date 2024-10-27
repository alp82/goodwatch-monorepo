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
import useLocale from "~/utils/locale"

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{
			title: `${data.details.title} (${data.details.release_year}) | Movie | GoodWatch`,
		},
		{
			description: `Learn all about the movie "${data.details.title} (${data.details.release_year})". Scores, where to watch it and much more.`,
		},
	]
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
		userSettings?.country_default || url.searchParams.get("country") || ""
	const language = url.searchParams.get("language") || "en"

	const details = await getDetailsForMovie({
		movieId,
		country,
		language,
	})

	return json<LoaderData>({
		details,
		params: {
			country,
		},
	})
}

export default function DetailsMovie() {
	const { details, params } = useLoaderData<LoaderData>()
	const { country } = params
	const { locale } = useLocale()

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
