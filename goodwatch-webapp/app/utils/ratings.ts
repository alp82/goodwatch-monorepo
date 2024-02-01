import { MovieDetails, TVDetails } from '~/server/details.server'
import { DiscoverMovie, DiscoverTV } from '~/server/discover.server'

export interface AllRatings {
  tmdb_url: string
  tmdb_user_score_original: number
  tmdb_user_score_normalized_percent: number
  tmdb_user_score_rating_count: number
  imdb_url: string
  imdb_user_score_original: number
  imdb_user_score_normalized_percent: number
  imdb_user_score_rating_count: number
  metacritic_url: string
  metacritic_user_score_original: number
  metacritic_user_score_normalized_percent: number
  metacritic_user_score_rating_count: number
  metacritic_meta_score_original: number
  metacritic_meta_score_normalized_percent: number
  metacritic_meta_score_review_count: number
  rotten_tomatoes_url: string
  rotten_tomatoes_audience_score_original: number
  rotten_tomatoes_audience_score_normalized_percent: number
  rotten_tomatoes_audience_score_rating_count: number
  rotten_tomatoes_tomato_score_original: number
  rotten_tomatoes_tomato_score_normalized_percent: number
  rotten_tomatoes_tomato_score_review_count: number
  aggregated_user_score_normalized_percent: number
  aggregated_user_score_rating_count: number
  aggregated_official_score_normalized_percent: number
  aggregated_official_score_review_count: number
  aggregated_overall_score_normalized_percent: number
  aggregated_overall_score_voting_count: number
}

export const getRatingKeys = () => {
  const keys: (keyof AllRatings)[] = [
    'tmdb_url',
    'tmdb_user_score_original',
    'tmdb_user_score_normalized_percent',
    'tmdb_user_score_rating_count',
    'imdb_url',
    'imdb_user_score_original',
    'imdb_user_score_normalized_percent',
    'imdb_user_score_rating_count',
    'metacritic_url',
    'metacritic_user_score_original',
    'metacritic_user_score_normalized_percent',
    'metacritic_user_score_rating_count',
    'metacritic_meta_score_original',
    'metacritic_meta_score_normalized_percent',
    'metacritic_meta_score_review_count',
    'rotten_tomatoes_url',
    'rotten_tomatoes_audience_score_original',
    'rotten_tomatoes_audience_score_normalized_percent',
    'rotten_tomatoes_audience_score_rating_count',
    'rotten_tomatoes_tomato_score_original',
    'rotten_tomatoes_tomato_score_normalized_percent',
    'rotten_tomatoes_tomato_score_review_count',
    'aggregated_user_score_normalized_percent',
    'aggregated_user_score_rating_count',
    'aggregated_official_score_normalized_percent',
    'aggregated_official_score_review_count',
    'aggregated_overall_score_normalized_percent',
    'aggregated_overall_score_voting_count',
  ]
  return keys
}

export const extractRatings = (details: MovieDetails | TVDetails | DiscoverMovie | DiscoverTV) => {
  const keys = getRatingKeys()
  return keys.reduce((acc, key) => {
    return {
      ...acc,
      [key]: details[key],
    }
  }, {}) as AllRatings
}