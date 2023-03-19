import { json, LoaderArgs, LoaderFunction } from '@remix-run/node'
import { DiscoverTVResult, DiscoverTVSortBy, getDiscoverTVResults } from '~/server/discover.server'

type LoaderData = {
  discoverTVResults: Awaited<DiscoverTVResult[]>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const language = url.searchParams.get('language') || 'en-US'
  const min_year = url.searchParams.get('min_year') || ''
  const max_year = url.searchParams.get('max_year') || ''
  const with_keywords = url.searchParams.get('with_keywords') || ''
  const without_keywords = url.searchParams.get('without_keywords') || ''
  const with_genres = url.searchParams.get('with_genres') || ''
  const without_genres = url.searchParams.get('without_genres') || ''
  const with_watch_providers = url.searchParams.get('with_watch_providers') || ''
  const watch_region = url.searchParams.get('watch_region') || 'DE'
  const sort_by = (url.searchParams.get('sort_by') || 'popularity.desc') as DiscoverTVSortBy

  const discoverTVResults = await getDiscoverTVResults({
    language,
    min_year,
    max_year,
    with_keywords,
    without_keywords,
    with_genres,
    without_genres,
    with_watch_providers,
    watch_region,
    sort_by,
  })

  return json<LoaderData>({
    discoverTVResults,
  })
}

export default function DiscoverTV() {}