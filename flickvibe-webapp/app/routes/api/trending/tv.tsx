import { json, LoaderFunction } from '@remix-run/node'
import { getTrendingTV, TrendingTVResults } from '~/server/trending.server'

type LoaderData = {
  trending: Awaited<TrendingTVResults>
};

export const loader: LoaderFunction = async () => {
  const trending = await getTrendingTV({
    type: 'default',
  })

  return json<LoaderData>({
    trending,
  })
}

export default function Movie() {}