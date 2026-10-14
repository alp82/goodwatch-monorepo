import type { GetMediaPreferencesResponse } from "./media-language"

/** Only used for a differing old localStorage country, before the cookie-based picker has migrated it. */
export async function mayAdoptLegacyCountry(
	stored: string,
	rendered: string,
	signal: AbortSignal,
): Promise<boolean> {
	if (stored === rendered || !/^[A-Z]{2}$/.test(stored)) return false
	const response = await fetch("/api/media-preferences", {
		cache: "no-store",
		signal,
	})
	if (!response.ok) return false
	const { effectiveContext } =
		(await response.json()) as GetMediaPreferencesResponse
	return ["browser", "default", "identity-header"].includes(
		effectiveContext.countryProvenance,
	)
}
