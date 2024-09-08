import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import React, { useEffect } from "react"
import { useUpdateUrlParams } from "~/hooks/updateUrlParams"
import { type TVDetails, getDetailsForTV } from "~/server/details.server"
import { type GetUserDataResult, getUserData } from "~/server/userData.server"
import Details from "~/ui/Details"
import { getUserFromRequest } from "~/utils/auth"
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
			title: `${data.details.title} (${data.details.release_year}) | TV Show | GoodWatch`,
		},
		{
			description: `Learn all about the TV show "${data.details.title} (${data.details.release_year})". Scores, where to watch it and much more.`,
		},
	]
}

type LoaderData = {
	details: Awaited<TVDetails>
	params: {
		tab: string
		country: string
		language: string
	}
	userData?: GetUserDataResult
}

export const loader: LoaderFunction = async ({
	params,
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const tab = url.searchParams.get("tab") || "about"

	const tvId = (params.tvKey || "").split("-")[0]
	const country = url.searchParams.get("country") || ""
	const language = url.searchParams.get("language") || "en"
	const details = await getDetailsForTV({
		tvId,
		country,
		language,
	})

	const user = await getUserFromRequest({ request })
	const userData = await getUserData({ user_id: user?.id })

	return json<LoaderData>({
		details,
		params: {
			tab,
			country,
			language,
		},
		userData,
	})
}

export default function DetailsTV() {
	const { details, params } = useLoaderData<LoaderData>()
	const { tab, country, language } = params
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

	return (
		<Details
			details={details}
			tab={tab}
			country={country}
			language={language}
		/>
	)
}
