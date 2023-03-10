import { IMDbRatings, IMDbScraper } from '~/server/ratings/imdb-scraper'
import { MetacriticRatings, MetacriticScraper } from '~/server/ratings/metacritic-scraper'
import { RottenTomatoesRatings, RottenTomatoesScraper } from '~/server/ratings/rottentomatoes-scraper'
import { VibeRatings, VibesCalculator } from '~/server/ratings/vibes-calculator'
import { titleToDashed } from '~/utils/helpers'
import { getDetailsForMovie, getDetailsForTV } from '~/server/details.server'
import { cached } from '~/utils/api'

export enum Type {
  MOVIE = 'movie',
  TV = 'tv',
}

export interface Ratings {
  vibeRatings: VibeRatings,
  imdbRatings: IMDbRatings,
  metacriticRatings: MetacriticRatings,
  rottenTomatoesRatings: RottenTomatoesRatings,
}

export interface RatingsMovieParams {
  movieId: string
}

export interface RatingsTVParams {
  tvId: string
}

export const getRatingsForMovie = async (params: RatingsMovieParams) => {
  return await cached<RatingsMovieParams, Ratings>({
    name: 'ratings-movie',
    target: _getRatingsForMovie,
    params,
    ttlMinutes: 60 * 12,
  })
}

export async function _getRatingsForMovie({ movieId }: RatingsMovieParams): Promise<Ratings> {
  const movieDetails = await getDetailsForMovie({ movieId, language: 'en' })
  const imdbID = movieDetails.imdb_id
  const title = movieDetails.title
  const year = movieDetails.release_date.split('-')[0]

  const title_dashed = titleToDashed(title)
  const title_underscored = title_dashed.replace(/-/g, '_')

  const imdbScraper = new IMDbScraper()
  const metacriticScraper = new MetacriticScraper()
  const rottenTomatoesScraper = new RottenTomatoesScraper()
  const vibesCalculator = new VibesCalculator()

  const imdbRatings = await imdbScraper.getRatings(imdbID)
  const metacriticRatings = await metacriticScraper.getMovieRatings(title_dashed, year)
  const rottenTomatoesRatings = await rottenTomatoesScraper.getMovieRatings(title_underscored)
  const vibeRatings = vibesCalculator.getVibes({
    imdbRatings,
    metacriticRatings,
    rottenTomatoesRatings,
  })

  return {
    vibeRatings,
    imdbRatings,
    metacriticRatings,
    rottenTomatoesRatings,
  }
}

export const getRatingsForTV = async (params: RatingsTVParams) => {
  return await cached<RatingsTVParams, Ratings>({
    name: 'ratings-tv',
    target: _getRatingsForTV,
    params,
    ttlMinutes: 60 * 12,
  })
}

export async function _getRatingsForTV({ tvId }: RatingsTVParams): Promise<Ratings> {
  const tvDetails = await getDetailsForTV({ tvId, language: 'en' })
  const imdbID = tvDetails.external_ids.imdb_id
  const title = tvDetails.name
  const year = tvDetails.first_air_date.split('-')[0]

  const title_dashed = titleToDashed(title)
  const title_underscored = title_dashed.replace(/-/g, '_')

  const imdbScraper = new IMDbScraper()
  const metacriticScraper = new MetacriticScraper()
  const rottenTomatoesScraper = new RottenTomatoesScraper()
  const vibesCalculator = new VibesCalculator()

  const imdbRatings = await imdbScraper.getRatings(imdbID)
  const metacriticRatings = await metacriticScraper.getTvShowRatings(title_dashed, year)
  const rottenTomatoesRatings = await rottenTomatoesScraper.getTvShowRatings(title_underscored)
  const vibeRatings = vibesCalculator.getVibes({
    imdbRatings,
    metacriticRatings,
    rottenTomatoesRatings,
  })

  return {
    vibeRatings,
    imdbRatings,
    metacriticRatings,
    rottenTomatoesRatings,
  }
}
