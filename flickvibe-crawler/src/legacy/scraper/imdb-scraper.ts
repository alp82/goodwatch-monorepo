// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from '../utils/user-agent'

export interface IMDbRatings {
  score?: number
}

export class IMDbScraper {
  readonly mainUrl = 'https://www.imdb.com/title'

  async getRatings(id: string): Promise<IMDbRatings> {
    const response = await axios.get(`${this.mainUrl}/${id}/`, userAgentHeader)
    const html = response.data
    const $ = cheerio.load(html)

    const scoreElement = $('[data-testid=hero-rating-bar__aggregate-rating__score] span:nth-child(1)').contents()
    const score = scoreElement ? parseFloat(scoreElement.text()) : undefined

    return {
      score,
    }
  }

}