import { json, LoaderArgs, LoaderFunction } from '@remix-run/node'
import { getSearchResults, SearchResults } from '~/server/search.server'

type LoaderData = {
  searchResults: Awaited<SearchResults>
};

export const loader: LoaderFunction = async ({ request }: LoaderArgs) => {
  const url = new URL(request.url)
  const query = url.searchParams.get('query') || ''
  const rawResults = await getSearchResults(query)
  const sortedResults = rawResults.sort((a, b) => {
    return (a.popularity < b.popularity) ? 1 : -1
  })
  return json<LoaderData>({
    searchResults: sortedResults,
  })
}

export default function Search() {}