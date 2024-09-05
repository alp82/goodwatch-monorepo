import {
	type LoaderFunction,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	type OnboardingMovie,
	type OnboardingTV,
	getOnboardingMedia,
} from "~/server/onboarding-media.server"
import { getUserIdFromRequest } from "~/utils/auth"

export type GetOnboardingMediaResult = {
	movies: OnboardingMovie[]
	tv: OnboardingTV[]
}

export const loader: LoaderFunction = async ({
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
	const { movies, tv } = await getOnboardingMedia(params)

	return json<GetOnboardingMediaResult>({
		movies,
		tv,
	})
}

// Query hook

export const queryKeyOnboardingMedia = ["onboarding-media"]

export const useOnboardingMedia = ({
	searchTerm = "",
}: { searchTerm: string }) => {
	const url = new URL("/api/onboarding/media", "https://goodwatch.app")
	url.searchParams.append("searchTerm", searchTerm)

	return useQuery<GetOnboardingMediaResult>({
		queryKey: queryKeyOnboardingMedia.concat([searchTerm]),
		queryFn: async () => await (await fetch(url.pathname + url.search)).json(),
	})
}
