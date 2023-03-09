import { createClient } from '@supabase/supabase-js'
import { IMDbRatings, IMDbScraper } from '~/server/ratings/imdb-scraper'
import { MetacriticRatings, MetacriticScraper } from '~/server/ratings/metacritic-scraper'
import { RottenTomatoesRatings, RottenTomatoesScraper } from '~/server/ratings/rottentomatoes-scraper'
import { VibeRatings, VibesCalculator } from '~/server/ratings/vibes-calculator'
import { titleToDashed } from '~/utils/helpers'
import { MovieDetails, TVDetails } from '~/server/details.server'

const supabase = createClient(process.env.SUPABASE_PROJECT_URL || '', process.env.SUPABASE_API_KEY || '')

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

export async function getRatingsForMovie(movieDetails: MovieDetails): Promise<Ratings> {
  const cachedData = await supabase
    .from('cached-ratings-movie')
    .select()
    .eq('id', movieDetails.id)
  if (cachedData.data?.length && (Date.now() - new Date(cachedData.data[0].lastUpdated)) < 1000 * 60 * 60 * 12) {
    return cachedData.data[0].ratings as unknown as Ratings
  }

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

  const ratings = {
    vibeRatings,
    imdbRatings,
    metacriticRatings,
    rottenTomatoesRatings,
  }
  const lastUpdated = (new Date()).toISOString()
  const { data, error} = await supabase
    .from('cached-ratings-movie')
    .upsert({ id: movieDetails.id, lastUpdated, ratings })
    .select()
  return ratings
}

export async function getRatingsForTV(tvDetails: TVDetails): Promise<Ratings> {
  const cachedData = await supabase
    .from('cached-ratings-tv')
    .select()
    .eq('id', tvDetails.id)
  if (cachedData.data?.length && (Date.now() - new Date(cachedData.data[0].lastUpdated)) < 1000 * 60 * 60 * 12) {
    return cachedData.data[0].ratings as unknown as Ratings
  }

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

  const ratings = {
    vibeRatings,
    imdbRatings,
    metacriticRatings,
    rottenTomatoesRatings,
  }
  const lastUpdated = (new Date()).toISOString()
  const { data, error} = await supabase
    .from('cached-ratings-tv')
    .upsert({ id: tvDetails.id, lastUpdated, ratings })
    .select()
  return ratings
}
