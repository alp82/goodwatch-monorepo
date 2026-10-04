import { requestLocale } from "./cache-identity.server"

const asCountryCode = (value: string | null | undefined) => {
	const code = value?.trim().toUpperCase() ?? ""
	return /^[A-Z]{2}$/.test(code) ? code : null
}

export interface ResolvedCountry {
	country: string
	// True when the visitor did not choose the country (no ?country= and no
	// saved setting), so the client may swap in a country picked earlier.
	countryIsFallback: boolean
}

// The country for streaming availability on title pages: the ?country=
// param, then the user's saved setting, then the region of the most preferred
// Accept-Language entry that names one (de-DE gives DE), then the US.
export const resolveCountry = ({
	request,
	countryDefault,
}: {
	request: Request
	countryDefault?: string | null
}): ResolvedCountry => {
	const explicit =
		asCountryCode(new URL(request.url).searchParams.get("country")) ||
		asCountryCode(countryDefault)
	if (explicit) return { country: explicit, countryIsFallback: false }

	return { country: requestLocale(request).country, countryIsFallback: true }
}
