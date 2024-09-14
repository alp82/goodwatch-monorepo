import { type LoaderFunction, json } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest, useUser } from "~/utils/auth"

// type definitions

export type UserSettingsMap = {
	country_default: string
	onboarding_status: "incomplete" | "finished"
	streaming_providers_default: string
}

type StringSetting = { type: "string" }
type EnumSetting<T extends string> = { type: "enum"; options: T[] }
type SettingType = StringSetting | EnumSetting<string>

export const UserSettingsSchema: Record<keyof UserSettingsMap, SettingType> = {
	country_default: { type: "string" },
	onboarding_status: { type: "enum", options: ["incomplete", "finished"] },
	streaming_providers_default: { type: "string" },
} as const

export type UserSettingsSchema = {
	[K in keyof typeof UserSettingsSchema]: (typeof UserSettingsSchema)[K]
}

export type GetUserSettingsResult = Partial<UserSettingsMap>

// API endpoint

export const loader: LoaderFunction = async ({ request }) => {
	const user_id = await getUserIdFromRequest({ request })
	const userSettings = await getUserSettings({ user_id })

	return json<GetUserSettingsResult>(userSettings)
}

// Query hook

export const queryKeyUserSettings = ["user-settings"]

export const useUserSettings = () => {
	const { user, loading } = useUser()

	const url = "/api/user-settings/get"
	return useQuery<GetUserSettingsResult>({
		queryKey: queryKeyUserSettings,
		queryFn: async () => await (await fetch(url)).json(),
		enabled: !loading && Boolean(user?.id),
	})
}

export const useOnboardingRequired = () => {
	const { user, loading: userLoading } = useUser()
	const { data: userSettings, isLoading: userSettingsLoading } =
		useUserSettings()
	const loading = userLoading || userSettingsLoading

	const setUserSettings = useSetUserSettings()
	useEffect(() => {
		if (
			!loading &&
			user?.id &&
			typeof userSettings === "object" &&
			userSettings.onboarding_status === undefined
		) {
			setUserSettings.mutate({
				onboarding_status: "incomplete",
			})
		}
	}, [loading, userSettings, user, setUserSettings.mutate])

	return userSettings?.onboarding_status === "incomplete"
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
