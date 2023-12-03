import { IMDbRatings, IMDbScraper } from '~/server/ratings/imdb-scraper'
import { MetacriticRatings, MetacriticScraper } from '~/server/ratings/metacritic-scraper'
import { RottenTomatoesRatings, RottenTomatoesScraper } from '~/server/ratings/rottentomatoes-scraper'
import { VibeRatings, VibesCalculator } from '~/server/ratings/vibes-calculator'
import { getDetailsForMovie, getDetailsForTV } from '~/server/details.server'
import { cached } from '~/utils/cache'

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
    ttlMinutes: 60 * 6,
    // ttlMinutes: 0,
  })
}

export async function _getRatingsForMovie({ movieId }: RatingsMovieParams): Promise<Ratings> {
  const movieDetails = await getDetailsForMovie({ movieId, language: 'en' })
  const { imdb_id, title_dashed, title_underscored, year } = movieDetails

  const imdbScraper = new IMDbScraper()
  const metacriticScraper = new MetacriticScraper()
  const rottenTomatoesScraper = new RottenTomatoesScraper()
  const vibesCalculator = new VibesCalculator()

  const [imdbRatings, metacriticRatings, rottenTomatoesRatings] = await Promise.all([
    imdbScraper.getRatings(imdb_id),
    metacriticScraper.getMovieRatings(title_dashed, year),
    rottenTomatoesScraper.getMovieRatings(title_underscored),
  ])
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
  const imdb_id = tvDetails.external_ids.imdb_id
  const { title_dashed, title_underscored, year } = tvDetails

  const imdbScraper = new IMDbScraper()
  const metacriticScraper = new MetacriticScraper()
  const rottenTomatoesScraper = new RottenTomatoesScraper()
  const vibesCalculator = new VibesCalculator()

  const [imdbRatings, metacriticRatings, rottenTomatoesRatings] = await Promise.all([
    imdbScraper.getRatings(imdb_id),
    metacriticScraper.getTvShowRatings(title_dashed, year),
    rottenTomatoesScraper.getTvShowRatings(title_underscored),
  ])
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

export const getRatingsForTVSeasons = async (params: RatingsTVParams) => {
  return await cached<RatingsTVParams, Ratings[]>({
    name: 'ratings-tv-seasons',
    target: _getRatingsForTVSeasons,
    params,
    ttlMinutes: 60 * 12,
  })
}

export async function _getRatingsForTVSeasons({ tvId }: RatingsTVParams): Promise<Ratings[]> {
  const tvDetails = await getDetailsForTV({ tvId, language: 'en' })
  const seasons = tvDetails.seasons.filter((season) => season.season_number > 0).length

  const imdb_id = tvDetails.external_ids.imdb_id
  const { title_dashed, title_underscored, year } = tvDetails

  const imdbScraper = new IMDbScraper()
  const metacriticScraper = new MetacriticScraper()
  const rottenTomatoesScraper = new RottenTomatoesScraper()
  const vibesCalculator = new VibesCalculator()

  const [imdbRatingsSeason, metacriticRatingsSeason, rottenTomatoesRatingsSeason] = await Promise.all([
    imdbScraper.getTvShowSeasonsRatings(imdb_id, seasons),
    metacriticScraper.getTvShowSeasonsRatings(title_dashed, year, seasons),
    rottenTomatoesScraper.getTvShowSeasonsRatings(title_underscored, seasons),
  ])

  const ratings: Ratings[] = []
  for (let season=0; season<seasons; season++) {
    const imdbRatings = imdbRatingsSeason[season]
    const metacriticRatings = metacriticRatingsSeason[season]
    const rottenTomatoesRatings = rottenTomatoesRatingsSeason[season]
    const vibeRatings = vibesCalculator.getVibes({
      imdbRatings,
      metacriticRatings,
      rottenTomatoesRatings,
    })
    ratings.push({
      vibeRatings,
      imdbRatings,
      metacriticRatings,
      rottenTomatoesRatings,
    })
  }

  return ratings
}
