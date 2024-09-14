import {
	type GetUserSettingsResult,
	type UserSettingsMap,
	UserSettingsSchema,
	queryKeyUserSettings,
} from "~/routes/api.user-settings.get"
import { type PrefetchParams, prefetchQuery } from "~/server/utils/prefetch"
import { cached, resetCache } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"

interface UserSettingRow {
	key: keyof UserSettingsMap
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
		ttlMinutes: 60,
		// ttlMinutes: 0,
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
		const convertedSettingValue = _convertSettingValue(row.key, row.value)
		if (convertedSettingValue !== null) {
			settings[row.key] = convertedSettingValue
		}
	}
	return settings
}

const _convertSettingValue = (
	key: keyof UserSettingsMap,
	value: string,
): UserSettingsMap[keyof UserSettingsMap] | null => {
	const schema = UserSettingsSchema[key]
	if (!schema) return null

	switch (schema.type) {
		case "string":
			return value
		case "enum":
			return schema.options.includes(value) ? value : null
		default:
			return null
	}
}

// setter call

interface SetUserSettingsParams {
	user_id: string | undefined
	settings: Partial<UserSettingsMap>
}

export async function setUserSettings({
	user_id,
	settings,
}: SetUserSettingsParams) {
	if (!user_id || !settings) {
		return null
	}

	// Validate each setting against allowed settings
	for (const [key, value] of Object.entries(settings)) {
		if (!isValidSetting(key as keyof UserSettingsMap, value)) {
			return null
		}
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

	const result = await executeQuery(query, params)
	await resetUserSettingsCache({ user_id })
	return result
}

// validation

const isValidSetting = <K extends keyof UserSettingsMap>(
	key: K,
	value: UserSettingsMap[K],
): boolean => {
	const schema = UserSettingsSchema[key]
	if (!schema) return false

	// Validate based on the type in the schema
	switch (schema.type) {
		case "string":
			return typeof value === "string"
		case "enum":
			return schema.options.includes(value)
		default:
			return false
	}
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
