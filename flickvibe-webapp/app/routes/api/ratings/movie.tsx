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
  const language = url.searchParams.get('language') || 'en'
  const details = await getDetailsForMovie({
    movieId,
    language,
  })
  const ratings = await getRatingsForMovie({
    movieId,
  })

  return json<LoaderData>({
    details,
    ratings,
  })
}

export default function Movie() {}