import { createClient } from '@supabase/supabase-js'
import { cached } from '~/utils/api'
import { query } from '~/utils/postgres'

const supabase = createClient(process.env.SUPABASE_PROJECT_URL || '', process.env.SUPABASE_API_KEY || '')

export interface CollectionMovie {
  tmdb_id: number
  title: string
  poster_path: string
  aggregated_overall_score_normalized_percent: number
}

export interface MoviesInCollection {
  collectionId: string
  movies: CollectionMovie[]
}

export interface MovieCollectionParams {
  collectionId: string
  movieIds: string
}

export const getMoviesInCollection = async (params: MovieCollectionParams) => {
  return await cached<MovieCollectionParams, MoviesInCollection>({
    name: 'movie-collection',
    target: _getMoviesInCollection,
    params,
    ttlMinutes: 60 * 24,
  })
}

export async function _getMoviesInCollection({ collectionId, movieIds }: MovieCollectionParams): Promise<MoviesInCollection> {
  const collectionQuery = `SELECT tmdb_id, title, poster_path, aggregated_overall_score_normalized_percent FROM movies WHERE tmdb_id IN (${movieIds})`
  console.log(collectionQuery)
  const result = await query(collectionQuery)
  if (!result.rows.length) throw Error(`movie collection with ID "${collectionId}" has no movies`)

  const movies = result.rows as CollectionMovie[]
  return {
    collectionId,
    movies,
  }
}