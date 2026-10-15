import { presentCatalogLoader } from "~/server/media-payload.server"
import useLocale from "~/utils/locale"
import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	type OnboardingMovie,
	type OnboardingShow,
	getOnboardingMedia,
} from "~/server/onboarding-media.server"
import { getUserIdFromRequest } from "~/utils/auth"

export type GetOnboardingMediaResult = {
	movies: OnboardingMovie[]
	shows: OnboardingShow[]
}

const canonicalLoader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const userId = await getUserIdFromRequest({ request })
	if (!userId) return null

	const url = new URL(request.url)
	const searchTerm = url.searchParams.get("searchTerm") || ""

	const params = {
		userId,
		searchTerm,
	}
	const { movies, shows } = await getOnboardingMedia(params)

	return json<GetOnboardingMediaResult>({
		movies,
		shows,
	})
}

// Query hook

export const queryKeyOnboardingMedia = ["onboarding-media"]

export const useOnboardingMedia = ({
	searchTerm = "",
}: { searchTerm: string }) => {
	const { locale } = useLocale()
	const url = new URL("/api/onboarding/media", "https://goodwatch.app")
	url.searchParams.append("searchTerm", searchTerm)
	url.searchParams.set("displayLanguage", locale.language)

	return useQuery<GetOnboardingMediaResult>({
		queryKey: queryKeyOnboardingMedia.concat([searchTerm, locale.language]),
		queryFn: async () => await (await fetch(url.pathname + url.search)).json(),
	})
}

export const loader = presentCatalogLoader(canonicalLoader, {})
