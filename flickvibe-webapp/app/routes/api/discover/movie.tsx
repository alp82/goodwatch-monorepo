import { json, LoaderArgs, LoaderFunction } from '@remix-run/node'
import { DiscoverMovieResults, DiscoverMovieSortBy, getDiscoverMovieResults } from '~/server/discover.server'

type LoaderData = {
  discoverMovieResults: Awaited<DiscoverMovieResults>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const language = url.searchParams.get('language') || 'en-US'
  const age_rating_country = url.searchParams.get('age_rating_country') || ''
  const min_age_rating = url.searchParams.get('min_age_rating') || ''
  const max_age_rating = url.searchParams.get('max_age_rating') || ''
  const min_year = url.searchParams.get('min_year') || ''
  const max_year = url.searchParams.get('max_year') || ''
  const with_keywords = url.searchParams.get('with_keywords') || ''
  const without_keywords = url.searchParams.get('without_keywords') || ''
  const with_genres = url.searchParams.get('with_genres') || ''
  const without_genres = url.searchParams.get('without_genres') || ''
  const sort_by = (url.searchParams.get('sort_by') || 'popularity.desc') as DiscoverMovieSortBy

  const discoverMovieResults = await getDiscoverMovieResults({
    language,
    age_rating_country,
    min_age_rating,
    max_age_rating,
    min_year,
    max_year,
    with_keywords,
    without_keywords,
    with_genres,
    without_genres,
    sort_by,
  })

  return json<LoaderData>({
    discoverMovieResults,
  })
}

export default function DiscoverMovie() {}