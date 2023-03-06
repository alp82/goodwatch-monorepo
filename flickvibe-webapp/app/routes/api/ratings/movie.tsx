import { json, LoaderArgs, LoaderFunction } from '@remix-run/node'
import { getRatingsForMovie, Ratings } from '~/server/ratings.server'
import { getDetailsForMovie, MovieDetails } from '~/server/details.server'

type LoaderData = {
  details: Awaited<MovieDetails>
  ratings: Awaited<Ratings>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const movieId = url.searchParams.get('movieId') || ''
  const details = await getDetailsForMovie(movieId)
  const ratings = await getRatingsForMovie(details)

  return json<LoaderData>({
    details,
    ratings,
  })
}

export default function Movie() {}