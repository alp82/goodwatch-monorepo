import {json, LoaderArgs, LoaderFunction} from '@remix-run/node'
import { CollectionMovie, getMoviesInCollection } from '~/server/collection.server'

type LoaderData = {
  collectionId: string
  movies: CollectionMovie[]
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
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