// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from './user-agent'

export interface IMDbRatings {
  url?: string
  score?: number
}

export class IMDbScraper {
  readonly mainUrl = 'https://www.imdb.com/title'

  async getRatings(id: string): Promise<IMDbRatings> {
    const url = `${this.mainUrl}/${id}/`

    let response
    try {
      response = await axios.get(url, userAgentHeader)
    } catch (err) {
      return {}
    }
    const html = response.data
    const $ = cheerio.load(html)

    const scoreElement = $('[data-testid=hero-rating-bar__aggregate-rating__score] span:nth-child(1)').contents()
    const score = scoreElement ? parseFloat(scoreElement.text()) : undefined

    return {
      url,
      score,
    }
  }

}