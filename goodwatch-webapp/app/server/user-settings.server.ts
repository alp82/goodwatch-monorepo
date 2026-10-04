import {
	getQueryKeyUserSettings,
	type GetUserSettingsResult,
	type UserSettingsMap,
	UserSettingsSchema,
} from "~/routes/api.user-settings.get";
import type { SetUserSettingsOptions } from "~/routes/api.user-settings.set";
import { type PrefetchParams, prefetchQuery } from "~/server/utils/prefetch";
import { cached, declareResettableCache, resetCache } from "~/utils/cache";
import { execute, query, upsert } from "~/utils/crate";

const SETTINGS_CACHE = {
	name: "user-settings",
	// Writes refresh Crate and reset; five minutes bounds changes a reset cannot reach.
	ttlMinutes: 5,
	staleMinutes: 0,
} as const;
declareResettableCache(SETTINGS_CACHE);

interface UserSettingRow {
	key: keyof UserSettingsMap;
	value: string;
}

type GetUserSettingsParams = {
	userId?: string;
};

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
		return {};
	}

	const sql = `
		SELECT 
			key, 
			value
		FROM user_setting
		WHERE user_id = ?
  	`;

	const params = [userId];
	const result = await query<UserSettingRow>(sql, params);

	const settings: GetUserSettingsResult = {};
	for (const row of result) {
		const convertedSettingValue = _convertSettingValue(row.key, row.value);
		if (convertedSettingValue !== null) {
			(settings as any)[row.key] = convertedSettingValue;
		}
	}
	return settings;
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
		return null;
	}

	// Validate each setting against allowed settings
	for (const [key, value] of Object.entries(settings)) {
		if (!isValidSetting(key as keyof UserSettingsMap, value as any)) {
			console.error(`setSettings error: invalid "${key}" for value ${value}`);
			return null;
		}
	}

	// Prepare data for upsert
	const data = Object.entries(settings).map(([key, value]) => ({
		user_id,
		key,
		value: String(value),
	}));

	const result = await upsert({
		table: "user_setting",
		data,
		conflictColumns: ["user_id", "key"],
		ignoreUpdate: options.ignoreUpdate,
	});

	await resetUserSettingsCache({ user_id });
	return result;
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
	user_id?: string;
};

export const resetUserSettingsCache = async (
	params: ResetUserSettingsCacheParams,
) => {
	if (!params.user_id) {
		return 0;
	}

	const key = { name: SETTINGS_CACHE.name, params: { userId: params.user_id } };
	try {
		await execute("REFRESH TABLE user_setting");
	} catch (error) {
		console.error("Refreshing member settings before cache reset failed:", error);
		// Drop any old settings cached before Crate's periodic refresh catches up.
		setTimeout(() => {
			void resetCache(key);
		}, 2000).unref();
	}
	return await resetCache(key);
};

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
