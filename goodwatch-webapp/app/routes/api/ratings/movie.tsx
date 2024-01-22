import {json, LoaderArgs, LoaderFunction} from '@remix-run/node'
import {getRatingsForMovie, Ratings} from '~/server/ratings.server'

type LoaderData = {
  ratings: Awaited<Ratings>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const movieId = url.searchParams.get('movieId') || ''
  const ratings = await getRatingsForMovie({
    movieId,
  })

  return json<LoaderData>({
    ratings,
  })
}

export default function Movie() {}