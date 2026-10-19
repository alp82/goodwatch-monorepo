import {
	MEDIA_LANGUAGES,
	type LanguageSetting,
} from "../../utils/media-language"
import { COUNTRY_PATH, SERVICES_PATH, TITLE_LANGUAGE_PATH } from "~/ui/settings/paths"
import { query } from "../../utils/crate"
import {
	MediaPreferencesConflict,
	readMediaPreferences,
	writeMediaPreferences,
} from "../media-preferences-store.server"
import { resetUserSettingsCache } from "../user-settings.server"
import { runAction } from "./actions.server"
import { savedServices } from "./services.server"
import type { WriteArgs } from "./write-tools.server"

export async function readSettings(userId: string, origin: string) {
	const [saved, services] = await Promise.all([
		readMediaPreferences(userId),
		savedServices(userId),
	])
	return {
		country: saved.record?.country ?? services.country,
		language: saved.record?.language ?? "browser",
		service_ids: services.service_ids,
		version: saved.record?.version ?? null,
		labels: { country: "Watching from", language: "Show titles in" },
		language_choices: ["browser", ...MEDIA_LANGUAGES],
		language_note:
			"Browser follows the language of the browser on the site; MCP supplies no browser locale.",
		page_url: new URL("/settings", origin).href,
		country_page_url: new URL(COUNTRY_PATH, origin).href,
		services_page_url: new URL(SERVICES_PATH, origin).href,
		language_page_url: new URL(TITLE_LANGUAGE_PATH, origin).href,
	}
}

export async function changeSettings(
	userId: string,
	origin: string,
	args: WriteArgs,
	hash: string,
) {
	if (args.country !== undefined) {
		const found = await query<{ country_code: string }>(
			"SELECT country_code FROM country WHERE country_code = ?",
			[args.country],
		)
		if (!found.length)
			return {
				outcome: "refused",
				message: "Choose a country present in GoodWatch's country catalog",
			}
	}
	return runAction(
		userId,
		args.action_id,
		hash,
		async () => {
			const saved = await readMediaPreferences(userId)
			const before = await readSettings(userId, origin)
			// Match the site's resolver when no country has ever been saved.
			const country =
				args.country ?? saved.record?.country ?? before.country ?? "US"
			const language = args.language ?? saved.record?.language ?? "browser"
			if (
				saved.record?.country === country &&
				saved.record.language === language
			)
				return {
					outcome: "unchanged",
					before,
					after: before,
					page_url: before.page_url,
				}
			try {
				await writeMediaPreferences(
					userId,
					{ country, language: language as LanguageSetting },
					{ expectedVersion: saved.record?.version ?? null },
				)
			} catch (error) {
				if (error instanceof MediaPreferencesConflict)
					return {
						outcome: "conflict",
						message: error.message,
						page_url: before.page_url,
					}
				throw error
			}
			await resetUserSettingsCache({ user_id: userId })
			return {
				outcome: "applied",
				before,
				after: await readSettings(userId, origin),
				page_url: before.page_url,
			}
		},
		{
			tool: "set_settings",
			requested: { country: args.country, language: args.language },
		},
	)
}
