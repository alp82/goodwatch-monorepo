import { getCountryName } from "~/server/resources/country-names"
import { cached } from "~/utils/cache"
import { executeQuery } from "~/utils/postgres"

export interface Country {
	code: string
	name: string
}

export type CountriesResults = Country[]

export interface CountriesParams {
	type: "movie" | "tv"
}

export const getCountries = async (params: CountriesParams) => {
	return await cached<CountriesParams, CountriesResults>({
		name: "countries",
		target: _getCountries,
		params,
		ttlMinutes: 60 * 24,
		// ttlMinutes: 0,
	})
}

export async function _getCountries({
	type,
}: CountriesParams): Promise<CountriesResults> {
	const mediaType = type === "tv" ? "tv" : "movie"
	const query = `
      SELECT DISTINCT
        country
      FROM
        streaming_provider_rank
      --WHERE
      --  media_type = '${mediaType}'
      --  AND streaming_provider_id IN (8,9,337)
      ORDER BY
        country;
  `
	const result = await executeQuery(query)
	return result.rows.map((row) => ({
		code: row.country,
		name: getCountryName(row.country),
	}))
}
