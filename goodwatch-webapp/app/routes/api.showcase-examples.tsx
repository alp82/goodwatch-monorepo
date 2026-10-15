import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { type LoaderFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	getShowcaseExamples,
	type ShowcaseExample,
	type ShowcaseExamplesResult,
} from "~/server/showcase-examples.server"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest } from "~/utils/auth"

const canonicalLoader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const userId = await getUserIdFromRequest({ request })
	const userSettings = await getUserSettings({ userId })
	const country = userSettings?.country_default || "US"

	const showcaseExamples = await getShowcaseExamples({ country })
	return showcaseExamples
}

export const queryKeyShowcaseExamples = ["showcase-examples"]

export const useShowcaseExamples = (options?: { initialData?: any[] }) => {
	const { locale } = useLocale()
	const url = mediaLanguageUrl("/api/showcase-examples", locale.language)
	return useQuery<ShowcaseExamplesResult>({
		queryKey: [...queryKeyShowcaseExamples, locale.language],
		queryFn: async () => await (await fetch(url)).json(),
		initialData: options?.initialData,
	})
}

export type { ShowcaseExample, ShowcaseExamplesResult }

export const loader = presentCatalogLoader(canonicalLoader, {})
