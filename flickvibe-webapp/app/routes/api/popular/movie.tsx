import { json, LoaderArgs, LoaderFunction } from '@remix-run/node'
import { getPopularMovie, PopularMovieResults } from '~/server/popular.server'

type LoaderData = {
  popular: Awaited<PopularMovieResults>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const language = url.searchParams.get('language') || 'en'
  const popular = await getPopularMovie({
    language,
  })

  return json<LoaderData>({
    popular,
  })
}

export default function Movie() {}