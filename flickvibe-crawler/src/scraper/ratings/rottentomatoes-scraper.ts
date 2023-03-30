// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from '../../utils/user-agent'
import { tryRequests } from '../../utils/helpers'

export interface RottenTomatoesRatings {
  url?: string
  tomatometer?: string
  audienceScore?: string
}

export type RottenTomatoesPartPath = 'm' | 'tv'

export class RottenTomatoesScraper {
  readonly mainUrl = 'https://www.rottentomatoes.com'

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
    }
  }

  async getMovieRatings(movieNames: string[]): Promise<RottenTomatoesRatings> {
    return this.getRatings('m', movieNames)
  }

  async getTvShowRatings(tvShowNames: string[]): Promise<RottenTomatoesRatings> {
    return this.getRatings('tv', tvShowNames)
  }

  async getTvShowSeasonsRatings(tvShowNames: string[], seasons: number): Promise<RottenTomatoesRatings[]> {
    const getRatingsCalls = []
    for (let season=1; season<=seasons; season++) {
      getRatingsCalls.push(this.getRatings('tv', tvShowNames, season))
    }
    return await Promise.all(getRatingsCalls)
  }

}