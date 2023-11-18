import {json, LoaderArgs, LoaderFunction} from '@remix-run/node'
import {getDetailsForTV, TVDetails} from '~/server/details.server'

type LoaderData = {
  details: Awaited<TVDetails>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const tvId = url.searchParams.get('tvId') || ''
  const language = url.searchParams.get('language') || 'en'
  const country = url.searchParams.get('country') || 'DE'
  const details = await getDetailsForTV({
    tvId,
    language,
    country,
  })

  return json<LoaderData>({
    details,
  })
}

export default function Movie() {}