import { cached } from '~/utils/cache'
import { executeQuery } from '~/utils/postgres'

export interface StreamingProvider {
  id: number
  name: string
  logo_path: string
}

export type StreamingProviderResults = StreamingProvider[]

export interface StreamingProviderParams {
  type: 'movie' | 'tv'
}

export const getStreamingProviders = async (params: StreamingProviderParams) => {
  return await cached<StreamingProviderParams, StreamingProviderResults>({
    name: 'streaming-providers',
    target: _getStreamingProviders,
    params,
    ttlMinutes: 60 * 24,
  })
}

export async function _getStreamingProviders({ type }: StreamingProviderParams): Promise<StreamingProviderResults> {
  const mediaType = type === 'tv' ? 'tv' : 'movie'
  const query = `
      SELECT
        sp.id, sp.name, sp.logo_path, COUNT(spl.provider_id) as provider_count
      FROM
        streaming_providers sp
      LEFT JOIN
        streaming_provider_links spl ON sp.id = spl.provider_id
      --WHERE
      --  spl.media_type = '${mediaType}'
      GROUP BY
        sp.id, sp.name, sp.logo_path
      ORDER BY
        provider_count DESC;
  `
  const result = await executeQuery(query)
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    logo_path: row.logo_path,
  }))
}
