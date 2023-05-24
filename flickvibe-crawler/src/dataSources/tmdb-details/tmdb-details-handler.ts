import axios from 'axios'
import { getAlpha2Code, getSupportedLanguages } from 'i18n-iso-countries'

import { bulkUpsertData, BulkUpsertResult, performTransaction, pool, upsertData } from '../../db/db'
import { toDashed, toPascalCase, tryRequests } from '../../utils/helpers'
import {
  AlternativeTitle,
  CastMovie,
  CastTv,
  ContentRatingResult,
  CrewMovie,
  CrewTv,
  Genre,
  Image,
  Images,
  Keywords,
  Network,
  ProductionCompany,
  Provider,
  ProviderData,
  Recommendations,
  ReleaseDatesResult, Season,
  TMDBCollection,
  TMDBMovieDetails,
  TMDBTvDetails,
  Translations,
  Videos,
  WatchProviders,
} from '../../types/details.types'
import { userAgentHeader } from '../../utils/user-agent'
import { QueryResult } from 'pg'
import fs from 'fs'

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
    const extractedTitles = titles.reduce<ExtractedTitles>((result, title) => {
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
    return {
      titles_dashed: [...new Set(extractedTitles.titles_dashed)],
      titles_underscored: [...new Set(extractedTitles.titles_underscored)],
      titles_pascal_cased: [...new Set(extractedTitles.titles_pascal_cased)],
    }
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
        status: details.status,
        poster_path: details.poster_path,
        backdrop_path: details.backdrop_path,

        titles_dashed: details.titles_dashed,
        titles_underscored: details.titles_underscored,
        titles_pascal_cased: details.titles_pascal_cased,
        original_title: details.original_title,
        original_language_code: details.original_language,
        spoken_language_codes: details.spoken_languages.map((language) => language.iso_639_1),
        production_country_codes: details.production_countries.map((country) => country.iso_3166_1),
        homepage: details.homepage,
        adult: details.adult || false,
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

      titles_dashed: details.titles_dashed,
      titles_underscored: details.titles_underscored,
      titles_pascal_cased: details.titles_pascal_cased,
      original_title: details.original_name,
      original_language_code: details.original_language,
      spoken_language_codes: details.spoken_languages.map((language) => language.iso_639_1),
      language_codes: details.languages.map((language) => language),
      production_country_codes: details.production_countries.map((country) => country.iso_3166_1),
      homepage: details.homepage,
      adult: details.adult || false,

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
        // console.log('\tCOLLECTION')
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
        {},
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
        const result = await bulkUpsertData(
          'media_genres',
          mediaGenresData,
          {},
          ['media_id', 'genre_id'],
          ['media_id', 'genre_id'],
        )
        // console.log('\tGENRES')
        return result
      } catch (error) {
        console.error(error)
      }
    } catch (error) {
      console.error(error)
    }
}

export const saveTMDBKeywords = async (mediaId?: number, keywords?: Keywords, type?: 'movie' | 'tv', tmdbId?: number): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !keywords?.results?.length) return

  const url = `https://www.themoviedb.org/${type}/${tmdbId}`
  const tagsData = {
    tags_provider: new Array(keywords.results.length).fill('tmdb'),
    name: keywords.results.map((keyword) => keyword.name),
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
      console.log(`\tNew Keywords added: ${newTagNames.join(', ')}`)
    }

    const mediaTagsData = {
      media_id: new Array(tagIds.length).fill(mediaId),
      tag_id: tagIds,
      url: new Array(tagIds.length).fill(url),
    }

    try {
      const result = await bulkUpsertData(
        'media_tags',
        mediaTagsData,
        {},
        ['media_id', 'tag_id'],
        ['media_id', 'tag_id'],
      )
      console.log(`TMDB Keywords: ${tagNames.slice(0, 3).join(', ')}, ... (${url})`)
      return result
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
    .map((alternativeTitle) => {
      return convertCountryNameToCode(alternativeTitle.iso_3166_1)
    })
    .filter((alternativeTitle, index, all) => {
      return all.indexOf(alternativeTitle) === index && alternativeTitle && alternativeTitle.length == 2
    })
  const mediaAlternativeTitlesData = {
    media_id: new Array(alternativeTitles.length).fill(mediaId),
    title: alternativeTitles.map((alternativeTitle) => alternativeTitle.title),
    type: alternativeTitles.map((alternativeTitle) => alternativeTitle.type),
    language_code: languageCodes,
  }
  try {
    const result = await bulkUpsertData(
      'media_alternative_titles',
      mediaAlternativeTitlesData,
      {},
      ['media_id', 'title', 'type', 'language_code'],
      ['media_id', 'title', 'type', 'language_code'],
    )
    // console.log('\tALT TITLES')
    return result
  } catch (error) {
    console.error(error)
  }
}

export const convertCountryNameToCode = (country: string | null): string => {
  if (!country) return ''
  if (country.length == 2) return country

  const languages = getSupportedLanguages()
  for (const language of languages) {
    const countryCode = getAlpha2Code(country, language)
    if (countryCode) {
      return countryCode
    }
  }

  return ''
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
      {},
      ['tmdb_id'],
      ['id', 'tmdb_id', 'name'],
    )
    const peopleIds = (peopleResult?.all || []).map((row) => row.id)
    const peopleTmdbIds = (peopleResult?.all || []).map((row) => row.tmdb_id)
    const newPeopleNames = (peopleResult?.inserted || []).map((row) => row.name)
    if (newPeopleNames.length) {
      // console.log(`\tNew People added: ${newPeopleNames.join(', ')}`)
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
      const result = await bulkUpsertData(
        'media_cast',
        mediaCastData,
        {},
        ['media_id', 'person_id'],
        ['media_id', 'person_id'],
      )
      // console.log('\tCAST')
      return result
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
      {},
      ['tmdb_id'],
      ['id', 'tmdb_id', 'name'],
    )
    const peopleIds = (peopleResult?.all || []).map((row) => row.id)
    const peopleTmdbIds = (peopleResult?.all || []).map((row) => row.tmdb_id)
    const newPeopleNames = (peopleResult?.inserted || []).map((row) => row.name)
    if (newPeopleNames.length) {
      // console.log(`\tNew People added: ${newPeopleNames.join(', ')}`)
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
      const result = await bulkUpsertData(
        'media_crew',
        mediaCrewData,
        {},
        ['media_id', 'person_id'],
        ['media_id', 'person_id'],
      )
      // console.log('\tCREW')
      return result
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

export interface CertificationData {
  certification?: string
  country_code: string
  language_code?: string
  release_type?: string
  release_date?: Date
  note?: string
}

export const saveTMDBCertifications = async (mediaId?: number, certifications?: (ReleaseDatesResult | ContentRatingResult)[]): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !certifications?.length) return

  const certificationData = certifications.reduce<CertificationData[]>((result, certification) => {
    if ((certification as ReleaseDatesResult).release_dates?.length) {
      const c = (certification as ReleaseDatesResult)
      return [...result, ...c.release_dates.map(releaseDate => ({
        certification: releaseDate.certification,
        country_code: convertCountryNameToCode(c.iso_3166_1),
        language_code: releaseDate.iso_639_1.iso_639_1,
        release_type: convertTMDBReleaseTypeId(releaseDate.type),
        release_date: releaseDate.release_date || null,
        note: releaseDate.note,
      }))]
    } else if ((certification as ContentRatingResult).rating) {
      const c = (certification as ContentRatingResult)
      return [...result, {
        certification: c.rating,
        country_code: convertCountryNameToCode(c.iso_3166_1),
      }]
    }
    return [...result]
  }, [])

  const mediaCertificationsData = {
    media_id: new Array(certificationData.length).fill(mediaId),
    certification: certificationData.map((certification) => convertCertificationRating(certification.certification)),
    country_code: certificationData.map((certification) => certification.country_code),
    language_code: certificationData.map((certification) => certification.language_code),
    release_type: certificationData.map((certification) => certification.release_type),
    release_date: certificationData.map((certification) => certification.release_date),
    note: certificationData.map((certification) => certification.note),
  }
  try {
    const result = await bulkUpsertData(
      'media_certifications',
      mediaCertificationsData,
      { release_date: 'date' },
      ['media_id', 'certification', 'country_code', 'language_code', 'release_type'],
      ['media_id', 'certification', 'country_code', 'language_code', 'release_type'],
    )
    // console.log('\tCERTIFICATIONS')
    return result
  } catch (error) {
    console.error(error)
  }
}

const convertTMDBReleaseTypeId = (releaseTypeId: number): string => {
  if (releaseTypeId === 1) {
    return 'Premiere'
  } else if (releaseTypeId === 2) {
    return 'Theatrical (limited)'
  } else if (releaseTypeId === 3) {
    return 'Theatrical'
  } else if (releaseTypeId === 4) {
    return 'Digital'
  } else if (releaseTypeId === 5) {
    return 'Physical'
  } else if (releaseTypeId === 6) {
    return 'TV'
  } else {
    return 'Not specified'
  }
}

const convertCertificationRating = (tmdbInput: string | undefined) => {
  /**
   * TMDb certification ratings need some cleaning because they can contain non-standardized values
   */
  if (!tmdbInput) return 'GA'

  const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const conversionMap = [
    // general audience / unrestricted
    { input: ' ', output: 'GA' },
    { input: 'Genel İzleyici', output: 'GA' },
    { input: 'Mládeži přistupný', output: 'GA' },
    { input: '전체관람가', output: 'GA' },
    { input: '普遍級', output: 'GA' },
    { input: '전체', output: 'GA' },
    { input: ' ท ทั่วไป ', output: 'GA' },
    { input: 'ท', output: 'GA' },
    { input: 'הותר לכל הגילאים', output: 'GA' },
    { input: 'Unrestricted', output: 'GA' },

    // invalid data
    { input: 'Vertical Entertainment', output: '' },
    { input: 'How to train your dragon: homecoming', output: '' },

    // restricted
    { input: '保護級', output: 'PG' },

    // wrong case
    ...[...Array(22).keys()].map((num => ( { input: `pg-${num.toString()}`, output: `PG-${num.toString()}` }))),

    // prefixes or suffixes
    ...letters.map((letter => ( { input: `เรท ${letter}`, output: letter }))),
    ...[...Array(22).keys()].map((num => ( { input: `輔${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `ฉ${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `น ${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `SAM ${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `Category ${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `I.M. - ${num.toString()}`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `${num.toString()} anos`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `${num.toString()}세 이상 관람가`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `${num.toString()}세관람가(청소년관람불가)`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `${num.toString()} éven aluliak számára nem ajánlott`, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `od ${num.toString()} lat `, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: `Från ${num.toString()} år `, output: num.toString() }))),
    ...[...Array(22).keys()].map((num => ( { input: ` ומעלה${num.toString()}הותר לבני `, output: num.toString() }))),

    // correct syntax
    // { input: 'PG', output: 'PG' },
    // { input: 'TV-PG', output: 'TV-PG' },
    // ...letters.map((letter => ( { input: letter, output: letter }))),
    // ...[...Array(22).keys()].map((num => ( { input: num.toString(), output: num.toString() }))),
    // ...[...Array(22).keys()].map((num => ( { input: `${num.toString()}A`, output: `${num.toString()}A` }))),
    // ...[...Array(22).keys()].map((num => ( { input: `${num.toString()}+`, output: `${num.toString()}+` }))),
    // ...[...Array(22).keys()].map((num => ( { input: `+${num.toString()}`, output: `+${num.toString()}` }))),
    // ...[...Array(22).keys()].map((num => ( { input: `B${num.toString()}`, output: `B${num.toString()}` }))),
    // ...[...Array(22).keys()].map((num => ( { input: `K-${num.toString()}`, output: `K-${num.toString()}` }))),
    // ...[...Array(22).keys()].map((num => ( { input: `PG-${num.toString()}`, output: `PG-${num.toString()}` }))),
    // ...[...Array(22).keys()].map((num => ( { input: `R-${num.toString()}`, output: `R-${num.toString()}` }))),

    // multiple ratings
    // { input: 'NC16 (uncut) PG13 (edited)', output: 'NC16 (uncut) PG13 (edited)' },
  ]

  const standardizedInput = tmdbInput.trim().toLowerCase();

  for (const data of conversionMap) {
    const regex = new RegExp(`^${data.input.trim()}$`, 'i');
    if (regex.test(standardizedInput)) {
      return data.output;
    }
  }

  return tmdbInput.substring(0, 50)
}

export interface FlattenedProviderData {
  name: string
  type: string
  logo_path: string
  country_code: string
  display_priority: number
}

export const saveTMDBStreamingProviders = async (mediaId?: number, watchProviders?: WatchProviders): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !watchProviders?.results || !Object.keys(watchProviders.results).length) return

  const countryCodes = Object.keys(watchProviders.results)
  const flattenedProviders = countryCodes.reduce<FlattenedProviderData[]>((result, countryCode) => {
    const providerTypes = Object.keys(watchProviders.results[countryCode]);

    return result.concat(
      providerTypes.reduce((providers, type) => {
        if (Array.isArray(watchProviders.results[countryCode][type as keyof ProviderData])) {
          return providers.concat(
            (watchProviders.results[countryCode][type as keyof ProviderData] as Provider[]).map((provider) => ({
              name: provider.provider_name,
              type: type,
              logo_path: provider.logo_path,
              country_code: countryCode,
              display_priority: provider.display_priority,
            })) as []
          )
        }
        return providers
      }, [])
    )
  }, [])

  const uniqueProviders = flattenedProviders.filter((provider, index, providers) => {
    const providerName = provider.name;
    return providers.findIndex(p => p.name === providerName) === index;
  });

  const providersData = {
    name: uniqueProviders.map((provider) => provider.name),
    logo_path: uniqueProviders.map((provider) => provider.logo_path),
    display_priority: uniqueProviders.map((provider) => provider.display_priority),
  }

  try {
    const providersResult = await bulkUpsertData(
      'streaming_providers',
      providersData,
      {},
      ['name'],
      ['id', 'name'],
    )
    const providerNameToId = (providersResult?.all || []).reduce((result, row) => {
      return {
        ...result,
        [row.name as string]: row.id,
      }
    }, {})

    const mediaProvidersData = {
      media_id:  new Array(flattenedProviders.length).fill(mediaId),
      streaming_provider_id: flattenedProviders.map((provider) => providerNameToId[provider.name]),
      streaming_type: flattenedProviders.map((provider) => provider.type),
      country_code: flattenedProviders.map((provider) => provider.country_code),
    }

    try {
      const result = await bulkUpsertData(
        'media_streaming_providers',
        mediaProvidersData,
        {},
        ['media_id', 'streaming_provider_id', 'streaming_type', 'country_code'],
        ['media_id', 'streaming_provider_id', 'streaming_type', 'country_code'],
      )
      // console.log('\tSTREAMING')
      return result
    } catch (error) {
      console.error(error)
    }
  } catch (error) {
    console.error(error)
  }
}

export const saveTMDBMediaImages = async (mediaId?: number, images?: Images): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !images) return

  const imagesData: Record<string, unknown>[] = []
  Object.entries(images).forEach(([imageType, imageList]) => {
    imageList.forEach((image: Image) => {
      imagesData.push({
        media_id: mediaId,
        image_path: image.file_path,
        image_type: imageType,
        aspect_ratio: image.aspect_ratio,
        width: image.width,
        height: image.height,
        vote_average: image.vote_average,
        vote_count: image.vote_count,
        language_code: image.iso_639_1,
      })
    })
  })
  const mediaImagesData = Object.fromEntries(
    Object.keys(imagesData[0]).map((key) => [
      key,
      imagesData.map((imageData) => imageData[key]),
    ])
  );

  try {
    const result = await bulkUpsertData(
      'media_images',
      mediaImagesData,
      {},
      ['media_id', 'image_path'],
      ['media_id', 'image_path'],
    )
    // console.log('\tMEDIA IMAGES')
    return result
  } catch (error) {
    console.error(error)
  }
}

export const saveTMDBMediaVideos = async (mediaId?: number, videos?: Videos): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !videos) return

  const videosData = videos.results.map((video) => {
    return {
      media_id: mediaId,
      video_site_key: video.key,
      video_site: video.site,
      video_type: video.type,
      country_code: convertCountryNameToCode(video.iso_3166_1),
      language_code: video.iso_639_1,
      name: video.name,
      size: video.size,
      official: video.official,
      published_at: video.published_at,
    }
  })
  const mediaVideosData = Object.fromEntries(
    Object.keys(videosData[0]).map((key) => [
      key,
      videosData.map((videoData) => videoData[key as keyof typeof videoData]),
    ])
  );

  try {
    const result = await bulkUpsertData(
      'media_videos',
      mediaVideosData,
      {},
      ['media_id', 'video_site_key', 'video_site'],
      ['media_id', 'video_site_key', 'video_site'],
    )
    // console.log('\tMEDIA IMAGES')
    return result
  } catch (error) {
    console.error(error)
  }
}


export const saveTMDBProductionCompanies = async (mediaId?: number, productionCompanies?: ProductionCompany[]): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !productionCompanies?.length) return

  const companiesData = {
    name: productionCompanies.map((company) => company.name),
    logo_path: productionCompanies.map((company) => company.logo_path),
    origin_country_code: productionCompanies.map((company) => convertCountryNameToCode(company.origin_country)),
  }

  try {
    const companiesResult = await bulkUpsertData(
      'production_companies',
      companiesData,
      {},
      ['name'],
      ['id', 'name'],
    )
    const companyNameToId = (companiesResult?.all || []).reduce((result, row) => {
      return {
        ...result,
        [row.name as string]: row.id,
      }
    }, {})
    const companyIds = Object.keys(companyNameToId)

    const mediaCompaniesData = {
      media_id:  new Array(companyIds.length).fill(mediaId),
      production_company_id: companyIds.map((companyId) => companyNameToId[companyId]),
    }

    try {
      const result = await bulkUpsertData(
        'media_production_companies',
        mediaCompaniesData,
        {},
        ['media_id', 'production_company_id'],
        ['media_id', 'production_company_id'],
      )
      // console.log('\tPRODUCTION COMPANIES')
      return result
    } catch (error) {
      console.error(error)
    }
  } catch (error) {
    console.error(error)
  }
}

export const saveTMDBNetworks = async (mediaId?: number, networks?: Network[]): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !networks?.length) return

  const networksData = {
    name: networks.map((company) => company.name),
    logo_path: networks.map((company) => company.logo_path),
    origin_country_code: networks.map((company) => convertCountryNameToCode(company.origin_country)),
  }

  try {
    const networksResult = await bulkUpsertData(
      'networks',
      networksData,
      {},
      ['name'],
      ['id', 'name'],
    )
    const networkNameToId = (networksResult?.all || []).reduce((result, row) => {
      return {
        ...result,
        [row.name as string]: row.id,
      }
    }, {})
    const networkIds = Object.keys(networkNameToId)

    const mediaNetworksData = {
      media_id:  new Array(networkIds.length).fill(mediaId),
      network_id: networkIds.map((companyId) => networkNameToId[companyId]),
    }

    try {
      const result = await bulkUpsertData(
        'media_networks',
        mediaNetworksData,
        {},
        ['media_id', 'network_id'],
        ['media_id', 'network_id'],
      )
      // console.log('\\NETWORKS')
      return result
    } catch (error) {
      console.error(error)
    }
  } catch (error) {
    console.error(error)
  }
}

export const saveTMDBTranslations = async (mediaId?: number, translations?: Translations): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !translations) return

  const translationsData = translations.translations.map((translation) => {
    return {
      media_id: mediaId,
      country_code: convertCountryNameToCode(translation.iso_3166_1),
      language_code: translation.iso_639_1,
      title: translation.data.title || translation.data.name,
      tagline: translation.data.tagline,
      synopsis: translation.data.overview,
      homepage: translation.data.homepage,
      runtime: translation.data.runtime,
    }
  })
  const mediaTranslationsData = Object.fromEntries(
    Object.keys(translationsData[0]).map((key) => [
      key,
      translationsData.map((translationData) => translationData[key as keyof typeof translationData]),
    ])
  );

  try {
    const result = await bulkUpsertData(
      'media_translations',
      mediaTranslationsData,
      { runtime: 'numeric' },
      ['media_id', 'country_code', 'language_code'],
      ['media_id', 'country_code', 'language_code'],
    )
    // console.log('\tMEDIA TRANSLATIONS')
    return result
  } catch (error) {
    console.error(error)
  }
}

export const saveTMDBMediaRelations = async (mediaId?: number, recommendations?: Recommendations, similar?: Recommendations): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !recommendations || !similar) return

  const recommendationsData = recommendations.results.map((relation) => {
    return {
      media_id: mediaId,
      related_media_id: relation.id,
      relation_type: 'tmdb_recommendation'
    }
  })
  const similarData = similar.results.map((relation) => {
    return {
      media_id: mediaId,
      related_media_id: relation.id,
      relation_type: 'tmdb_similar'
    }
  })
  const mediaRelationsData = Object.fromEntries(
    Object.keys(recommendationsData[0]).map((key) => [
      key,
      [
        ...recommendationsData.map((relationData) => relationData[key as keyof typeof relationData]),
        ...similarData.map((relationData) => relationData[key as keyof typeof relationData]),
      ],
    ])
  );

  try {
    const result = await bulkUpsertData(
      'media_relations',
      mediaRelationsData,
      {},
      ['media_id', 'related_media_id', 'relation_type'],
      ['media_id', 'related_media_id', 'relation_type'],
    )
    // console.log('\tMEDIA RELATIONS')
    return result
  } catch (error) {
    console.error(error)
  }
}

export const saveTMDBTVSeasons = async (mediaId?: number, seasons?: Season[]): Promise<BulkUpsertResult | undefined> => {
  if (!mediaId || !seasons) return

  const seasonsData = seasons.map((season) => {
    return {
      media_id: mediaId,
      name: season.name,
      synopsis: season.overview,
      air_date: season.air_date,
      season_number: season.season_number,
      episode_count: season.episode_count,
      poster_path: season.poster_path,
    }
  })
  const mediaSeasonsData = Object.fromEntries(
    Object.keys(seasonsData[0]).map((key) => [
      key,
      seasonsData.map((seasonData) => seasonData[key as keyof typeof seasonData]),
    ])
  );

  try {
    const result = await bulkUpsertData(
      'media_seasons',
      mediaSeasonsData,
      { air_date: 'timestamp' },
      ['media_id', 'name', 'season_number'],
      ['media_id', 'name', 'season_number'],
    )
    // console.log('\tTV SEASONS')
    return result
  } catch (error) {
    console.error(error)
  }
}