import {json, LoaderArgs, LoaderFunction} from '@remix-run/node'
import {getRatingsForTV, Ratings} from '~/server/ratings.server'

type LoaderData = {
  ratings: Awaited<Ratings>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const tvId = url.searchParams.get('tvId') || ''
  const ratings = await getRatingsForTV({
    tvId,
  })

  return json<LoaderData>({
    ratings,
  })
}

export default function TV() {}