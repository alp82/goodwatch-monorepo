// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import cheerio from 'cheerio'
import { userAgentHeader } from '../../utils/user-agent'
import { tryRequests } from '../../utils/helpers'
import { DataSourceConfigForMedia, DataSourceForMedia, MediaData } from '../dataSource'
import { bulkUpsertData, upsertData } from '../../db/db'

export type RottenTomatoesPartPath = 'm' | 'tv'

export interface RottenTomatoesRatings {
  url?: string
  tomatometer?: string
  audienceScore?: string
  seasonNumber?: number
}

export interface RottenTomatoesMovieRatings {
  mediaData?: MediaData
  movie?: RottenTomatoesRatings
}

export interface RottenTomatoesTvRatings {
  mediaData?: MediaData
  tv?: RottenTomatoesRatings
  seasons?: RottenTomatoesRatings[]
}

export class DataSourceRottenTomatoesRatings extends DataSourceForMedia {
  readonly mainUrl = 'https://www.rottentomatoes.com'

  getConfig(): DataSourceConfigForMedia {
    return {
      name: "rotten_tomatoes_ratings",
      classDefinition: DataSourceRottenTomatoesRatings,
      updateIntervalMinutes: 60 * 48,
      retryIntervalSeconds: 10,
      batchSize: 30,
      batchDelaySeconds: 5,
      rateLimitDelaySeconds: 60,
      usesExistingMedia: true,
    }
  }

  async fetchMovieData(mediaData: MediaData): Promise<RottenTomatoesMovieRatings> {
    const { titles_underscored } = mediaData
    if (!titles_underscored) {
      return {}
    }
    const ratings = await this.getMovieRatings(titles_underscored)
    return {
      mediaData,
      movie: ratings,
    }
  }

  async fetchTvData(mediaData: MediaData): Promise<RottenTomatoesTvRatings> {
    const { titles_underscored, number_of_seasons } = mediaData
    if (!titles_underscored) {
      return {}
    }
    const ratings = await this.getTvShowRatings(titles_underscored)
    let seasonRatings: RottenTomatoesRatings[] = []
    if (ratings.url) {
      seasonRatings = await this.getTvShowSeasonsRatings(titles_underscored, number_of_seasons)
    }
    return {
      mediaData,
      tv: ratings,
      seasons: seasonRatings,
    }
  }

  async storeMovieData(data: RottenTomatoesMovieRatings): Promise<void> {
    if (!data.mediaData || !data.movie?.url) return

    const tableName = 'media_ratings'
    const metaScore = data.movie.tomatometer ? parseFloat(data.movie.tomatometer) : null
    const userScore = data.movie.audienceScore ? parseFloat(data.movie.audienceScore) : null
    const tableData = {
      media_id: data.mediaData.id,
      rating_provider: "rotten-tomatoes",
      url: data.movie?.url,
      critic_score: metaScore ? metaScore : null,
      critic_score_original: metaScore,
      user_score: userScore ? userScore : null,
      user_score_original: userScore,
    }
    try {
      const result = await upsertData(tableName, tableData, ['media_id', 'rating_provider'], ['url', 'user_score_original'])
      console.log(`Rotten Tomatoes Rating: ${data.movie.tomatometer} / ${data.movie.audienceScore} (${data.movie?.url})`)
    } catch (error) {
      console.error(error)
    }
  }

  async storeTvData(data: RottenTomatoesTvRatings): Promise<void> {
    if (!data.mediaData || !data.tv?.url) return

    const tableName = 'media_ratings'
    const metaScore = data.tv.tomatometer ? parseFloat(data.tv.tomatometer) : null
    const userScore = data.tv.audienceScore ? parseFloat(data.tv.audienceScore) : null
    const tableData = {
      media_id: data.mediaData.id,
      rating_provider: "rotten-tomatoes",
      url: data.tv?.url,
      critic_score: metaScore ? metaScore : null,
      critic_score_original: metaScore,
      user_score: userScore ? userScore : null,
      user_score_original: userScore,
    }
    try {
      const result = await upsertData(tableName, tableData, ['media_id', 'rating_provider'], ['url', 'user_score_original'])
      console.log(`Rotten Tomatoes Rating: ${data.tv.tomatometer} / ${data.tv.audienceScore} (${data.tv?.url})`)
    } catch (error) {
      console.error(error)
    }

    await this.storeTvSeasonsData(data)
  }

  async storeTvSeasonsData(data: RottenTomatoesTvRatings): Promise<void> {
    if (!data.mediaData || !data.seasons?.[0]?.url) return

    const seasonsWithData = data.seasons.filter((season) => season.url)
    if (seasonsWithData.length === 0) return

    const tableName = 'media_season_ratings'
    const tableData = {
      media_id: new Array(seasonsWithData.length).fill(data.mediaData.id),
      rating_provider: new Array(seasonsWithData.length).fill('rotten-tomatoes'),
      season_number: Array.from(seasonsWithData).map((seasonRating) => seasonRating.seasonNumber),
      url: seasonsWithData.map((seasonRating, index) => seasonRating.url),
      critic_score: seasonsWithData.map((seasonRating, index) => seasonRating.tomatometer ? parseFloat(seasonRating.tomatometer) : null),
      critic_score_original: seasonsWithData.map((seasonRating, index) => seasonRating.tomatometer ? parseFloat(seasonRating.tomatometer) : null),
      user_score: seasonsWithData.map((seasonRating, index) => seasonRating.audienceScore ? parseFloat(seasonRating.audienceScore) : null),
      user_score_original: seasonsWithData.map((seasonRating, index) => seasonRating.audienceScore ? parseFloat(seasonRating.audienceScore) : null),
    }
    try {
      const result = await bulkUpsertData(
        tableName,
        tableData,
        { critic_score: 'numeric', critic_score_original: 'numeric', user_score: 'numeric', user_score_original: 'numeric' },
        ['media_id', 'rating_provider', 'season_number'],
        ['url', 'user_score_original']
      )
      console.log(`Rotten Tomatoes Season Ratings: ${tableData.critic_score_original.join(', ')} / ${tableData.user_score_original.join(', ')} (${data.seasons?.[0].url})`)
    } catch (error) {
      console.error(error)
    }
  }

  async getRatings(partPath: RottenTomatoesPartPath, titles: string[], season?: number): Promise<RottenTomatoesRatings> {
    // TODO variant without stop words "the" "and" "or"
    const urls = titles.reduce<string[]>((result, name) => {
      return [
        ...result,
        `${this.mainUrl}/${partPath}/${name}${season ? `/s${String(season).padStart(2, '0')}`: ''}`
      ]
    }, [])
    const { url, response } = await tryRequests(urls, userAgentHeader)
    if (!url || !response) {
      console.log(`\tno rotten tomatoes URL found for: ${titles[0]}`)
      return {}
    }

    const html = response.data
    const $ = cheerio.load(html)

    const scoreTomatometerMovie = $('#topSection score-board').attr('tomatometerscore')
    const scoreAudienceMovie = $('#topSection score-board').attr('audiencescore')
    const scoreTomatometerTV = $('#topSection [data-qa=tomatometer]').text().replace(/\s|\n|%/g, '')
    const scoreAudienceTV = $('#topSection [data-qa=audience-score]').text().replace(/\s|\n|%/g, '')
    const scoreTomatometer = scoreTomatometerMovie || scoreTomatometerTV
    const scoreAudience = scoreAudienceMovie || scoreAudienceTV

    const tomatometer = scoreTomatometer && !isNaN(parseInt(scoreTomatometer)) ? parseInt(scoreTomatometer).toFixed(0) : undefined
    const audienceScore = scoreAudience && !isNaN(parseInt(scoreAudience)) ? parseInt(scoreAudience).toFixed(0) : undefined

    return {
      url,
      tomatometer,
      audienceScore,
      seasonNumber: season,
    }
  }

  async getMovieRatings(movieNames: string[]): Promise<RottenTomatoesRatings> {
    return await this.getRatings('m', movieNames)
  }

  async getTvShowRatings(tvShowNames: string[]): Promise<RottenTomatoesRatings> {
    return await this.getRatings('tv', tvShowNames)
  }

  async getTvShowSeasonsRatings(tvShowNames: string[], seasons: number = 1): Promise<RottenTomatoesRatings[]> {
    const getRatingsCalls = []
    for (let season=1; season<=seasons; season++) {
      getRatingsCalls.push(this.getRatings('tv', tvShowNames, season))
    }
    return await Promise.all(getRatingsCalls)
  }
}