import {json, LoaderArgs, LoaderFunction} from '@remix-run/node'
import {getDetailsForMovie, MovieDetails} from '~/server/details.server'

type LoaderData = {
  details: Awaited<MovieDetails>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const movieId = url.searchParams.get('movieId') || ''
  const language = url.searchParams.get('language') || 'en'
  const country = url.searchParams.get('country') || 'DE'
  const details = await getDetailsForMovie({
    movieId,
    language,
    country,
  })

  return json<LoaderData>({
    details,
  })
}

export default function Movie() {}