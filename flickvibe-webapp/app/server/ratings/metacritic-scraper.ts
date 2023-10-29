// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from './user-agent'

export interface MetacriticRatings {
  url?: string
  metaScore?: string
  userScore?: string
}

export type MetacriticPartPath = 'movie' | 'tv'

export class MetacriticScraper {
  readonly mainUrl = 'https://www.metacritic.com'

  async getRatings(partPath: MetacriticPartPath, name: string, year: string, season?: number): Promise<MetacriticRatings> {
    let url
    let response
    try {
      // first try with the year attached to find more recent result if there are duplicates
      url = `${this.mainUrl}/${partPath}/${name}-${year}${season ? `/season-${season}`: ''}`
      response = await axios.get(url, userAgentHeader)
    } catch (err) {
      // at this point we might have a 404 if the url above is not correct
      try {
        // use without year to get the normal url (no duplicate or older result)
        url = `${this.mainUrl}/${partPath}/${name}${season ? `/season-${season}`: ''}`
        response = await axios.get(url, userAgentHeader)
      } catch (err) {
        console.error(err)
        return {}
      }
    }

    const html = response.data
    const $ = cheerio.load(html)

    // const distributionScores = $('.distribution .metascore_w').contents()
    const metaScoreElement = $('.c-siteReviewScore[title^="Metascore"] span').first().contents()
    const userScoreElement = $('.c-siteReviewScore[title^="User score"] span').first().contents()

    const metaScore = metaScoreElement[0]?.data && !isNaN(parseFloat(metaScoreElement[0].data)) ? parseInt(metaScoreElement[0].data).toFixed(0) : undefined
    const userScore = userScoreElement[0]?.data && !isNaN(parseFloat(userScoreElement[0].data)) ? parseFloat(userScoreElement[0].data).toFixed(1) : undefined

    return {
      url,
      metaScore,
      userScore,
    }
  }

  async getMovieRatings(movieName: string, year: string): Promise<MetacriticRatings> {
    return await this.getRatings('movie', movieName, year)
  }

  async getTvShowRatings(tvShowName: string, year: string): Promise<MetacriticRatings> {
    return await this.getRatings('tv', tvShowName, year)
  }

  async getTvShowSeasonsRatings(tvShowName: string, year: string, seasons: number): Promise<MetacriticRatings[]> {
    const getRatingsCalls = []
    for (let season=1; season<=seasons; season++) {
      getRatingsCalls.push(this.getRatings('tv', tvShowName, year, season))
    }
    return await Promise.all(getRatingsCalls)
  }
}
