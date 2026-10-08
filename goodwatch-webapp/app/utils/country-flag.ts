// Country flags in public/flags come from country-flag-icons. The files are 3:2 SVGs of 0.2 to 5 KB.
import { assetUrl } from "./asset-url.ts"

/** The URL of a country's flag. `country` is an ISO 3166-1 alpha-2 code such as "DE". */
export const countryFlagUrl = (country: string) =>
	assetUrl(`/flags/${country.toUpperCase()}.svg`)
