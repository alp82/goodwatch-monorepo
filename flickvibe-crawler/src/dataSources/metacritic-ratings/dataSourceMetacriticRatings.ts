// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios, { AxiosError } from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from '../../utils/user-agent'
import { sleep, tryRequests } from '../../utils/helpers'
import { DataSourceConfigForMedia, DataSourceForMedia, MediaData } from '../dataSource'
import { bulkUpsertData, upsertData } from '../../db/db'

export type MetacriticPartPath = 'movie' | 'tv'

export interface MetacriticRatings {
  url?: string
  metaScore?: string
  userScore?: string
  seasonNumber?: number
}

export interface MetacriticMovieRatings {
  mediaData?: MediaData
  movie?: MetacriticRatings
}

export interface MetacriticTvRatings {
  mediaData?: MediaData
  tv?: MetacriticRatings
  seasons?: MetacriticRatings[]
}

export class DataSourceMetacriticRatings extends DataSourceForMedia {
  readonly mainUrl = 'https://www.metacritic.com'

  getConfig(): DataSourceConfigForMedia {
    return {
      name: "metacritic_ratings",
      classDefinition: DataSourceMetacriticRatings,
      updateIntervalMinutes: 60 * 48,
      retryIntervalSeconds: 10,
      batchSize: 1,
      batchDelaySeconds: 1,
      rateLimitDelaySeconds: 60,
      usesExistingMedia: true,
    }
  }

  async fetchMovieData(mediaData: MediaData): Promise<MetacriticMovieRatings> {
    const { titles_dashed, release_year } = mediaData
    if (!titles_dashed) {
      return {}
    }
    const ratings = await this.getMovieRatings(titles_dashed, release_year)
    return {
      mediaData,
      movie: ratings,
    }
  }

  async fetchTvData(mediaData: MediaData): Promise<MetacriticTvRatings> {
    const { titles_dashed, release_year, number_of_seasons } = mediaData
    if (!titles_dashed) {
      return {}
    }
    const ratings = await this.getTvShowRatings(titles_dashed, release_year)
    let seasonRatings: MetacriticRatings[] = []
    if (ratings.url) {
      seasonRatings = await this.getTvShowSeasonsRatings(titles_dashed, release_year, number_of_seasons)
    }
    return {
      mediaData,
      tv: ratings,
      seasons: seasonRatings || [],
    }
  }

  async storeMovieData(data: MetacriticMovieRatings): Promise<void> {
    if (!data.mediaData || !data.movie?.url) return

    const tableName = 'media_ratings'
    const metaScore = data.movie.metaScore ? parseFloat(data.movie.metaScore) : null
    const userScore = data.movie.userScore ? parseFloat(data.movie.userScore) : null
    const tableData = {
      media_id: data.mediaData.id,
      rating_provider: "metacritic",
      url: data.movie?.url,
      critic_score: metaScore ? metaScore : null,
      critic_score_original: metaScore,
      user_score: userScore ? userScore * 10 : null,
      user_score_original: userScore,
    }
    try {
      const result = await upsertData(tableName, tableData, ['media_id', 'rating_provider'], ['url', 'user_score_original'])
      console.log(`Metacritic Rating: ${data.movie.metaScore} / ${data.movie.userScore} (${data.movie?.url})`)
    } catch (error) {
      console.error(error)
    }
  }

  async storeTvData(data: MetacriticTvRatings): Promise<void> {
    if (!data.mediaData || !data.tv?.url) return

    const tableName = 'media_ratings'
    const metaScore = data.tv.metaScore ? parseFloat(data.tv.metaScore) : null
    const userScore = data.tv.userScore ? parseFloat(data.tv.userScore) : null
    const tableData = {
      media_id: data.mediaData.id,
      rating_provider: "metacritic",
      url: data.tv?.url,
      critic_score: metaScore ? metaScore : null,
      critic_score_original: metaScore,
      user_score: userScore ? userScore * 10 : null,
      user_score_original: userScore,
    }
    try {
      const result = await upsertData(tableName, tableData, ['media_id', 'rating_provider'], ['url', 'user_score_original'])
      console.log(`Metacritic Rating: ${data.tv.metaScore} / ${data.tv.userScore} (${data.tv?.url})`)
    } catch (error) {
      console.error(error)
    }

    await this.storeTvSeasonsData(data)
  }

  async storeTvSeasonsData(data: MetacriticTvRatings): Promise<void> {
    if (!data.mediaData || !data.seasons?.length) return

    const seasonsWithData = data.seasons.filter((season) => season.url)
    if (seasonsWithData.length === 0) return

    const tableName = 'media_season_ratings'
    const tableData = {
      media_id: new Array(seasonsWithData.length).fill(data.mediaData.id),
      rating_provider: new Array(seasonsWithData.length).fill('metacritic'),
      season_number: Array.from(seasonsWithData).map((seasonRating) => seasonRating.seasonNumber),
      url: seasonsWithData.map((seasonRating, index) => seasonRating.url),
      critic_score: seasonsWithData.map((seasonRating, index) => seasonRating.metaScore ? parseFloat(seasonRating.metaScore) : null),
      critic_score_original: seasonsWithData.map((seasonRating, index) => seasonRating.metaScore ? parseFloat(seasonRating.metaScore) : null),
      user_score: seasonsWithData.map((seasonRating, index) => seasonRating.userScore ? parseFloat(seasonRating.userScore) * 10 : null),
      user_score_original: seasonsWithData.map((seasonRating, index) => seasonRating.userScore ? parseFloat(seasonRating.userScore) : null),
    }
    try {
      const result = await bulkUpsertData(
        tableName,
        tableData,
        { critic_score: 'numeric', critic_score_original: 'numeric', user_score: 'numeric', user_score_original: 'numeric' },
        ['media_id', 'rating_provider', 'season_number'],
        ['url', 'user_score_original']
      )
      console.log(`Metacritic Season Ratings: ${tableData.critic_score_original.join(', ')} / ${tableData.user_score_original.join(', ')} (${data.seasons?.[0].url})`)
    } catch (error) {
      console.error(error)
    }
  }

  async getRatings(partPath: MetacriticPartPath, titles: string[], year?: number, season?: number): Promise<MetacriticRatings> {
    const urls = titles.reduce<string[]>((result, name) => {
      return [
        ...result,
        `${this.mainUrl}/${partPath}/${name}-${year}${season ? `/season-${season}`: ''}`,
        `${this.mainUrl}/${partPath}/${name}${season ? `/season-${season}`: ''}`,
      ]
    }, [])
    const { url, response } = await tryRequests(urls, userAgentHeader)
    if (!url || !response?.data) {
      console.log(`\tno metacritics URL found for: ${titles[0]}`)
      return {}
    }

    const html = response.data
    const $ = cheerio.load(html)

    const distributionScores = $('.distribution .metascore_w').contents()
    const metaScore = distributionScores[0]?.data && !isNaN(parseFloat(distributionScores[0]?.data)) ? parseInt(distributionScores[0]?.data).toFixed(0) : undefined
    const userScore = distributionScores[1]?.data && !isNaN(parseFloat(distributionScores[1]?.data)) ? parseFloat(distributionScores[1]?.data).toFixed(1) : undefined

    return {
      url,
      metaScore,
      userScore,
      seasonNumber: season,
    }
  }

  async getMovieRatings(movieNames: string[], year?: number): Promise<MetacriticRatings> {
    return await this.getRatings('movie', movieNames, year)
  }

  async getTvShowRatings(tvShowNames: string[], year?: number): Promise<MetacriticRatings> {
    return await this.getRatings('tv', tvShowNames, year)
  }

  async getTvShowSeasonsRatings(tvShowNames: string[], year?: number, seasons: number = 1): Promise<MetacriticRatings[]> {
    const getRatingsCalls = []
    for (let season=1; season<=seasons; season++) {
      getRatingsCalls.push(this.getRatings('tv', tvShowNames, year, season))
    }
    return await Promise.all(getRatingsCalls)
  }
}