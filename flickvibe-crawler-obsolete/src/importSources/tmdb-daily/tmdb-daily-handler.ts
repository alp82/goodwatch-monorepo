import axios, { AxiosError } from 'axios'
import zlib from 'zlib'
import fs from 'fs'

import { pool } from '../../db/db'

const baseUrl = 'http://files.tmdb.org/p/exports'
const filePath = 'tmp'
export type ExportType = 'movie_ids' | 'tv_series_ids'

export interface TMDBDailyMovie {
  tmdb_id: number
  media_type: 'movie'
  last_updated: Date
  original_title: string
  popularity: number
  video: boolean
  adult: boolean
}

export interface TMDBDailyTv {
  tmdb_id: number
  media_type: 'tv'
  last_updated: Date
  original_title: string
  popularity: number
}

const formatDate = (date: Date): string => {
  const month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1
  const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()
  const year = date.getFullYear()

  return `${month}_${day}_${year}`
}

export const downloadAndExtract = async (exportType: ExportType): Promise<Date> => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  let response
  let timestamp: Date
  try {
    timestamp = today
    const formattedDate = formatDate(timestamp)
    response = await axios.get(`${baseUrl}/${exportType}_${formattedDate}.json.gz`, { responseType: 'stream' })
  } catch (error: unknown) {
    if ((error as AxiosError)?.response?.status === 403) {
      timestamp = yesterday
      const formattedDate = formatDate(timestamp)
      response = await axios.get(`${baseUrl}/${exportType}_${formattedDate}.json.gz`, { responseType: 'stream' })
    }
  }

  if (!response) {
    throw new Error('could not fetch daily TMDB data')
  }

  const unzip = zlib.createGunzip()
  const writeStream = fs.createWriteStream(`${filePath}/${exportType}.txt`)

  response.data.pipe(unzip).pipe(writeStream)

  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve(timestamp))
    writeStream.on('error', reject)
  })
}

export const readLinesFromFile = async (exportType: ExportType, timestamp: Date): Promise<TMDBDailyMovie[] | TMDBDailyTv[]> => {
  const fileStream = fs.createReadStream(`${filePath}/${exportType}.txt`)
  if (exportType === 'movie_ids') {
    const entries: TMDBDailyMovie[] = []

    const rl = require('readline').createInterface({
      input: fileStream,
      crlfDelay: Infinity
    })

    for await (const line of rl) {
      const csvLine = {
        ...JSON.parse(line),
      }
      if (csvLine.original_title || csvLine.original_name) {
        entries.push({
          tmdb_id: csvLine.id,
          media_type: 'movie',
          last_updated: timestamp,
          original_title: csvLine.original_title,
          popularity: csvLine.popularity,
          video: csvLine.video,
          adult: csvLine.adult,
        })
      }
    }

    return entries
  } else {
    const entries: TMDBDailyTv[] = []

    const rl = require('readline').createInterface({
      input: fileStream,
      crlfDelay: Infinity
    })

    for await (const line of rl) {
      const csvLine = {
        ...JSON.parse(line),
      }
      if (csvLine.original_name) {
        entries.push({
          tmdb_id: csvLine.id,
          media_type: 'tv',
          last_updated: timestamp,
          original_title: csvLine.original_name,
          popularity: csvLine.popularity,
        })
      }
    }

    return entries
  }
}

export const insertMovieRowsInChunks = async (entries: TMDBDailyMovie[], batchSize: number) => {
  const columns = Object.keys(entries[0])
  const values = entries.reduce<(string | number | boolean | Date | undefined)[][]>((acc, entry) => {
    const entryValues = columns.map(col => entry[col as keyof typeof entry])
    acc.push(entryValues)
    return acc
  }, [])

  let start = 0
  while (start < values.length) {
    const end = start + batchSize > values.length ? values.length : start + batchSize
    const chunk = values.slice(start, end)
    const query = `
      INSERT INTO daily_media (${columns.join(', ')})
      VALUES ${chunk.map(
        (entry, row_index) => 
          `(${entry.map((_, column_index) => `$${row_index * columns.length + column_index + 1}`).join(', ')})`
        ).join(', ')}
      ON CONFLICT (tmdb_id, media_type) DO UPDATE
      SET ${columns.map((column) => `${column} = excluded.${column}`).join(', ')}
    `
    console.log(`Writing movie batch from ${start} to ${end}`)
    try {
      await pool.query(query.trim(), chunk.flat())
    } catch (error) {
      console.error(error)
    }
    start = end
  }
  console.log("Finished daily movies")
}

export const insertTvRowsInChunks = async (entries: TMDBDailyTv[], batchSize: number) => {
  const columns = Object.keys(entries[0])
  const values = entries.reduce<(string | number | boolean | Date | undefined)[][]>((acc, entry) => {
    const entryValues = columns.map(col => entry[col as keyof typeof entry])
    acc.push(entryValues)
    return acc
  }, [])

  let start = 0
  while (start < values.length) {
    const end = start + batchSize > values.length ? values.length : start + batchSize
    const chunk = values.slice(start, end)
    const query = `
      INSERT INTO daily_media (${columns.join(', ')})
      VALUES ${chunk.map(
        (entry, row_index) => 
          `(${entry.map((_, column_index) => `$${row_index * columns.length + column_index + 1}`).join(', ')})`
        ).join(', ')}
      ON CONFLICT (tmdb_id, media_type) DO UPDATE
      SET ${columns.map((column) => `${column} = excluded.${column}`).join(', ')}
    `
    console.log(`Writing tv batch from ${start} to ${end}`)
    try {
      await pool.query(query.trim(), chunk.flat())
    } catch (error) {
      console.error(error)
    }
    start = end
  }
  console.log("Finished daily tv shows")
}
