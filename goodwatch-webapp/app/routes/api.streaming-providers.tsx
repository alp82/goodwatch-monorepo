import { type LoaderFunction, LoaderFunctionArgs } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import {
	getStreamingProviders,
	slimStreamingProviders,
} from "~/server/streaming-providers.server"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest } from "~/utils/auth"

export interface StreamingProvider {
	id: number
	name: string
	logo_path: string
	order_by_country?: Record<string, number>
	order_default?: number
}

export type StreamingProviderResults = StreamingProvider[]

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const userId = await getUserIdFromRequest({ request })
	const userSettings = await getUserSettings({ userId })
	const url = new URL(request.url)
	const requestedCountry = url.searchParams.get("country") || ""
	const listCountry = /^[A-Z]{2}$/.test(requestedCountry)
		? requestedCountry
		: undefined
	const include = (url.searchParams.get("include") || "")
		.split(",")
		.map(Number)
		.filter((id) => Number.isInteger(id) && id > 0)
		.slice(0, 100)
	const country = listCountry || userSettings?.country_default || "US"
	const streamingProviders = await getStreamingProviders({ country })
	return slimStreamingProviders(streamingProviders, listCountry, include)
}

// Query hook

export const queryKeyStreamingProviders = ["streaming-providers"]

export interface StreamingProviderListParams {
	// Only providers available in this country, plus `include`
	country?: string
	// Selected provider ids that must stay in the list
	include?: string[]
	enabled?: boolean
}

export const getQueryKeyStreamingProviders = ({
	country,
	include = [],
}: StreamingProviderListParams = {}) =>
	country
		? [...queryKeyStreamingProviders, country, [...include].sort().join(",")]
		: queryKeyStreamingProviders

export const useStreamingProviders = (
	params: StreamingProviderListParams = {},
) => {
	const search = params.country
		? `?${new URLSearchParams({
				country: params.country,
				include: [...(params.include ?? [])].sort().join(","),
			})}`
		: ""
	return useQuery<StreamingProviderResults>({
		queryKey: getQueryKeyStreamingProviders(params),
		queryFn: async () =>
			await (await fetch(`/api/streaming-providers${search}`)).json(),
		placeholderData: (previousData) => previousData,
		enabled: params.enabled ?? true,
	})
}
