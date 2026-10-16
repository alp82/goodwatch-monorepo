import { query } from "../../utils/crate"
import { getUserSettings, setUserSettings } from "../user-settings.server"
import type { WriteArgs } from "./write-tools.server.ts"

export async function prepareServices(
	args: WriteArgs,
): Promise<
	{ country: string; ids: number[] } | { result: Record<string, unknown> }
> {
	if (!args.country || !args.services)
		return {
			result: {
				outcome: "refused",
				message: "Choose a country and a list of services",
			},
		}
	const country = await query<{ country_code: string }>(
		"SELECT country_code FROM country WHERE country_code = ?",
		[args.country],
	)
	if (!country.length)
		return {
			result: {
				outcome: "refused",
				message: "Choose a country present in GoodWatch's country catalog",
			},
		}
	const catalog = await query<{ tmdb_id: number; name: string }>(
		"SELECT DISTINCT tmdb_id, name FROM streaming_service ORDER BY name, tmdb_id",
	)
	const ids: number[] = []
	for (const selection of args.services) {
		const matches = catalog.filter((service) =>
			typeof selection === "number"
				? service.tmdb_id === selection
				: service.name.toLocaleLowerCase() === selection.toLocaleLowerCase(),
		)
		const found = [...new Set(matches.map((service) => service.tmdb_id))]
		const suggestions = catalog.filter(
			(service) =>
				typeof selection === "string" &&
				service.name
					.toLocaleLowerCase()
					.includes(selection.toLocaleLowerCase()),
		)
		if (found.length !== 1)
			return {
				result: {
					outcome: "unresolved",
					status: found.length ? "ambiguous_service" : "service_not_found",
					message: "Choose a numeric service ID from the known services below",
					choices: (matches.length
						? matches
						: suggestions.length
							? suggestions
							: catalog
					)
						.slice(0, 20)
						.map((service) => ({ id: service.tmdb_id, name: service.name })),
				},
			}
		ids.push(found[0])
	}
	return { country: args.country, ids: [...new Set(ids)] }
}

export async function savedServices(userId: string) {
	const settings = await getUserSettings({ userId })
	return {
		country: settings.country_default ?? null,
		service_ids: (settings.streaming_providers_default ?? "")
			.split(",")
			.map(Number)
			.filter((id) => Number.isSafeInteger(id) && id > 0),
	}
}
export async function writeServices(
	userId: string,
	country: string,
	services: number[],
) {
	const written = await setUserSettings({
		user_id: userId,
		settings: {
			country_default: country,
			streaming_providers_default: services.join(","),
		},
	})
	if (!written) throw new Error("Settings write failed")
}
