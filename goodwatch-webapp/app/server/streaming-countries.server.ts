import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"
import { servicesByCountry } from "~/utils/streaming-links"
import { canonicalTitleId } from "~/utils/title-identity"

export interface StreamingCountriesParams {
	mediaType: "movie" | "show"
	id: number
	/** Orders each country's services as this country orders them, like the services of the title page. */
	country: string
}

/** Every country's services of a title for the country list of the where-to-watch block. */
export type StreamingCountriesResult = {
	/** Per country, the ids of the services for the tabs stream (with the free offers), rent and buy. */
	countries: Record<string, [number[], number[], number[]]>
	services: { tmdb_id: number; name: string; logo: string }[]
}

export const getStreamingCountries = async (params: StreamingCountriesParams) =>
	cached<StreamingCountriesParams, StreamingCountriesResult>({
		name: "streaming-countries-v1",
		target: _getStreamingCountries,
		params: { ...params, id: canonicalTitleId(params.mediaType, params.id) },
		// As old as the title page's own offers may be (see title-details-cache).
		ttlMinutes: 12 * 60,
		staleMinutes: 12 * 60,
	})

async function _getStreamingCountries({
	mediaType,
	id,
	country,
}: StreamingCountriesParams): Promise<StreamingCountriesResult> {
	const offers = await query<{
		country_code: string
		streaming_type: string
		streaming_service_id: number
	}>(
		`SELECT DISTINCT country_code, streaming_type, streaming_service_id
		   FROM streaming_availability
		  WHERE media_tmdb_id = ? AND media_type = ?`,
		[id, mediaType],
	)
	const ids = [...new Set(offers.map((o) => o.streaming_service_id))]
	// The whole order object is read: Crate refuses a subscript of it for a key no row has (see streaming-providers).
	const rows = ids.length
		? await query<{
				tmdb_id: number
				name: string
				logo: string
				order_by_country: Record<string, number> | null
			}>(
				`SELECT tmdb_id, name, logo_path AS logo, order_by_country
				   FROM streaming_service
				  WHERE tmdb_id IN (${ids.map(() => "?").join(",")})`,
				ids,
			)
		: []
	const catalog = new Map(
		rows.map((s) => [
			s.tmdb_id,
			{ ...s, order_default: s.order_by_country?.[country] ?? null },
		]),
	)
	const countries: StreamingCountriesResult["countries"] = Object.fromEntries(
		servicesByCountry(offers, catalog),
	)
	const used = new Set(Object.values(countries).flat(2))
	const services = [...used].flatMap((serviceId) => {
		const s = catalog.get(serviceId)
		return s ? [{ tmdb_id: s.tmdb_id, name: s.name, logo: s.logo }] : []
	})
	return { countries, services }
}
