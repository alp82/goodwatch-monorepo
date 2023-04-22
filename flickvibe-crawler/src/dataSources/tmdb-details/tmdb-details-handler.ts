import axios from 'axios'

import { bulkUpsertData, BulkUpsertResult, performTransaction, pool, upsertData } from '../../db/db'
import { toDashed, toPascalCase, tryRequests } from '../../utils/helpers'
import {
  AlternativeTitle,
  CastMovie,
  CastTv, CrewMovie, CrewTv,
  Genre,
  TMDBCollection,
  TMDBMovieDetails,
  TMDBTvDetails,
} from '../../types/details.types'
import { userAgentHeader } from '../../utils/user-agent'
import { QueryResult } from 'pg'

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
        `&append_to_response=aggregate_credits,alternative_titles,content_ratings,external_ids,images,keywords,recommendations,similar,translations,videos,watch/providers`
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
        console.log(`Movie: ${details.title} (${details.year})`)
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

      number_of_seasons: details.number_of_seasons || 1,
      number_of_episodes: details.number_of_episodes || 1,
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
      console.log(`TV: ${details.name} (${details.year})`)
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
      try {
        const partsResult = await pool.query(query, [collectionId, mediaIds])
        if (partsResult?.rows.length) {
          console.log(`\tCollection '${collection.name}' added with ${partsResult?.rows.length} movies`)
        }
        return { rows: partsResult?.rows, collection }
      } catch (error) {
        console.error(error)
      }
    } catch (error) {
        console.error(error)
    }
}

export const saveTMDBGenres = async (mediaId?: number, genres?: Genre[]): Promise<BulkUpsertResult | undefined> => {
    if (!mediaId || !genres?.length) return

    const genresData = {
      name: genres.map((genre) => genre.name)
    }
    try {
      const genresResult = await bulkUpsertData(
        'genres',
        genresData,
        ['name'],
        ['id', 'name'],
      )
      const genreIds = (genresResult?.all || []).map((row) => row.id)
      const newGenreNames = (genresResult?.inserted || []).map((row) => row.name)
      if (newGenreNames.length) {
        console.log(`\tNew Genres added: ${newGenreNames.join(', ')}`)
      }

      const mediaGenresData = {
        media_id: new Array(genreIds.length).fill(mediaId),
        genre_id: genreIds,
      }
      try {
        return await bulkUpsertData(
          'media_genres',
          mediaGenresData,
          ['media_id', 'genre_id'],
          ['media_id', 'genre_id'],
        )
      } catch (error) {
        console.error(error)
      }
    } catch (error) {
      console.error(error)
    }
}

export const saveTMDBAlternativeTitles = async (mediaId?: number, alternativeTitles?: AlternativeTitle[]): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !alternativeTitles?.length) return

  const languageCodes = alternativeTitles
    .filter((alternativeTitle) => {
      return ![
        'South America',
      ].includes(alternativeTitle.iso_3166_1)
    })
    .map((alternativeTitle) => {
      return alternativeTitle.iso_3166_1
        .replace('United Arab Emirates', 'AE')
        .replace('Bulgaria', 'BG')
        .replace('Česko', 'CZ')
        .replace('Deutschland', 'DE')
        .replace('España', 'ES')
        .replace('ኢትዮጵያ', 'ET')
        .replace('Suomi', 'FI')
        .replace('France', 'FR')
        .replace('ישראל', 'IL')
        .replace('Magyarország', 'HU')
        .replace('japan', 'JP')
        .replace('Japan', 'JP')
        .replace('Latvia', 'LV')
        .replace('Thailand', 'TH')
        .replace('Türkei', 'TR')
        .replace('United States', 'US')
        .replace('Oʻzbekiston', 'UZ')
    })
    .filter((alternativeTitle, index, all) => {
      return all.indexOf(alternativeTitle) === index
    })
  const mediaAlternativeTitlesData = {
    media_id: new Array(alternativeTitles.length).fill(mediaId),
    title: alternativeTitles.map((alternativeTitle) => alternativeTitle.title),
    type: alternativeTitles.map((alternativeTitle) => alternativeTitle.type),
    language_code: languageCodes,
  }
  try {
    return await bulkUpsertData(
      'media_alternative_titles',
      mediaAlternativeTitlesData,
      ['media_id', 'title', 'type', 'language_code'],
      ['media_id', 'title', 'type', 'language_code'],
    )
  } catch (error) {
    console.error(error)
  }
}

export const saveTMDBCast = async (mediaId?: number, cast?: (CastMovie | CastTv)[]): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !cast?.length) return

  const castWithoutDuplicates = cast.filter((person, index, self) => {
    return index === self.findIndex((p) => p.id === person.id)
  })

  const peopleData = {
    tmdb_id: castWithoutDuplicates.map((person) => person.id),
    name: castWithoutDuplicates.map((person) => person.name),
    popularity: castWithoutDuplicates.map((person) => person.popularity),
    gender: castWithoutDuplicates.map((person) => convertTMDBGenderId(person.gender)),
    known_for_department: castWithoutDuplicates.map((person) => person.known_for_department),
    profile_path: castWithoutDuplicates.map((person) => person.profile_path),
    adult: castWithoutDuplicates.map((person) => person.adult),
  }
  try {
    const peopleResult = await bulkUpsertData(
      'people',
      peopleData,
      ['tmdb_id'],
      ['id', 'tmdb_id', 'name'],
    )
    const peopleIds = (peopleResult?.all || []).map((row) => row.id)
    const peopleTmdbIds = (peopleResult?.all || []).map((row) => row.tmdb_id)
    const newPeopleNames = (peopleResult?.inserted || []).map((row) => row.name)
    if (newPeopleNames.length) {
      console.log(`\tNew People added: ${newPeopleNames.join(', ')}`)
    }

    const filteredCast = castWithoutDuplicates.filter((person) => peopleTmdbIds.includes(person.id))
    const mediaCastData = {
      media_id: new Array(peopleIds.length).fill(mediaId),
      person_id: peopleIds,
      // TODO save all roles:
      //  movie: duplicate tmdb_id's in cast with different character names
      //  tv: multiple roles in cast
      character_name: filteredCast.map((person) => (person as CastMovie).character || (person as CastTv).roles?.[0]?.character),
      episode_count: filteredCast.map((person) => (person as CastTv).total_episode_count || 0),
      display_priority: filteredCast.map((person) => person.order),
    }
    try {
      return await bulkUpsertData(
        'media_cast',
        mediaCastData,
        ['media_id', 'person_id'],
        ['media_id', 'person_id'],
      )
    } catch (error) {
      console.error(error)
    }
  } catch (error) {
    console.error(error)
  }
}

export const saveTMDBCrew = async (mediaId?: number, crew?: (CrewMovie | CrewTv)[]): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !crew?.length) return

  const crewWithoutDuplicates = crew.filter((person, index, self) => {
    return index === self.findIndex((p) => p.id === person.id)
  })

  const peopleData = {
    tmdb_id: crewWithoutDuplicates.map((person) => person.id),
    name: crewWithoutDuplicates.map((person) => person.name),
    popularity: crewWithoutDuplicates.map((person) => person.popularity),
    gender: crewWithoutDuplicates.map((person) => convertTMDBGenderId(person.gender)),
    known_for_department: crewWithoutDuplicates.map((person) => person.known_for_department),
    profile_path: crewWithoutDuplicates.map((person) => person.profile_path),
    adult: crewWithoutDuplicates.map((person) => person.adult),
  }
  try {
    const peopleResult = await bulkUpsertData(
      'people',
      peopleData,
      ['tmdb_id'],
      ['id', 'tmdb_id', 'name'],
    )
    const peopleIds = (peopleResult?.all || []).map((row) => row.id)
    const peopleTmdbIds = (peopleResult?.all || []).map((row) => row.tmdb_id)
    const newPeopleNames = (peopleResult?.inserted || []).map((row) => row.name)
    if (newPeopleNames.length) {
      console.log(`\tNew People added: ${newPeopleNames.join(', ')}`)
    }

    const filteredCrew = crewWithoutDuplicates.filter((person) => peopleTmdbIds.includes(person.id))
    const mediaCrewData = {
      media_id: new Array(peopleIds.length).fill(mediaId),
      person_id: peopleIds,
      // TODO save all jobs:
      //  movie: duplicate tmdb_id's in crew with different jobs
      //  tv: multiple jobs in crew
      job: filteredCrew.map((person) => (person as CrewMovie).job || (person as CrewTv).jobs?.[0]?.job),
      department: filteredCrew.map((person) => person.department),
      episode_count: filteredCrew.map((person) => (person as CrewTv).total_episode_count || 0),
      display_priority: filteredCrew.map((person) => person.popularity),
    }
    try {
      return await bulkUpsertData(
        'media_crew',
        mediaCrewData,
        ['media_id', 'person_id'],
        ['media_id', 'person_id'],
      )
    } catch (error) {
      console.error(error)
    }
  } catch (error) {
    console.error(error)
  }
}

const convertTMDBGenderId = (genderId: number): string => {
  if (genderId === 1) {
    return 'Female'
  } else if (genderId === 2) {
    return 'Male'
  } else if (genderId === 3) {
    return 'Non-binary'
  } else {
    return 'Not specified'
  }
}