import { captureProductEvent } from "~/telemetry/product-analytics.server"
import { parseLocalizationRecord } from "../utils/media-language.ts"
import {
	MEDIA_PREFERENCES_KEY,
	readMediaPreferences,
	writeMediaPreferences,
} from "./media-preferences-store.server.ts"
import {
	getQueryKeyUserSettings,
	type GetUserSettingsResult,
	type UserSettingsMap,
	UserSettingsSchema,
} from "~/routes/api.user-settings.get";
import type { SetUserSettingsOptions } from "~/routes/api.user-settings.set"
import { type PrefetchParams, prefetchQuery } from "~/server/utils/prefetch"
import { cached, declareResettableCache, resetCache } from "~/utils/cache"
import { execute, query, upsert } from "~/utils/crate"

export const USER_SETTINGS_CACHE_NAME = "user-settings-media-v1"
export const LEGACY_USER_SETTINGS_CACHE_NAME = "user-settings"
const SETTINGS_CACHE = {
	name: USER_SETTINGS_CACHE_NAME,
	// Writes refresh Crate and reset; five minutes bounds changes a reset cannot reach.
	ttlMinutes: 5,
	staleMinutes: 0,
} as const;
declareResettableCache(SETTINGS_CACHE)
// New writes still invalidate older roles' ordinary settings; old roles never fill the new projection.
declareResettableCache({
	...SETTINGS_CACHE,
	name: LEGACY_USER_SETTINGS_CACHE_NAME,
})

interface UserSettingRow {
	key: string
	value: string
}

type GetUserSettingsParams = {
	userId?: string
}

// server call

export const getUserSettings = async (params: GetUserSettingsParams) => {
	if (!params.userId) return {};
	return await cached<GetUserSettingsParams, GetUserSettingsResult>({
		...SETTINGS_CACHE,
		target: _getUserSettings,
		params: { userId: params.userId },
	});
};

async function _getUserSettings({
	userId,
}: GetUserSettingsParams): Promise<GetUserSettingsResult> {
	if (!userId) {
		return {}
	}

	const sql = `
		SELECT 
			key, 
			value
		FROM user_setting
		WHERE user_id = ?
  	`;

	const params = [userId]
	const result = await query<UserSettingRow>(sql, params)

	const settings: GetUserSettingsResult = {}
	for (const row of result) {
		const convertedSettingValue = _convertSettingValue(
			row.key as keyof UserSettingsMap,
			row.value,
		)
		if (convertedSettingValue !== null) {
			(settings as any)[row.key] = convertedSettingValue;
		}
	}
	// The atomic pair owns country; keep the historical settings API shape for all existing readers.
	const pair = parseLocalizationRecord(
		result.find((row) => row.key === MEDIA_PREFERENCES_KEY)?.value,
	)
	if (pair) settings.country_default = pair.country
	return settings
}

const _convertSettingValue = (
	key: keyof UserSettingsMap,
	value: string,
): UserSettingsMap[keyof UserSettingsMap] | null => {
	const schema = UserSettingsSchema[key];
	if (!schema) return null;

	switch (schema.type) {
		case "string":
			return value;
		case "enum":
			return schema.options.includes(value) ? value : null;
		default:
			return null;
	}
};

// setter call

interface SetUserSettingsParams {
	user_id: string | undefined;
	settings: Partial<UserSettingsMap>;
	options?: SetUserSettingsOptions;
}

export async function setUserSettings({
	user_id,
	settings,
	options = {},
}: SetUserSettingsParams) {
	if (!user_id || !settings) {
		return null
	}

	// Validate each setting against allowed settings
	for (const [key, value] of Object.entries(settings)) {
		if (!isValidSetting(key as keyof UserSettingsMap, value as any)) {
			console.error(`setSettings error: invalid "${key}" for value ${value}`)
			return null
		}
	}

	// Old country-only setters preserve the language once an atomic pair exists.
	let remaining = settings
	if (settings.country_default !== undefined) {
		const { record } = await readMediaPreferences(user_id)
		if (record) {
			if (!options.ignoreUpdate) {
				const country = settings.country_default.trim().toUpperCase()
				if (!/^[A-Z]{2}$/.test(country)) return null
				await writeMediaPreferences(
					user_id,
					{ country, language: record.language },
					{ expectedVersion: record.version },
				)
			}
			remaining = { ...settings }
			delete remaining.country_default
		}
	}

	// Other settings retain their existing write semantics.
	const data = Object.entries(remaining).map(([key, value]) => ({
		user_id,
		key,
		value: String(value),
	}));

	const result = data.length ? await upsert({
		table: "user_setting",
		data,
		conflictColumns: ["user_id", "key"],
		ignoreUpdate: options.ignoreUpdate,
	}) : { rowcount: 1 };

	if (result.rowcount)
		captureProductEvent(user_id, "settings changed", {
			setting_keys: Object.keys(settings),
		})
	await resetUserSettingsCache({ user_id })
	return result
}

// validation

const isValidSetting = <K extends keyof UserSettingsMap>(
	key: K,
	value: UserSettingsMap[K],
): boolean => {
	const schema = UserSettingsSchema[key];
	if (!schema) return false;

	// Validate based on the type in the schema
	switch (schema.type) {
		case "string":
			return typeof value === "string";
		case "enum":
			return schema.options.includes(value);
		default:
			return false;
	}
};

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

	const keys = [USER_SETTINGS_CACHE_NAME, LEGACY_USER_SETTINGS_CACHE_NAME].map(
		(name) => ({ name, params: { userId: params.user_id } }),
	)
	try {
		await execute("REFRESH TABLE user_setting")
	} catch (error) {
		console.error(
			"Refreshing member settings before cache reset failed:",
			error,
		)
		// Drop any old settings cached before Crate's periodic refresh catches up.
		setTimeout(() => {
			void Promise.all(keys.map((key) => resetCache(key)))
		}, 2000).unref()
	}
	const [current] = await Promise.all(keys.map((key) => resetCache(key)))
	return current
}

// loader prefetch

export const prefetchUserSettings = async ({
	queryClient,
	request,
}: PrefetchParams) => {
	await prefetchQuery({
		queryClient,
		queryKey: ({ userId }) => getQueryKeyUserSettings(userId),
		getter: async ({ userId }) => await getUserSettings({ userId: userId }),
		request,
	});
};
