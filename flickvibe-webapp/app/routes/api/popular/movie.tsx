import { json, LoaderFunction } from '@remix-run/node'
import { getPopularMovie, PopularMovieResults } from '~/server/popular.server'

type LoaderData = {
  popular: Awaited<PopularMovieResults>
};

export const loader: LoaderFunction = async () => {
  const popular = await getPopularMovie()

  return json<LoaderData>({
    popular,
  })
}

export default function Movie() {}