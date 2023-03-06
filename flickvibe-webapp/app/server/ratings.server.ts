import { OMDB_API_KEY } from '~/config/settings'
import { IMDbRatings, IMDbScraper } from '~/server/ratings/imdb-scraper'
import { MetacriticRatings, MetacriticScraper } from '~/server/ratings/metacritic-scraper'
import { RottenTomatoesRatings, RottenTomatoesScraper } from '~/server/ratings/rottentomatoes-scraper'
import { VibeRatings, VibesCalculator } from '~/server/ratings/vibes-calculator'
import { titleToDashed } from '~/utils/helpers'
import { MovieDetails, TVDetails } from '~/server/details.server'

export enum Type {
  MOVIE = 'movie',
  TV = 'tv',
}

export interface TitleResult {
  Title: string
  Year: string
  imdbID: string
  Type: Type
  Poster: string
}

export interface Ratings {
  vibeRatings: VibeRatings,
  imdbRatings: IMDbRatings,
  metacriticRatings: MetacriticRatings,
  rottenTomatoesRatings: RottenTomatoesRatings,
}

export async function getRatingsForMovie(movieDetails: MovieDetails): Promise<Ratings> {
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

export async function getRatingsForTV(tvDetails: TVDetails): Promise<Ratings> {
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
