import { type LoaderFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	getShowcaseExamples,
	type ShowcaseExample,
	type ShowcaseExamplesResult,
} from "~/server/showcase-examples.server"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest } from "~/utils/auth"

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const userId = await getUserIdFromRequest({ request })
	const userSettings = await getUserSettings({ userId })
	const country = userSettings?.country_default || "US"

	const showcaseExamples = await getShowcaseExamples({ country })
	return showcaseExamples
}

export const queryKeyShowcaseExamples = ["showcase-examples"]

export const useShowcaseExamples = () => {
	const url = "/api/showcase-examples"
	return useQuery<ShowcaseExamplesResult>({
		queryKey: queryKeyShowcaseExamples,
		queryFn: async () => await (await fetch(url)).json(),
	})
}

export type { ShowcaseExample, ShowcaseExamplesResult }
