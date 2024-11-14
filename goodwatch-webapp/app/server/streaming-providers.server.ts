import type {
	StreamingProvider,
	StreamingProviderResults,
} from "~/routes/api.streaming-providers";
import { cached } from "~/utils/cache";
import { executeQuery } from "~/utils/postgres";
import { ignoredProviders } from "~/utils/streaming-links";

export type StreamingProviderParams = {};

export const getStreamingProviders = async (
	params: StreamingProviderParams,
) => {
	return await cached<StreamingProviderParams, StreamingProviderResults>({
		name: "streaming-providers",
		target: _getStreamingProviders,
		params,
		ttlMinutes: 60 * 24,
	});
};

export async function _getStreamingProviders(
	_: StreamingProviderParams,
): Promise<StreamingProviderResults> {
	const query = `
      SELECT
        id, name, logo_path
      FROM
        streaming_provider_ranking
      WHERE
      	id NOT IN (${ignoredProviders.join(",")})
      ORDER BY
        link_count DESC;
  `;
	const result = await executeQuery<StreamingProvider>(query);
	return result.rows;
}
