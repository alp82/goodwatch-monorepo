import { MovieDetails, TvDetails } from '../types/details.types'
import axios from 'axios'
import { userAgentHeader } from '../utils/user-agent'
import cheerio from 'cheerio'
import { tryRequests } from '../utils/helpers'

type Type = 'Film' | 'Series'

export interface Tropes {
  url?: string
  names?: string[]
  values?: Record<string, string>
}

const mainUrl = 'https://tvtropes.org/pmwiki/pmwiki.php'

const getTropes = async (type: Type, titles: string[], year: string): Promise<Tropes> => {
  // TODO title without prefix for series (https://tvtropes.org/pmwiki/pmwiki.php/Film/TheLionTheWitchAndTheWardrobe)
  // TODO title without The prefix (https://tvtropes.org/pmwiki/pmwiki.php/Film/Intouchables)
  const urls = titles.reduce<string[]>((result, title) => {
    return [
      ...result,
      `${mainUrl}/${type}/${title}${year}`,
      `${mainUrl}/${type}/${title}`,
      `${mainUrl}/Anime/${title}${year}`,
      `${mainUrl}/Anime/${title}`,
      `${mainUrl}/WesternAnimation/${title}${year}`,
      `${mainUrl}/WesternAnimation/${title}`,
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

export const getTropesForMovie = async (movieDetails: MovieDetails): Promise<Tropes> => {
  const { titles_pascal_cased, year } = movieDetails
  return {}
  // return getTropes('Film', titles_pascal_cased, year)
}

export const getTropesForTv = async (tvDetails: TvDetails): Promise<Tropes> => {
  const { titles_pascal_cased, year } = tvDetails
  return {}
  // return getTropes('Series', titles_pascal_cased, year)
}
