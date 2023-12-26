// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios, { AxiosError } from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from '../../utils/user-agent'
import { isRateLimited, sleep, tryRequests } from '../../utils/helpers'
import { DataSourceConfig, DataSource, MediaData } from '../dataSource'
import { bulkUpsertData, upsertData } from '../../db/db'

export interface IMDbRatings {
  url?: string
  score?: string
}

export interface IMDbMovieRatings {
  mediaData?: MediaData
  movie?: IMDbRatings
}

export interface IMDbTvRatings {
  mediaData?: MediaData
  tv?: IMDbRatings
  seasons?: IMDbRatings[]
}

export class DataSourceIMDBRatings extends DataSource {
  readonly mainUrl = 'https://www.imdb.com/title'

  getConfig(): DataSourceConfig {
    return {
      name: "imdb_ratings",
      updateIntervalMinutes: 60 * 24 * 7,
      retryIntervalSeconds: 10,
      batchSize: 1,
      batchDelaySeconds: 0,
      rateLimitDelaySeconds: 10,
    }
  }

  async fetchMovieData(mediaData: MediaData): Promise<IMDbMovieRatings> {
    const { imdb_id } = mediaData
    if (!imdb_id) {
      return {}
    }
    const ratings = await this.getRatings(imdb_id)
    return {
      mediaData,
      movie: ratings,
    }
  }

  async fetchTvData(mediaData: MediaData): Promise<IMDbTvRatings> {
    const { imdb_id, number_of_seasons } = mediaData
    if (!imdb_id) {
      return {}
    }
    const ratings = await this.getRatings(imdb_id)
    const seasonRatings = await this.getTvShowSeasonsRatings(imdb_id, number_of_seasons)
    return {
      mediaData,
      tv: ratings,
      seasons: seasonRatings,
    }
  }

  async storeMovieData(data: IMDbMovieRatings): Promise<void> {
    if (!data.mediaData || !data.movie?.url) return

    const tableName = 'media_ratings'
    const userScore = data.movie.score ? parseFloat(data.movie.score) : null
    const tableData = {
      media_id: data.mediaData.id,
      rating_provider: "imdb",
      url: data.movie?.url,
      user_score: userScore ? userScore * 10 : null,
      user_score_original: userScore,
    }
    try {
      const result = await upsertData(tableName, tableData, ['media_id', 'rating_provider'], ['url', 'user_score_original'])
      console.log(`IMDb Rating: ${data.movie.score} (${data.movie?.url})`)
    } catch (error) {
      console.error(error)
    }
  }

  async storeTvData(data: IMDbTvRatings): Promise<void> {
    if (!data.mediaData || !data.tv?.url) return

    const tableName = 'media_ratings'
    const userScore = data.tv.score ? parseFloat(data.tv.score) : null
    const tableData = {
      media_id: data.mediaData.id,
      rating_provider: "imdb",
      url: data.tv?.url,
      user_score: userScore ? userScore * 10 : null,
      user_score_original: userScore,
    }
    try {
      const result = await upsertData(tableName, tableData, ['media_id', 'rating_provider'], ['url', 'user_score_original'])
      console.log(`IMDb Rating: ${data.tv.score} (${data.tv?.url})`)
    } catch (error) {
      console.error(error)
    }

    await this.storeTvSeasonsData(data)
  }

  async storeTvSeasonsData(data: IMDbTvRatings): Promise<void> {
    if (!data.mediaData || !data.seasons?.length) return

    const seasonsWithData = data.seasons.filter((seasonRating) => seasonRating.url)
    if (seasonsWithData.length === 0) return

    const tableName = 'media_season_ratings'
    const tableData = {
      media_id: new Array(seasonsWithData.length).fill(data.mediaData.id),
      rating_provider: new Array(seasonsWithData.length).fill('imdb'),
      season_number: Array.from(seasonsWithData).map((season, index) => index + 1),
      url: seasonsWithData.map((seasonRating, index) => seasonRating.url),
      user_score: seasonsWithData.map((seasonRating, index) => seasonRating.score ? parseFloat(seasonRating.score) * 10 : null),
      user_score_original: seasonsWithData.map((seasonRating, index) => seasonRating.score ? parseFloat(seasonRating.score) : null),
    }
    try {
      const result = await bulkUpsertData(
        tableName,
        tableData,
        { user_score: 'numeric', user_score_original: 'numeric' },
        ['media_id', 'rating_provider', 'season_number'],
        ['url', 'user_score_original']
      )
      console.log(`IMDb Season Ratings: ${tableData.user_score_original.join(', ')} (${data.seasons?.[0].url})`)
    } catch (error) {
      console.error(error)
    }
  }

  async getRatings(id: string): Promise<IMDbRatings> {
    const url = `${this.mainUrl}/${id}/`

    let response
    try {
      response = await axios.get(url, userAgentHeader)
    } catch (error) {
      if (isRateLimited(error)) {
        throw error
      } else {
        console.error(error)
        console.log(`\tno IMDb URL found for: ${id}`)
        return {}
      }
    }

    if (!url || !response?.data) {
      console.log(`\tno imdb URL found for: ${id}`)
      return {}
    }

    const html = response?.data
    const $ = cheerio.load(html)

    const scoreElement = $('[data-testid=hero-rating-bar__aggregate-rating__score] span:nth-child(1)').contents()
    const score = scoreElement && !isNaN(parseFloat(scoreElement.text())) ? parseFloat(scoreElement.text()).toFixed(1) : undefined

    return {
      url,
      score,
    }
  }

  async getTvShowSeasonsRatings(id: string, seasons: number = 1): Promise<IMDbRatings[]> {
    const getRatingsCalls = []
    for (let season=1; season<=seasons; season++) {
      getRatingsCalls.push(this.getRatingsForSeason(id, season))
    }
    return await Promise.all(getRatingsCalls)
  }

  async getRatingsForSeason(id: string, season: number): Promise<IMDbRatings> {
    const url = `${this.mainUrl}/${id}/episodes?season=${season}`

    let response
    try {
      response = await axios.get(url, userAgentHeader)
    } catch (error) {
      if (isRateLimited(error)) {
        throw error
      } else {
        console.error(error)
        console.log(`\tno IMDb URL found for: ${id} (Season: ${season})`)
        return {}
      }
    }

    if (!response?.data) {
      console.log(`\tno IMDb URL found for: ${id} (Season: ${season})`)
      return {}
    }

    const html = response?.data
    const $ = cheerio.load(html)

    const scores = $('.eplist .ipl-rating-widget > .ipl-rating-star > .ipl-rating-star__rating')
    let sum = 0
    scores.each((i, element) => {
      sum += parseFloat($(element).text())
    })
    const score = scores.length ? (sum / scores.length).toFixed(1) : undefined

    return {
      url,
      score,
    }
  }
}