// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from './user-agent'

export interface IMDbRatings {
  url?: string
  score?: string
}

export class IMDbScraper {
  readonly mainUrl = 'https://www.imdb.com/title'

  async getRatings(id: string): Promise<IMDbRatings> {
    const url = `${this.mainUrl}/${id}/`

    let response
    try {
      response = await axios.get(url, userAgentHeader)
    } catch (err) {
      console.error(err)
      return {}
    }
    const html = response.data
    const $ = cheerio.load(html)

    const scoreElement = $('[data-testid=hero-rating-bar__aggregate-rating__score] span:nth-child(1)').contents()
    const score = scoreElement && !isNaN(parseFloat(scoreElement.text())) ? parseFloat(scoreElement.text()).toFixed(1) : undefined

    return {
      url,
      score,
    }
  }

  async getRatingsForSeason(id: string, season: number): Promise<IMDbRatings> {
    const url = `${this.mainUrl}/${id}/episodes?season=${season}`

    let response
    try {
      response = await axios.get(url, userAgentHeader)
    } catch (err) {
      console.error(err)
      return {}
    }
    const html = response.data
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

  async getTvShowSeasonsRatings(id: string, seasons: number): Promise<IMDbRatings[]> {
    const getRatingsCalls = []
    for (let season=1; season<=seasons; season++) {
      getRatingsCalls.push(this.getRatingsForSeason(id, season))
    }
    return await Promise.all(getRatingsCalls)
  }

}