import { VibeRatings, VibesCalculator } from './ratings/vibes-calculator'
import { IMDbRatings, IMDbScraper } from './ratings/imdb-scraper'
import { MetacriticRatings, MetacriticScraper } from './ratings/metacritic-scraper'
import { RottenTomatoesRatings, RottenTomatoesScraper } from './ratings/rottentomatoes-scraper'
import { TMDBMovieDetails, TMDBTvDetails } from '../types/details.types'

export interface Ratings {
  vibeRatings: VibeRatings,
  imdbRatings: IMDbRatings,
  metacriticRatings: MetacriticRatings,
  rottenTomatoesRatings: RottenTomatoesRatings,
  seasons?: Ratings[]
}

export const getRatingsForMovie = async (movieDetails: TMDBMovieDetails): Promise<Ratings> => {
  // TODO titles
  const { imdb_id, titles_dashed, titles_underscored, year } = movieDetails

  const imdbScraper = new IMDbScraper()
  const metacriticScraper = new MetacriticScraper()
  const rottenTomatoesScraper = new RottenTomatoesScraper()
  const vibesCalculator = new VibesCalculator()

  const [imdbRatings, metacriticRatings, rottenTomatoesRatings] = await Promise.all([
    imdbScraper.getRatings(imdb_id),
    metacriticScraper.getMovieRatings(titles_dashed, year),
    rottenTomatoesScraper.getMovieRatings(titles_underscored),
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

export async function getRatingsForTv(tvDetails: TMDBTvDetails): Promise<Ratings> {
  const imdb_id = tvDetails.external_ids.imdb_id
  // TODO titles
  const { titles_dashed, titles_underscored, year } = tvDetails

  const imdbScraper = new IMDbScraper()
  const metacriticScraper = new MetacriticScraper()
  const rottenTomatoesScraper = new RottenTomatoesScraper()
  const vibesCalculator = new VibesCalculator()

  const [imdbRatings, metacriticRatings, rottenTomatoesRatings] = await Promise.all([
    imdbScraper.getRatings(imdb_id),
    metacriticScraper.getTvShowRatings(titles_dashed, year),
    rottenTomatoesScraper.getTvShowRatings(titles_underscored),
  ])
  const vibeRatings = vibesCalculator.getVibes({
    imdbRatings,
    metacriticRatings,
    rottenTomatoesRatings,
  })

  const seasons = await getRatingsForTVSeasons(tvDetails)

  return {
    vibeRatings,
    imdbRatings,
    metacriticRatings,
    rottenTomatoesRatings,
    seasons,
  }
}

export async function getRatingsForTVSeasons(tvDetails: TMDBTvDetails): Promise<Ratings[]> {
  const seasons = tvDetails.seasons.filter((season) => season.season_number > 0).length

  const imdb_id = tvDetails.external_ids.imdb_id
  const { titles_dashed, titles_underscored, year } = tvDetails

  const imdbScraper = new IMDbScraper()
  const metacriticScraper = new MetacriticScraper()
  const rottenTomatoesScraper = new RottenTomatoesScraper()
  const vibesCalculator = new VibesCalculator()

  const [imdbRatingsSeason, metacriticRatingsSeason, rottenTomatoesRatingsSeason] = await Promise.all([
    imdbScraper.getTvShowSeasonsRatings(imdb_id, seasons),
    metacriticScraper.getTvShowSeasonsRatings(titles_dashed, year, seasons),
    rottenTomatoesScraper.getTvShowSeasonsRatings(titles_underscored, seasons),
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
