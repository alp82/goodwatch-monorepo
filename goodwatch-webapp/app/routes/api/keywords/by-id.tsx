import { json, LoaderArgs, LoaderFunction } from '@remix-run/node'
import { getKeywords, Keyword } from '~/server/keywords.server'

type LoaderData = {
  keywords: Awaited<Keyword[]>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const keywordIds = (url.searchParams.get('keywordIds') || '').split(',')
  const keywords = await getKeywords({
    keywordIds,
  })

  return json<LoaderData>({
    keywords,
  })
}

export default function KeywordsById() {}