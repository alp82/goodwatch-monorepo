import {json, LoaderArgs, LoaderFunction} from '@remix-run/node'
import {getRatingsForTV, getRatingsForTVSeasons, Ratings, SeasonRatings} from '~/server/ratings.server'

type LoaderData = {
  ratings: Awaited<SeasonRatings>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const tvId = url.searchParams.get('tvId') || ''
  const ratings = await getRatingsForTVSeasons({
    tvId,
  })

  return json<LoaderData>({
    ratings,
  })
}

export default function TV() {}