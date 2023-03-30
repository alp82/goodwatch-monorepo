// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from '../../utils/user-agent'
import { tryRequests } from '../../utils/helpers'

export interface MetacriticRatings {
  url?: string
  metaScore?: string
  userScore?: string
}

export type MetacriticPartPath = 'movie' | 'tv'

export class MetacriticScraper {
  readonly mainUrl = 'https://www.metacritic.com'

  async getRatings(partPath: MetacriticPartPath, titles: string[], year: string, season?: number): Promise<MetacriticRatings> {
    const urls = titles.reduce<string[]>((result, name) => {
      return [
        ...result,
        `${this.mainUrl}/${partPath}/${name}-${year}${season ? `/season-${season}`: ''}`,
        `${this.mainUrl}/${partPath}/${name}${season ? `/season-${season}`: ''}`,
      ]
    }, [])
    const { url, response } = await tryRequests(urls, userAgentHeader)
    if (!url || !response) {
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
    }
  }

  async getMovieRatings(movieNames: string[], year: string): Promise<MetacriticRatings> {
    return await this.getRatings('movie', movieNames, year)
  }

  async getTvShowRatings(tvShowNames: string[], year: string): Promise<MetacriticRatings> {
    return await this.getRatings('tv', tvShowNames, year)
  }

  async getTvShowSeasonsRatings(tvShowNames: string[], year: string, seasons: number): Promise<MetacriticRatings[]> {
    const getRatingsCalls = []
    for (let season=1; season<=seasons; season++) {
      getRatingsCalls.push(this.getRatings('tv', tvShowNames, year, season))
    }
    return await Promise.all(getRatingsCalls)
  }
}
