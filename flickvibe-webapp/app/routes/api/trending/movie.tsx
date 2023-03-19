import { json, LoaderFunction } from '@remix-run/node'
import { getTrendingMovie, TrendingMovieResults } from '~/server/trending.server'

type LoaderData = {
  trending: Awaited<TrendingMovieResults>
};

export const loader: LoaderFunction = async () => {
  const trending = await getTrendingMovie({
    type: 'default',
  })

  return json<LoaderData>({
    trending,
  })
}

export default function Movie() {}