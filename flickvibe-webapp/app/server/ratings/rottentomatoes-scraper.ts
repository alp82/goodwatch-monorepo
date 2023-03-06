// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from './user-agent'

export interface RottenTomatoesRatings {
  tomatometer?: number
  audienceScore?: number
}

export type RottenTomatoesPartPath = 'm' | 'tv'

export class RottenTomatoesScraper {
  readonly mainUrl = 'https://www.rottentomatoes.com'

  async getRatings(partPath: RottenTomatoesPartPath, name: string): Promise<RottenTomatoesRatings> {
    let response
    try {
      response = await axios.get(`${this.mainUrl}/${partPath}/${name}`, userAgentHeader)
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

    const tomatometer = scoreTomatometer ? parseInt(scoreTomatometer) : undefined
    const audienceScore = scoreAudience ? parseInt(scoreAudience) : undefined

    return {
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