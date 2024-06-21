import { json, type LoaderFunctionArgs, type LoaderFunction } from '@remix-run/node'
import { getKeywordSearchResults, type KeywordsResults } from '~/server/keywords.server'

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
