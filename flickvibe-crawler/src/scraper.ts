import * as dotenv from 'dotenv'

import { pool, upsertJson } from './db/db'
import { TMDBDailyMovie, TMDBDailyTv } from './tmdb-daily'
import { getTMDBMovieDetails, getTMDBTvDetails } from './scraper/tmdb'
import { getRatingsForMovie, getRatingsForTv } from './scraper/ratings'
import { getTropesForMovie, getTropesForTv } from './scraper/tropes'
import { sleep } from './utils/helpers'

dotenv.config()

const scrapeMovie = async (movieId: number) => {
  const details = await getTMDBMovieDetails(movieId)
  console.log(`Movie ${details.title} (${details.year})`)
  const ratings = await getRatingsForMovie(details)
  // const tvtropes = await getTropesForMovie(details)
  const tvtropes = {}
  const movieDetails = {
    ...details,
    ratings,
    tvtropes,
  }
  upsertJson('movie_details', movieDetails)
}

const scrapeTv = async (tvId: number) => {
  const details = await getTMDBTvDetails(tvId)
  console.log(`TV Show ${details.name} (${details.year})`)
  const ratings = await getRatingsForTv(details)
  // const tvtropes = await getTropesForTv(details)
  const tvtropes = {}
  const tvDetails = {
    ...details,
    ratings,
    tvtropes,
  }
  upsertJson('tv_details', tvDetails)
}

const runMovieScraper = async () => {
  console.log('fetching daily updated movies...')
  const { rows } = await pool.query<TMDBDailyMovie>(
    'SELECT id FROM tmdb_daily_movie ORDER BY popularity DESC LIMIT 10000'
  )

  for (const row of rows) {
    await scrapeMovie(row.id)
    await sleep(100)
  }
}

const runTvScraper = async () => {
  console.log('fetching daily updated tv shows...')
  const { rows } = await pool.query<TMDBDailyTv>(
    'SELECT id FROM tmdb_daily_tv ORDER BY popularity DESC LIMIT 10000'
  )

  for (const row of rows) {
    await scrapeTv(row.id)
    await sleep(100)
  }
}

export const runScraper = async () => {
  console.log('starting scraper...')
  runMovieScraper()
  runTvScraper()
}
