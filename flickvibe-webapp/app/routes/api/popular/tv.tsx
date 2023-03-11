import { json, LoaderArgs, LoaderFunction } from '@remix-run/node'
import { getPopularTV, PopularTVResults } from '~/server/popular.server'

type LoaderData = {
  popular: Awaited<PopularTVResults>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const language = url.searchParams.get('language') || 'en'
  const region = url.searchParams.get('region') || 'DE'
  const popular = await getPopularTV({
    language,
    region,
  })

  return json<LoaderData>({
    popular,
  })
}

export default function Movie() {}