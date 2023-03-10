import { json, LoaderFunction } from '@remix-run/node'
import { getPopularTV, PopularTVResults } from '~/server/popular.server'

type LoaderData = {
  popular: Awaited<PopularTVResults>
};

export const loader: LoaderFunction = async () => {
  const popular = await getPopularTV()

  return json<LoaderData>({
    popular,
  })
}

export default function Movie() {}