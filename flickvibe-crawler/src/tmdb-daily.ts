import axios, { AxiosError } from 'axios'
import zlib from 'zlib'
import fs from 'fs'

import { pool } from './db/db'

const baseUrl = 'http://files.tmdb.org/p/exports'
const filePath = 'tmp'
export type ExportType = 'movie_ids' | 'tv_series_ids'

export interface TMDBDailyMovie {
  id: number
  original_title: string
  popularity: number
  video: boolean
  adult: boolean
  processed?: boolean
}

export interface TMDBDailyTv {
  id: number
  original_name: string
  popularity: number
  processed?: boolean
}

const formatDate = (date: Date) => {
  const month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1
  const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()
  const year = date.getFullYear()

  return `${month}_${day}_${year}`
}

const downloadAndExtract = async (exportType: ExportType): Promise<void> => {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  let response
  try {
    const formattedDate = formatDate(today)
    response = await axios.get(`${baseUrl}/${exportType}_${formattedDate}.json.gz`, { responseType: 'stream' })
  } catch (error: unknown) {
    if ((error as AxiosError)?.response?.status === 403) {
      const formattedDate = formatDate(yesterday)
      response = await axios.get(`${baseUrl}/${exportType}_${formattedDate}.json.gz`, { responseType: 'stream' })
    }
  }

  if (!response) {
    return
  }

  const unzip = zlib.createGunzip()
  const writeStream = fs.createWriteStream(`${filePath}/${exportType}.txt`)

  response.data.pipe(unzip).pipe(writeStream)

  return new Promise((resolve, reject) => {
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
  })
}

const readLinesFromFile = async (exportType: ExportType): Promise<TMDBDailyMovie[] & TMDBDailyTv[]> => {
  const fileStream = fs.createReadStream(`${filePath}/${exportType}.txt`)
  const entries = []

  const rl = require('readline').createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  for await (const line of rl) {
    const entry = {
      ...JSON.parse(line),
    }
    if (entry.original_title || entry.original_name) {
      entries.push(entry)
    }
  }

  return entries
}

const createTableIfNotExists = async (tableName: string, columns: string[]) => {
  const client = await pool.connect()

  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columns.join(',')}
      )
    `
    const result = await client.query(createTableQuery)
    console.log(`Table ${tableName} created successfully`)
  } catch (err) {
    console.error(`Error creating table ${tableName}: ${err}`)
  }
}

const insertRowsInChunks = async (exportType: ExportType, entries: TMDBDailyMovie[] & TMDBDailyTv[], batchSize = 10000) => {
  const table_suffix = exportType === 'movie_ids' ? 'movie' : 'tv'

  const columns = Object.keys(entries[0])
  const values = entries.reduce<(string | number | boolean | undefined)[][]>((acc, entry) => {
    const entryValues = columns.map(col => entry[col as keyof typeof entry])
    acc.push(entryValues)
    return acc
  }, [])

  let start = 0
  while (start < values.length) {
    const end = start + batchSize > values.length ? values.length : start + batchSize
    const chunk = values.slice(start, end)
    const query = `
      INSERT INTO tmdb_daily_${table_suffix} (${columns.join(', ')})
      VALUES ${chunk.map(
        (entry, row_index) => 
          `(${entry.map((_, column_index) => `$${row_index * columns.length + column_index + 1}`).join(', ')})`
        ).join(', ')}
      ON CONFLICT (id) DO UPDATE
      SET ${columns.map((column) => `${column} = excluded.${column}`).join(', ')}
    `
    console.log(`Writing batch from ${start} to ${end}`)
    await pool.query(query.trim(), chunk.flat())
    start = end
  }
}

export const importDailyTMDBEntries = async () => {
  await createTableIfNotExists('tmdb_daily_movie', [
    'id INTEGER PRIMARY KEY',
    'original_title VARCHAR(255) NOT NULL',
    'popularity NUMERIC NOT NULL',
    'video BOOLEAN NOT NULL DEFAULT false',
    'adult BOOLEAN NOT NULL DEFAULT false',
    'processed BOOLEAN NOT NULL DEFAULT false',
  ]);
  await createTableIfNotExists('tmdb_daily_tv', [
    'id INTEGER PRIMARY KEY',
    'original_name VARCHAR(255) NOT NULL',
    'popularity NUMERIC NOT NULL',
    'processed BOOLEAN NOT NULL DEFAULT false',
  ]);

  (['movie_ids', 'tv_series_ids'] as ExportType[]).map(async (exportType) => {
    await downloadAndExtract(exportType)
    const entries = await readLinesFromFile(exportType)
    await insertRowsInChunks(exportType, entries)
  })
}

