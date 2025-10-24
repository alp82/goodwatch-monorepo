import { getCountryName } from "~/server/resources/country-names"
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"

interface CountryRow {
	country_code: string
}

export interface Country {
	code: string
	name: string
}

export type CountriesResults = Country[]

export type CountriesParams = {}

export const getCountries = async (params: CountriesParams) => {
	return await cached<CountriesParams, CountriesResults>({
		name: "countries",
		target: _getCountries,
		params,
		ttlMinutes: 60 * 24,
		//ttlMinutes: 0,
	})
}

export async function _getCountries(): Promise<CountriesResults> {
	const countriesQuery = `
      SELECT
        country_code
      FROM
        country
      ORDER BY
        country_code;
  `
	const result = await query<CountryRow>(countriesQuery)
	const countries = result.map((row) => ({
		code: row.country_code,
		name: getCountryName(row.country_code),
	}))

	return countries.sort((a, b) => {
		if (a.name < b.name) {
			return -1
		}
		if (a.name > b.name) {
			return 1
		}
		return 0
	})
}
