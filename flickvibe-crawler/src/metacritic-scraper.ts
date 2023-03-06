// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from './user-agent'

export interface MetacriticRatings {
  metaScore?: number
  userScore?: number
}

export type MetacriticPartPath = 'movie' | 'tv'

export class MetacriticScraper {
  readonly mainUrl = 'https://www.metacritic.com'

  async getRatings(partPath: MetacriticPartPath, name: string): Promise<MetacriticRatings> {
    const response = await axios.get(`${this.mainUrl}/${partPath}/${name}`, userAgentHeader)
    const html = response.data
    const $ = cheerio.load(html)

    const distributionScores = $('.distribution .metascore_w').contents()
    const metaScore = distributionScores[0].data ? parseInt(distributionScores[0].data) : undefined
    const userScore = distributionScores[1].data ? parseFloat(distributionScores[1].data) : undefined

    return {
      metaScore,
      userScore,
    }
  }

  async getMovieRatings(movieName: string): Promise<MetacriticRatings> {
    return this.getRatings('movie', movieName)
  }

  async getTvShowRatings(tvShowName: string): Promise<MetacriticRatings> {
    return this.getRatings('tv', tvShowName)
  }

}