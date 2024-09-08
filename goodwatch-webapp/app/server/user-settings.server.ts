import {
	type GetUserSettingsResult,
	type SettingMap,
	queryKeyUserSettings,
} from "~/routes/api.user-settings.get"
import { type PrefetchParams, prefetchQuery } from "~/server/utils/prefetch"
import { cached, resetCache } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"

interface UserSettingRow {
	key: keyof SettingMap
	value: string
}

type GetUserSettingsParams = {
	user_id?: string
}

// server call

export const getUserSettings = async (params: GetUserSettingsParams) => {
	return await cached<GetUserSettingsParams, GetUserSettingsResult>({
		name: "user-settings",
		target: _getUserSettings,
		params,
		// ttlMinutes: 10,
		ttlMinutes: 0,
	})
}

async function _getUserSettings({
	user_id,
}: GetUserSettingsParams): Promise<GetUserSettingsResult> {
	if (!user_id) {
		return {}
	}

	const query = `
SELECT 
    key, 
    value
FROM user_settings
WHERE user_id = $1;
  `

	const params = [user_id]
	const result = await executeQuery<UserSettingRow>(query, params)

	const settings: GetUserSettingsResult = {}
	for (const row of result.rows) {
		settings[row.key] = _convertSettingValue(row.key, row.value) // No more type error
	}
	return settings
}

const _convertSettingValue = (
	key: keyof SettingMap,
	value: string,
): SettingMap[keyof SettingMap] => {
	switch (key) {
		case "country_default":
			return value
		case "onboarding_completed":
			return value === "true"
		case "streaming_providers_default":
			return value
	}
}

// setter call

interface SetUserSettingsParams {
	user_id: string | undefined
	settings: Partial<SettingMap>
}

export async function setUserSettings({
	user_id,
	settings,
}: SetUserSettingsParams) {
	if (!user_id || !settings) {
		return null
	}

	if (
		settings?.country_default &&
		typeof settings.country_default !== "string"
	) {
		return null
	}
	if (
		settings?.onboarding_completed &&
		typeof settings.onboarding_completed !== "boolean"
	) {
		return null
	}
	if (
		settings?.streaming_providers_default &&
		typeof settings.streaming_providers_default !== "string"
	) {
		return null
	}

	const query = `
			INSERT INTO user_settings (user_id, key, value, created_at, updated_at)
			VALUES 
			${Object.keys(settings)
				.map(
					(_, index) =>
						`($1, $${index * 2 + 2}, $${index * 2 + 3}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
				)
				.join(",")}
			ON CONFLICT (user_id, key)
			DO UPDATE SET
					value = EXCLUDED.value,
					updated_at = CURRENT_TIMESTAMP
			RETURNING *;
    `

	const params = [user_id, ...Object.entries(settings).flat()]

	return await executeQuery(query, params)
}

// cache reset

type ResetUserSettingsCacheParams = {
	user_id?: string
}

export const resetUserSettingsCache = async (
	params: ResetUserSettingsCacheParams,
) => {
	if (!params.user_id) {
		return 0
	}

	return await resetCache({
		name: "user-settings",
		params,
	})
}

// loader prefetch

export const prefetchUserSettings = async ({
	queryClient,
	request,
}: PrefetchParams) => {
	await prefetchQuery({
		queryClient,
		queryKey: queryKeyUserSettings,
		getter: async ({ userId }) => await getUserSettings({ user_id: userId }),
		request,
	})
}
