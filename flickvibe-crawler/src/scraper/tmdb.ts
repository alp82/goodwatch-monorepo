import axios from 'axios'

import { upsertJson } from '../db/db'
import {toDashed, toPascalCase, tryRequests} from '../utils/helpers'
import {AlternativeTitle, BelongsToCollection, MovieDetails, TvDetails} from '../types/details.types'
import {userAgentHeader} from "../utils/user-agent";

interface ExtractedTitles {
  titles_dashed: string[]
  titles_underscored: string[]
  titles_pascal_cased: string[]
}

const filterAlternativeTitles = (titles: AlternativeTitle[]): string[] => {
  return titles.filter((title) => {
    return ['modern title', 'Short Title', 'English title'].includes(title.type) || ['US'].includes(title.iso_3166_1)
  }).map((title) => title.title)
}

export const extractTitles = (titles: string[]): ExtractedTitles => {
  return titles.reduce<ExtractedTitles>((result, title) => {
    const title_dashed = toDashed(title)
    const title_underscored = title_dashed.replace(/-/g, '_')
    const title_pascal_cased = toPascalCase(title_dashed)

    return {
      titles_dashed: [
        ...result.titles_dashed,
        title_dashed,
      ],
      titles_underscored: [
        ...result.titles_underscored,
        title_underscored,
      ],
      titles_pascal_cased: [
        ...result.titles_pascal_cased,
        title_pascal_cased,
      ],
    }
  }, {
    titles_dashed: [],
    titles_underscored: [],
    titles_pascal_cased: [],
  })
}

export const getTMDBMovieDetails = async (movieId: number): Promise<MovieDetails> => {
  const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_API_KEY}` +
    `&append_to_response=alternative_titles,credits,images,keywords,recommendations,release_dates,similar,translations,videos,watch/providers`
  const result = await axios.get(url)
  const { data } = result

  const alternative_titles = filterAlternativeTitles(data.alternative_titles.titles)
  const { titles_dashed, titles_underscored, titles_pascal_cased } = extractTitles([
    data.title,
    ...alternative_titles,
  ])
  const year = data?.release_date?.split('-')?.[0] || '0'

  const details: MovieDetails = {
    ...data,
    keywords: {
      results: data.keywords.keywords,
    },
    titles_dashed,
    titles_underscored,
    titles_pascal_cased,
    year,
  }

  if (details.belongs_to_collection) {
    const urls = [
      `https://api.themoviedb.org/3/collection/${details.belongs_to_collection.id}?api_key=${process.env.TMDB_API_KEY}`
    ]
    const result = await tryRequests(urls, userAgentHeader)
    if (result.response) {
      const collection = result.response as unknown as BelongsToCollection
      // TODO we can remove this and then use joins instead
      details.belongs_to_collection = collection
      upsertJson('collection', collection)
    }

  }

  return details
}

export const getTMDBTvDetails = async (tvId: number): Promise<TvDetails> => {
  const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${process.env.TMDB_API_KEY}` +
    `&append_to_response=aggregate_credits,alternative_titles,content_ratings,credits,external_ids,images,keywords,recommendations,similar,translations,videos,watch/providers`
  const result = await axios.get(url)
  const { data } = result

  const alternative_titles = filterAlternativeTitles(data.alternative_titles.results)
  const { titles_dashed, titles_underscored, titles_pascal_cased } = extractTitles([
    data.name,
    ...alternative_titles,
  ])
  const year = data?.first_air_date?.split('-')?.[0] || '0'

  const details: TvDetails = {
    ...data,
    titles_dashed,
    titles_underscored,
    titles_pascal_cased,
    year,
  }

  return details
}