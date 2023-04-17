import axios from 'axios'

import {pool, upsertData} from '../../db/db'
import {toDashed, toPascalCase, tryRequests} from '../../utils/helpers'
import {
  AlternativeTitle,
  AlternativeTitlesMovie,
  Genre,
  Part,
  TMDBCollection,
  TMDBMovieDetails,
  TMDBTvDetails
} from '../../types/details.types'
import {userAgentHeader} from "../../utils/user-agent";

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

export const getTMDBMovieDetails = async (movieId: number): Promise<TMDBMovieDetails> => {
    const url = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_API_KEY}` +
        `&append_to_response=alternative_titles,credits,images,keywords,recommendations,release_dates,similar,translations,videos,watch/providers`
    const result = await axios.get(url)
    const { data } = result

    const alternative_titles = filterAlternativeTitles(data.alternative_titles.titles)
    const { titles_dashed, titles_underscored, titles_pascal_cased } = extractTitles([
        data.title,
        ...alternative_titles,
    ])
    const year = data?.release_date?.split('-')?.[0] || null

    const details: TMDBMovieDetails = {
        ...data,
        keywords: {
            results: data.keywords.keywords,
        },
        titles_dashed,
        titles_underscored,
        titles_pascal_cased,
        release_date: data.release_date || null,
        year,
    }

    return details
}

export const getTMDBTvDetails = async (tvId: number): Promise<TMDBTvDetails> => {
    const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${process.env.TMDB_API_KEY}` +
        `&append_to_response=aggregate_credits,alternative_titles,content_ratings,credits,external_ids,images,keywords,recommendations,similar,translations,videos,watch/providers`
    const result = await axios.get(url)
    const { data } = result

    const alternative_titles = filterAlternativeTitles(data.alternative_titles.results)
    const { titles_dashed, titles_underscored, titles_pascal_cased } = extractTitles([
        data.name,
        ...alternative_titles,
    ])
    const year = data?.first_air_date?.split('-')?.[0] || null

    const details: TMDBTvDetails = {
        ...data,
        titles_dashed,
        titles_underscored,
        titles_pascal_cased,
        first_air_date: data.first_air_date || null,
        year,
    }

    return details
}

export const getTMDBMovieCollection = async (collectionId: number): Promise<TMDBCollection | undefined> => {
    const urls = [
        `https://api.themoviedb.org/3/collection/${collectionId}?api_key=${process.env.TMDB_API_KEY}`
    ]
    const result = await tryRequests(urls, userAgentHeader)
    if (result.response) {
        return result.response.data as TMDBCollection
    }
}

export const saveTMDBMovie = async (details: TMDBMovieDetails): Promise<number | undefined> => {
    const tableName = 'movies'
    const mediaTypeId = 1
    const data = {
        tmdb_id: details.id,
        media_type_id: mediaTypeId,
        title: details.title,
        synopsis: details.overview,
        tagline: details.tagline,
        release_date: details.release_date,
        release_year: details.year,
        popularity: details.popularity,
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,
        status: details.status,
        original_title: details.original_title,
        original_language_code: details.original_language,
        homepage: details.homepage,
        adult: details.adult,
        runtime: details.runtime,
        budget: details.budget,
        revenue: details.revenue,
        imdb_id: details.imdb_id,
        wikidata_id: details.external_ids?.wikidata_id,
        facebook_id: details.external_ids?.facebook_id,
        instagram_id: details.external_ids?.instagram_id,
        twitter_id: details.external_ids?.twitter_id,
    }
    try {
        const result = await upsertData(tableName, data, ['tmdb_id', 'media_type_id'], ['id'])
        const mediaId = result?.rows?.[0]?.id
        console.log(`Movie: ${details.title} (ID: ${mediaId})`)
        return mediaId
    } catch (error) {
        console.error(error)
    }
}

export const saveTMDBTv = async (details: TMDBTvDetails): Promise<number | undefined> => {
    const tableName = 'tv'
    const mediaTypeId = 2
    const data = {
      tmdb_id: details.id,
      media_type_id: mediaTypeId,
      title: details.name,
      synopsis: details.overview,
      tagline: details.tagline,
      release_date: details.first_air_date,
      release_year: details.year,
      popularity: details.popularity,
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      status: details.status,
      original_title: details.original_name,
      original_language_code: details.original_language,
      homepage: details.homepage,
      adult: details.adult,

      number_of_seasons: details.number_of_seasons,
      number_of_episodes: details.number_of_episodes,
      episode_runtime: details.episode_run_time,
      in_production: details.in_production,
      tv_type: details.type,
      last_air_date: details.last_air_date,
      origin_country_code: details.origin_country,
      // created_by: created_by_id,

      imdb_id: details.external_ids?.imdb_id,
      freebase_mid: details.external_ids?.freebase_mid,
      freebase_id: details.external_ids?.freebase_id,
      tvdb_id: details.external_ids?.tvdb_id,
      tvrage_id: details.external_ids?.tvrage_id,
      wikidata_id: details.external_ids?.wikidata_id,
      facebook_id: details.external_ids?.facebook_id,
      instagram_id: details.external_ids?.instagram_id,
      twitter_id: details.external_ids?.twitter_id,
    }
    try {
      const result = await upsertData(tableName, data, ['tmdb_id', 'media_type_id'], ['id'])
      const mediaId = result?.rows?.[0]?.id
      console.log(`TV: ${details.name} (ID: ${mediaId})`)
      return mediaId
    } catch (error) {
      console.error(error)
    }
}

export const saveTMDBCollection = async (mediaId?: number, collection?: TMDBCollection): Promise<{ rows: { media_id: number, collection_id: number}[], collection: TMDBCollection | undefined } | undefined> => {
    if (!mediaId || !collection) return

    const data = {
        name: collection.name,
        overview: collection.overview,
        poster_path: collection.poster_path,
        backdrop_path: collection.backdrop_path,
    }
    try {
      const collectionResult = await upsertData('collections', data, ['name'], ['id'])
      const collectionId = collectionResult?.rows?.[0]?.id

      const query = `
        INSERT INTO media_collections (media_id, collection_id)
        SELECT id, $1
        FROM unnest($2::integer[]) AS parts(id)
        ON CONFLICT (media_id, collection_id) DO NOTHING
        RETURNING media_id, collection_id
      `
      const mediaIds = collection.parts.map((part) => part.id)
      const partsResult = await pool.query(query, [collectionId, mediaIds])
      if (partsResult?.rows.length) {
        console.log(`\tCollection '${collection.name}' added with ${partsResult?.rows.length} movies`)
      }
      return { rows: partsResult?.rows, collection }
    } catch (error) {
        console.error(error)
    }
}

export const saveTMDBGenres = async (mediaId?: number, genres?: Genre[]): Promise<string[] | undefined> => {
    if (!mediaId || !genres?.length) return

    try {
      const queryGenres = `
        INSERT INTO genres (name)
        SELECT name
        FROM unnest($1::text[]) AS genreNames(name)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name
      `
      const genresResult = await pool.query(queryGenres, [genres.map((genre) => genre.name)])
      const genreIds = (genresResult?.rows || []).map((row) => row.id)
      const genreNames = (genresResult?.rows || []).map((row) => row.name)

      try {
        const queryMediaGenres = `
          INSERT INTO media_genres (media_id, genre_id)
          SELECT $1, id
          FROM unnest($2::integer[]) AS parts(id)
          ON CONFLICT (media_id, genre_id) DO NOTHING
          RETURNING media_id, genre_id;
        `
        const mediaGenresResult = await pool.query(queryMediaGenres, [mediaId, genreIds])
        // TODO use actual results instead of passed genre names
        if (genreNames.length) {
          console.log(`\tGenres added: ${genreNames.join(', ')}`)
        }
        return genreNames
      } catch (error) {
        console.error(error)
      }
    } catch (error) {
      console.error(error)
    }
}

export const saveTMDBAlternativeTitles = async (mediaId?: number, alternativeTitles?: AlternativeTitle[]): Promise<string[] | undefined> => {
  if (!mediaId || !alternativeTitles?.length) return

  try {
    const query = `
      INSERT INTO media_alternative_titles (media_id, title, type, language_code)
      SELECT $1, title, type, language_code
      FROM unnest($2::text[], $3::text[], $4::text[]) AS alt(title, type, language_code)
      ON CONFLICT (media_id, title, type, language_code) DO NOTHING
      RETURNING media_id, title, type, language_code
    `
    const titles = alternativeTitles.map((alternativeTitle) => alternativeTitle.title)
    const types = alternativeTitles.map((alternativeTitle) => alternativeTitle.type)
    const languageCodes = alternativeTitles.map((alternativeTitle) => alternativeTitle.iso_3166_1)
    const result = await pool.query(query, [mediaId, titles, types, languageCodes])
    return result.rows || []
  } catch (error) {
    console.error(error)
  }
}
