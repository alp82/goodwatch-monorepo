import { parseLocalizationPair } from "~/utils/media-language"
import {
	saveMediaPreferences,
	currentSavedMediaPreferences,
} from "~/server/media-context.server"
import { MediaPreferencesConflict } from "~/server/media-preferences-store.server"
import {
	json,
	type ActionFunction,
	type ActionFunctionArgs,
} from "@remix-run/node"
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
	if (request.method !== "POST")
		return json(
			{ error: "Use POST" },
			{ status: 405, headers: { "Cache-Control": "no-store" } },
		)
	const origin = request.headers.get("Origin")
	// Coolify terminates TLS, so use the public origin rather than the internal HTTP URL.
	const expectedOrigin =
		process.env.APP_ORIGIN ||
		(process.env.NODE_ENV === "production"
			? "https://goodwatch.app"
			: new URL(request.url).origin)
	if (origin && origin !== expectedOrigin)
		return json(
			{ error: "Origin mismatch" },
			{ status: 403, headers: { "Cache-Control": "no-store" } },
		)
	let params
	try {
		params = await request.json()
	} catch {
		return json({ error: "Invalid JSON" }, { status: 400 })
	}
	if (!params || typeof params !== "object" || Array.isArray(params))
		return json({ error: "Invalid request" }, { status: 400 })
	const user_id = await getUserIdFromRequest({ request })

	if ("pair" in params) {
		const pair = parseLocalizationPair(params.pair)
		if (
			!pair ||
			typeof params.clientId !== "string" ||
			!/^[\w-]{8,80}$/.test(params.clientId) ||
			!Number.isSafeInteger(params.sequence) ||
			params.sequence < 0 ||
			(params.expectedVersion !== undefined &&
				params.expectedVersion !== null &&
				(typeof params.expectedVersion !== "string" ||
					!/^[\w-]{1,80}$/.test(params.expectedVersion)))
		) {
			return json(
				{ error: "Invalid pair, clientId, sequence or expectedVersion" },
				{ status: 400, headers: { "Cache-Control": "no-store" } },
			)
		}
		try {
			const saved = await saveMediaPreferences(request, user_id, {
				pair,
				clientId: params.clientId,
				sequence: params.sequence,
				expectedVersion: params.expectedVersion,
			})
			return json(saved.response, {
				headers: { "Set-Cookie": saved.setCookie, "Cache-Control": "no-store" },
			})
		} catch (error) {
			const conflict = error instanceof MediaPreferencesConflict
			let current = null
			if (conflict) {
				const saved = await currentSavedMediaPreferences(
					request,
					user_id,
					params.clientId,
				)
				if (saved)
					current = {
						pair: { country: saved.country, language: saved.language },
						version: saved.version,
						sequence: saved.writer?.sequence ?? 0,
					}
			}
			return json(
				{
					error: conflict
						? error.message
						: "Could not confirm save. Keep the preview and retry.",
					sequence: params.sequence,
					...(conflict ? { current } : {}),
				},
				{
					status: conflict ? 409 : 503,
					headers: { "Cache-Control": "no-store" },
				},
			)
		}
	}

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
