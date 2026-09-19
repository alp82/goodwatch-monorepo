import type { ActionFunction, ActionFunctionArgs } from "@remix-run/node"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
	type UserSettingsMap,
	queryKeyUserSettings,
} from "~/routes/api.user-settings.get"
import { setUserSettings } from "~/server/user-settings.server"
import { getUserIdFromRequest, useUser } from "~/utils/auth"
import { queryKeyStreamingProviders } from "./api.streaming-providers"

// type definitions

export type SetUserSettingsParams = Partial<UserSettingsMap>

export interface SetUserSettingsOptions {
	ignoreUpdate?: boolean
}

// API endpoint

export const action: ActionFunction = async ({
	request,
}: ActionFunctionArgs) => {
	const params = await request.json()
	const user_id = await getUserIdFromRequest({ request })

	return await setUserSettings({
		...params,
		user_id,
	})
}

// Query hook

export const useSetUserSettings = () => {
	const queryClient = useQueryClient()

	return useMutation({
		scope: { id: "user-settings" },
		mutationFn: async ({
			settings,
			options,
		}: {
			settings: SetUserSettingsParams
			options?: SetUserSettingsOptions
		}) => {
			const url = "/api/user-settings/set"
			const params = {
				settings,
				options,
			}

			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(params),
			})
			if (!response.ok) throw new Error("Could not save preferences")
			return response.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: queryKeyUserSettings,
			})
			queryClient.invalidateQueries({
				queryKey: queryKeyStreamingProviders,
			})
		},
	})
}
