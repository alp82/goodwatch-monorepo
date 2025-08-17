import type {
	StreamingProvider,
	StreamingProviderResults,
} from "~/routes/api.streaming-providers";
import { cached } from "~/utils/cache";
import { query } from "~/utils/crate";
import { ignoredProviders } from "~/utils/streaming-links";

export type StreamingProviderParams = {};

export const getStreamingProviders = async (
	params: StreamingProviderParams,
) => {
	return await cached<StreamingProviderParams, StreamingProviderResults & {[key: string]: any}>({
		name: "streaming-providers",
		target: _getStreamingProviders,
		params,
		ttlMinutes: 60 * 24,
	});
};

export async function _getStreamingProviders(
	_: StreamingProviderParams,
): Promise<StreamingProviderResults> {
	const sql = `
      SELECT
        id, name, logo_path
      FROM
        streaming_provider_ranking
      WHERE
      	id NOT IN (${ignoredProviders.join(",")})
      ORDER BY
        link_count DESC
  `;
	const result = await query<StreamingProvider>(sql);
	return result;
}
