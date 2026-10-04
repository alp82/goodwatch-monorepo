// Country flags are served from this host (public/flags, from the country-flag-icons package), so a
// page with flags needs no other origin. The files are 3:2 SVGs of 0.2 to 5 KB.

/** The URL of a country's flag. `country` is an ISO 3166-1 alpha-2 code such as "DE". */
export const countryFlagUrl = (country: string) =>
	`/flags/${country.toUpperCase()}.svg`
