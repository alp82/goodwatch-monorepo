import { type LoaderFunction, json } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { getStreamingProviders } from "~/server/streaming-providers.server"

export interface StreamingProvider {
	id: number
	name: string
	logo_path: string
}

export type StreamingProviderResults = StreamingProvider[]

export const loader: LoaderFunction = async () => {
	const params = {}
	const streamingProviders = await getStreamingProviders(params)
	return json<StreamingProviderResults>(streamingProviders)
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
