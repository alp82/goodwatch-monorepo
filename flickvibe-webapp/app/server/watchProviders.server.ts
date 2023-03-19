import { cached } from '~/utils/api'

export interface WatchProvider {
  display_priorities: Record<string, number>
  display_priority: number
  logo_path: string
  provider_name: string
  provider_id: string
}

export interface WatchProvidersResults {
  results: WatchProvider[]
}

export interface WatchProvidersMovieParams {
  type: 'default'
}
export interface WatchProvidersTVParams {
  type: 'default'
}

export const getWatchProvidersMovie = async (params: WatchProvidersMovieParams) => {
  return await cached<WatchProvidersMovieParams, WatchProvidersResults>({
    name: 'watch-providers-movie',
    target: _getWatchProvidersMovie,
    params,
    ttlMinutes: 60 * 24,
  })
}

export async function _getWatchProvidersMovie({}: WatchProvidersMovieParams): Promise<WatchProvidersResults> {
  return await fetch(
    `https://api.themoviedb.org/3/watch/providers/movie?api_key=${process.env.TMDB_API_KEY}`
  ).then((res) => res.json())
}

export const getWatchProvidersTV = async (params: WatchProvidersTVParams) => {
  return await cached<WatchProvidersTVParams, WatchProvidersResults>({
    name: 'watch-providers-tv',
    target: _getWatchProvidersTV,
    params,
    ttlMinutes: 60 * 24,
  })
}

export async function _getWatchProvidersTV({}: WatchProvidersTVParams): Promise<WatchProvidersResults> {
  return await fetch(
    `https://api.themoviedb.org/3/watch/providers/tv?api_key=${process.env.TMDB_API_KEY}`
  ).then((res) => res.json())
}
