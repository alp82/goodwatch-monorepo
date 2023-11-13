// inspired by https://github.com/uiii/web-scraper-with-nodejs-and-typescript/blob/article-2-the-crawler-part/index.ts

import axios, { AxiosError } from 'axios'
import cheerio from 'cheerio'
import { userAgentHeader } from '../../utils/user-agent'
import { sleep, tryRequests } from '../../utils/helpers'
import { DataSourceConfigForMedia, DataSource, MediaData } from '../dataSource'
import { bulkUpsertData, BulkUpsertResult, upsertData } from '../../db/db'

type TvTropesType = 'Film' | 'Series'

export interface Tropes {
  url?: string
  names?: string[]
  values?: Record<string, string>
}

export interface TropesResult {
  mediaData?: MediaData
  tropes?: Tropes
}

export class DataSourceTvTropesTags extends DataSource {
  readonly mainUrl = 'https://tvtropes.org/pmwiki/pmwiki.php'

  getConfig(): DataSourceConfigForMedia {
    return {
      name: "tv_tropes_tags",
      classDefinition: DataSourceTvTropesTags,
      updateIntervalMinutes: 60 * 24 * 14,
      retryIntervalSeconds: 10,
      batchSize: 5,
      batchDelaySeconds: 5,
      rateLimitDelaySeconds: 60,
      usesExistingMedia: true,
    }
  }

  async fetchMovieData(mediaData: MediaData): Promise<TropesResult> {
    const { titles_pascal_cased, release_year } = mediaData
    if (!titles_pascal_cased) {
      return {}
    }
    const tropes = await this.getTropes('Film', titles_pascal_cased, release_year)
    return {
      mediaData,
      tropes,
    }
  }

  async fetchTvData(mediaData: MediaData): Promise<TropesResult> {
    const { titles_pascal_cased, release_year } = mediaData
    if (!titles_pascal_cased) {
      return {}
    }
    const tropes = await this.getTropes('Series', titles_pascal_cased, release_year)
    return {
      mediaData,
      tropes,
    }
  }

  async storeMovieData(data: TropesResult): Promise<void> {
    await this.storeTropes(data)
  }

  async storeTvData(data: TropesResult): Promise<void> {
    await this.storeTropes(data)
  }

  async getTropes(type: TvTropesType, titles: string[], year?: number): Promise<Tropes> {
    // TODO title without prefix for series (https://tvtropes.org/pmwiki/pmwiki.php/Film/TheLionTheWitchAndTheWardrobe)
    // TODO title without The prefix (https://tvtropes.org/pmwiki/pmwiki.php/Film/Intouchables)
    const urls = titles.reduce<string[]>((result, title) => {
      return [
        ...result,
        `${this.mainUrl}/${type}/${title}${year}`,
        `${this.mainUrl}/${type}/${title}`,
        `${this.mainUrl}/Anime/${title}${year}`,
        `${this.mainUrl}/Anime/${title}`,
        `${this.mainUrl}/WesternAnimation/${title}${year}`,
        `${this.mainUrl}/WesternAnimation/${title}`,
      ]
    }, [])
    const { url, response } = await tryRequests(urls, {
      ...userAgentHeader,
      responseEncoding: 'binary',
    })
    if (!url || !response) {
      console.log(`\tno tropes URL found for: ${titles[0]}`)
      return {}
    }

    // const html = response.data.toString('latin1')
    const html = response.data
    // const $ = cheerio.load(html, { decodeEntities: true })
    const $ = cheerio.load(html)

    const names: string[] = []
    const values: Record<string, string> = {}

    // TODO check for trope subpages: https://tvtropes.org/pmwiki/pmwiki.php/Film/TheAvengers2012

    const tropesList = $('.folder > ul > li, h2:contains("examples") + ul > li')
    tropesList.each((index, tropeItem) => {
      const tropeName = $(tropeItem).find('a:first').text().replace(/[^a-zA-Z0-9'!?,\- ]/g, "-")
      const tropeValue = $(tropeItem).text()

      names.push(tropeName)
      values[tropeName] = tropeValue
    })

    return {
      url,
      names,
      values,
    }
  }

  async storeTropes(data: TropesResult): Promise<BulkUpsertResult | undefined> {
    if (!data.mediaData || !data.tropes?.url || !data.tropes.names?.length) return

    const tagsData = {
      tags_provider: new Array(data.tropes.names.length).fill('tv_tropes'),
      name: data.tropes.names,
    }
    try {
      const tagsResult = await bulkUpsertData(
        'tags',
        tagsData,
        {},
        ['tags_provider', 'name'],
        ['id', 'name'],
      )

      const tagIds = (tagsResult?.all || []).map((row) => row.id)
      const tagNames = (tagsResult?.all || []).map((row) => row.name)
      const newTagNames = (tagsResult?.inserted || []).map((row) => row.name)
      if (newTagNames.length) {
        console.log(`\tNew Tropes added: ${newTagNames.join(', ')}`)
      }

      const filteredNames = data.tropes.names.filter((name) => tagNames.includes(name))
      const mediaTagsData = {
        media_id: new Array(tagIds.length).fill(data.mediaData.id),
        tag_id: tagIds,
        url: new Array(tagIds.length).fill(data.tropes.url),
        content: filteredNames.map((name) => data.tropes?.values?.[name]),
      }

      try {
        const result = await bulkUpsertData(
          'media_tags',
          mediaTagsData,
          {},
          ['media_id', 'tag_id'],
          ['media_id', 'tag_id'],
        )
        console.log(`TV Tropes: ${filteredNames.slice(0, 3).join(', ')}, ... (${data.tropes.url})`)
        return result
      } catch (error) {
        console.error(error)
      }
    } catch (error) {
      console.error(error)
    }
  }
}