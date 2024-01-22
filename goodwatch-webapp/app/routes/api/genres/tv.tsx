import { json, LoaderFunction } from '@remix-run/node'
import { getGenresTV, GenresResults } from '~/server/genres.server'

type LoaderData = {
  genres: Awaited<GenresResults>
};

export const loader: LoaderFunction = async () => {
  const genres = await getGenresTV({
    type: 'default',
  })

  return json<LoaderData>({
    genres,
  })
}

export default function Movie() {}