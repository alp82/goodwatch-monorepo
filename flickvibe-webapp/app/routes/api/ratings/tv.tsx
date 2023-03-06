import { json, LoaderArgs, LoaderFunction } from '@remix-run/node'
import { getRatingsForTV, Ratings } from '~/server/ratings.server'
import { TVDetails, getDetailsForTV } from '~/server/details.server'

type LoaderData = {
  details: Awaited<TVDetails>
  ratings: Awaited<Ratings>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const tvId = url.searchParams.get('tvId') || ''
  const details = await getDetailsForTV(tvId)
  const ratings = await getRatingsForTV(details)

  return json<LoaderData>({
    details,
    ratings,
  })
}

export default function Movie() {}