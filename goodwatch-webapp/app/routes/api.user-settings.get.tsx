import { type LoaderFunction, json } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest } from "~/utils/auth"

// type definitions

export type SettingMap = {
	country_default: string
	onboarding_completed: boolean
	streaming_providers_default: string
}

export type GetUserSettingsResult = Partial<SettingMap>

// API endpoint

export const loader: LoaderFunction = async ({ request }) => {
	const userId = await getUserIdFromRequest({ request })
	const userSettings = await getUserSettings({ user_id: userId })

	return json<GetUserSettingsResult>(userSettings)
}

// Query hook

export const queryKeyUserSettings = ["user-settings"]

export const useUserSettings = () => {
	const url = "/api/user-settings/get"
	return useQuery<GetUserSettingsResult>({
		queryKey: queryKeyUserSettings,
		queryFn: async () => await (await fetch(url)).json(),
	})
}

export const useUserStreamingProviders = () => {
	const userSettings = useUserSettings()
	const streamingProviders = useStreamingProviders()

	const streamingProviderIds = (
		userSettings.data?.streaming_providers_default || ""
	).split(",")
	return (streamingProviders?.data || []).filter((provider) => {
		return streamingProviderIds.includes(provider.id.toString())
	})
}
