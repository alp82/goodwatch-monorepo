import type {
	StreamingProvider,
	StreamingProviderResults,
} from "~/routes/api.streaming-providers";
import { cached } from "~/utils/cache";
import { query } from "~/utils/crate";
import { ignoredProviders } from "~/utils/streaming-links";

export type StreamingProviderParams = {
	country: string
};

export const getStreamingProviders = async (
	params: StreamingProviderParams,
) => {
	return await cached<StreamingProviderParams, StreamingProviderResults & {[key: string]: any}>({
		name: "streaming-providers",
		target: _getStreamingProviders,
		params,
		ttlMinutes: 60 * 24,
		//ttlMinutes: 0,
	})
}

export async function _getStreamingProviders(
	params: StreamingProviderParams,
): Promise<StreamingProviderResults> {
	const orderByFields = [
		`order_by_country['${params.country}']`,
		'order_default'
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
			if (error instanceof Error && error.message.includes('ColumnUnknownException')) {
				continue
			}
			throw error
		}
	}

	throw new Error(`Failed to fetch streaming providers for country: ${params.country}`)
}
