import { getCountryName } from "~/server/resources/country-names"
import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"

interface CountryRow {
	country: string
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
		// ttlMinutes: 0,
	})
}

export async function _getCountries(): Promise<CountriesResults> {
	const query = `
      SELECT DISTINCT
        country
      FROM
        streaming_provider_rank
      ORDER BY
        country;
  `
	const result = await executeQuery<CountryRow>(query)
	return result.rows.map((row) => ({
		code: row.country,
		name: getCountryName(row.country),
	}))
}
