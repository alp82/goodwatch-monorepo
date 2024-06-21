import { json, type LoaderFunction } from '@remix-run/node'
import { getGenresTV, type GenresResults } from '~/server/genres.server'

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
