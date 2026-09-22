import type {
	StreamingProvider,
	StreamingProviderResults,
} from "~/routes/api.streaming-providers"
import { cached } from "~/utils/cache"
import { query } from "~/utils/crate"
import { ignoredProviders } from "~/utils/streaming-links"

export type StreamingProviderParams = {
	country: string
}

export const getStreamingProviders = async (
	params: StreamingProviderParams,
) => {
	const providers = await cached<
		StreamingProviderParams,
		StreamingProviderResults & { [key: string]: any }
	>({
		name: "streaming-providers",
		target: _getStreamingProviders,
		params,
		ttlMinutes: 60 * 24,
		//ttlMinutes: 0,
	})
	// Provider snapshots can differ in logo/name while sharing the same TMDB ID.
	// Normalize after reading the cache so existing cached snapshots are safe too.
	const seen = new Set<number>()
	return providers.filter((provider) => {
		if (seen.has(provider.id)) return false
		seen.add(provider.id)
		return true
	})
}

export async function _getStreamingProviders(
	params: StreamingProviderParams,
): Promise<StreamingProviderResults> {
	const orderByFields = [
		`order_by_country['${params.country}']`,
		"order_default",
	]

	for (const orderByField of orderByFields) {
		try {
			const sql = `
				SELECT DISTINCT
					tmdb_id as id, name, logo_path, order_by_country
				FROM
					streaming_service
				WHERE
					tmdb_id NOT IN (${ignoredProviders.join(",")})
				ORDER BY
					${orderByField} ASC
			`
			const result = await query<StreamingProvider>(sql)
			return result
		} catch (error) {
			if (
				error instanceof Error &&
				error.message.includes("ColumnUnknownException")
			) {
				continue
			}
			throw error
		}
	}

	throw new Error(
		`Failed to fetch streaming providers for country: ${params.country}`,
	)
}

// The browser needs id, name and logo only; the per-country order map is about 40%
// of the payload. With a country, keep its providers plus the selected ones.
export const slimStreamingProviders = (
	providers: StreamingProviderResults,
	country?: string,
	include: number[] = [],
): StreamingProviderResults =>
	providers
		.filter(
			(provider) =>
				!country ||
				provider.order_by_country?.[country] != null ||
				include.includes(provider.id),
		)
		.map(({ id, name, logo_path, order_default }) => ({
			id,
			name,
			logo_path,
			order_default,
		}))
