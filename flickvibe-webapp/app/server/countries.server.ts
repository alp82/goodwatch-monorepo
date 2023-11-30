import { cached } from '~/utils/api'
import { executeQuery } from '~/utils/postgres'
import { getCountryName } from '~/server/resources/country-names'

export interface Country {
  code: string
  name: string
}

export type CountriesResults = Country[]

export interface CountriesParams {
  type: 'movie' | 'tv'
}

export const getCountries = async (params: CountriesParams) => {
  return await cached<CountriesParams, CountriesResults>({
    name: 'countries',
    target: _getCountries,
    params,
    ttlMinutes: 60 * 24,
  })
}

export async function _getCountries({ type }: CountriesParams): Promise<CountriesResults> {
  const mediaType = type === 'tv' ? 'tv' : 'movie'
  const query = `
      SELECT DISTINCT
        country_code
      FROM
        streaming_provider_links
      --WHERE
      --  media_type = '${mediaType}'
      --  AND provider_id IN (8,9,337)
      ORDER BY
        country_code;
  `
  const result = await executeQuery(query)
  return result.rows.map((row) => ({
    code: row.country_code,
    name: getCountryName(row.country_code)
  }))
}
