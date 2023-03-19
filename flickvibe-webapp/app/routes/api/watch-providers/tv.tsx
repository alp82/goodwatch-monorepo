import { json, LoaderFunction } from '@remix-run/node'
import { getWatchProvidersTV, WatchProvider } from '~/server/watchProviders.server'

type LoaderData = {
  watchProviders: Awaited<WatchProvider[]>
};

export const loader: LoaderFunction = async () => {
  const unsortedWatchProviders = await getWatchProvidersTV({
    type: 'default',
  })

  const watchProviders = (unsortedWatchProviders?.results || []).sort((a, b) => {
    return a.display_priority < b.display_priority ? -1 : 1
  })

  return json<LoaderData>({
    watchProviders,
  })
}

export default function Tv() {}