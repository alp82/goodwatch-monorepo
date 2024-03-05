import { json, LoaderFunctionArgs, LoaderFunction } from '@remix-run/node'
import { getKeywordSearchResults, KeywordsResults } from '~/server/keywords.server'

type LoaderData = {
  keywords: Awaited<KeywordsResults>
};

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url)
  const query = url.searchParams.get('query') || ''
  const keywords = await getKeywordSearchResults({
    query,
  })

  return json<LoaderData>({
    keywords,
  })
}

export default function KeywordSearch() {}