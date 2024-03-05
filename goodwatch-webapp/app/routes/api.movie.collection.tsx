import {json, LoaderFunctionArgs, LoaderFunction} from '@remix-run/node'
import { getMoviesInCollection } from '~/server/collection.server'
import { MovieDetails } from '~/server/details.server'

type LoaderData = {
  collectionId: string
  movies: MovieDetails[]
};

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const collectionId = url.searchParams.get('collectionId') || ''
  const movieIds = url.searchParams.get('movieIds') || ''
  const moviesInCollection = await getMoviesInCollection({
    collectionId,
    movieIds,
  })

  return json<LoaderData>(moviesInCollection)
}

export default function MoviesInCollection() {}