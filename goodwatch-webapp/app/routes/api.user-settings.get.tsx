import { type LoaderFunction, json } from "@remix-run/node"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useStreamingProviders } from "~/routes/api.streaming-providers"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
import { getUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest, useUser } from "~/utils/auth"

// type definitions

export type UserSettingsMap = {
	cookie_consent: "yes" | "no"
	country_default: string
	onboarding_status: "incomplete" | "finished"
	streaming_providers_default: string
}

type StringSetting = { type: "string" }
type EnumSetting<T extends string> = { type: "enum"; options: T[] }
type SettingType = StringSetting | EnumSetting<string>

export const UserSettingsSchema: Record<keyof UserSettingsMap, SettingType> = {
	cookie_consent: { type: "enum", options: ["yes", "no"] },
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
	const userId = await getUserIdFromRequest({ request })
	const userSettings = await getUserSettings({ userId })

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

type CookieConsent = "undecided" | "yes" | "no"

export const useCookieConsent = () => {
	const { data: userSettings } = useUserSettings()

	const [consentGiven, setConsentGiven] = useState<CookieConsent | "">("")
	useEffect(() => {
		// We want this to only run once the client loads
		// or else it causes a hydration error
		const localConsent = localStorage.getItem("cookie_consent") || ""
		if (userSettings?.cookie_consent) {
			setConsentGiven(userSettings.cookie_consent)
		} else if (["yes", "no"].includes(localConsent)) {
			setConsentGiven(localConsent as "yes" | "no")
		} else {
			setConsentGiven("undecided")
		}
	}, [userSettings?.cookie_consent])

	return { consentGiven, setConsentGiven }
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
				settings: {
					onboarding_status: "incomplete",
				},
				options: {
					ignoreUpdate: true,
				},
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

export const useUserCountry = () => {
	const userSettings = useUserSettings()
	return userSettings.data?.country_default
}
