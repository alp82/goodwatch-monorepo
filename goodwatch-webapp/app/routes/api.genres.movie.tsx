import { json, LoaderFunction } from '@remix-run/node'
import { getGenresMovie, GenresResults } from '~/server/genres.server'

type LoaderData = {
  genres: Awaited<GenresResults>
};

export const loader: LoaderFunction = async () => {
  const genres = await getGenresMovie({
    type: 'default',
  })

  return json<LoaderData>({
    genres,
  })
}
