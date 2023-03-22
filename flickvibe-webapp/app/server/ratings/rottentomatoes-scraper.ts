// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from './user-agent'

export interface RottenTomatoesRatings {
  url?: string
  tomatometer?: string
  audienceScore?: string
}

export type RottenTomatoesPartPath = 'm' | 'tv'

export class RottenTomatoesScraper {
  readonly mainUrl = 'https://www.rottentomatoes.com'

  async getRatings(partPath: RottenTomatoesPartPath, name: string): Promise<RottenTomatoesRatings> {
    const url = `${this.mainUrl}/${partPath}/${name}`
    let response
    try {
      response = await axios.get(url, userAgentHeader)
    } catch (err) {
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

    const tomatometer = scoreTomatometer ? parseInt(scoreTomatometer).toFixed(0) : undefined
    const audienceScore = scoreAudience ? parseInt(scoreAudience).toFixed(0) : undefined

    return {
      url,
      tomatometer,
      audienceScore,
    }
  }

  async getMovieRatings(movieName: string): Promise<RottenTomatoesRatings> {
    return this.getRatings('m', movieName)
  }

  async getTvShowRatings(tvShowName: string): Promise<RottenTomatoesRatings> {
    return this.getRatings('tv', tvShowName)
  }

}