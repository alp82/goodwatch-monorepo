import { json, type LoaderFunctionArgs, type LoaderFunction } from '@remix-run/node'
import { getStreamingProviders, type StreamingProviderResults } from '~/server/streaming-providers.server'

export type LoaderData = {
  streamingProviders: StreamingProviderResults,
}

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const type = (url.searchParams.get('type') || 'movie') as 'movie' | 'tv'
  const params = {
    type,
  }
  const streamingProviders = await getStreamingProviders(params)

  return json<LoaderData>({
    streamingProviders,
  })
}