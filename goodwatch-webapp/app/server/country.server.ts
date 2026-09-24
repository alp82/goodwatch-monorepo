import acceptLanguage from "accept-language-parser"

// Google crawls from the US, so that is the last resort for visitors who
// tell us nothing about where they are.
const FALLBACK_COUNTRY = "US"

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

	const languages = acceptLanguage.parse(
		request.headers.get("Accept-Language") || "",
	)
	const fromLanguage = languages
		.map((language) => asCountryCode(language.region))
		.find((code) => code !== null)

	return { country: fromLanguage || FALLBACK_COUNTRY, countryIsFallback: true }
}
