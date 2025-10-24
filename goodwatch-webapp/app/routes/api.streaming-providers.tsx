import { type LoaderFunction, LoaderFunctionArgs } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { getStreamingProviders } from "~/server/streaming-providers.server"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest } from "~/utils/auth"

export interface StreamingProvider {
	id: number
	name: string
	logo_path: string
}

export type StreamingProviderResults = StreamingProvider[]

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const userId = await getUserIdFromRequest({ request })
	const userSettings = await getUserSettings({ userId })
	const country = userSettings?.country_default || "US"
	const params = { country }
	const streamingProviders = await getStreamingProviders(params)
	return streamingProviders
}

// Query hook

export const queryKeyStreamingProviders = ["streaming-providers"]

export const useStreamingProviders = () => {
	const url = "/api/streaming-providers"
	return useQuery<StreamingProviderResults>({
		queryKey: queryKeyStreamingProviders,
		queryFn: async () => await (await fetch(url)).json(),
	})
}
