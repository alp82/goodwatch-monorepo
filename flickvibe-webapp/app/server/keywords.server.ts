import { cached } from '~/utils/api'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_PROJECT_URL || '', process.env.SUPABASE_API_KEY || '')

export interface Keyword {
  id: number
  name: string
}

export interface KeywordsResults {
  page: number
  results: Keyword[]
  total_pages: number
  total_results: number
}

export interface KeywordSearchParams {
  query: string
}

export interface KeywordsParams {
  keywordIds: string[]
}

export const getKeywordSearchResults = async (params: KeywordSearchParams): Promise<KeywordsResults> => {
  return await cached<KeywordSearchParams, KeywordsResults>({
    name: 'keywords',
    target: _getKeywordSearchResults,
    params,
    ttlMinutes: 60 * 2,
  })
}

async function _getKeywordSearchResults({ query }: KeywordSearchParams): Promise<KeywordsResults> {
  const keywordsResults = await fetch(
    `https://api.themoviedb.org/3/search/keyword?api_key=${process.env.TMDB_API_KEY}&query=${query}`
  ).then((res) => res.json())

  const { data, error } = await supabase
    .from('keywords')
    .upsert(keywordsResults.results)
    .select()
  if (error) {
    console.error({ data, error })
  }

  return keywordsResults
}

export const getKeywords = async ({ keywordIds }: KeywordsParams): Promise<Keyword[]> => {
  const response = await supabase
    .from('keywords')
    .select()
    .in('id', keywordIds)

  return (response.data || []) as Keyword[]
}
