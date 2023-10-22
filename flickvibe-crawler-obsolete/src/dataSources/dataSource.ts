import {pool} from "../db/db";
import {sleep} from "../utils/helpers";
import { FetchedMovieData, FetchedTvData } from './tmdb-details/dataSourceTMDBDetails'

export type DataSourceType = 'tmdb_details' | 'imdb_ratings' | 'metacritic_ratings' | 'rotten_tomatoes_ratings' | 'tv_tropes_tags'
export type MediaType = 'movie' | 'tv'
export type ImportStatus = 'running' | 'success' | 'failed' | 'ignore'

export interface DataSourceConfig {
  name: DataSourceType
  updateIntervalMinutes: number
  retryIntervalSeconds: number
  batchSize: number
  batchDelaySeconds: number
  rateLimitDelaySeconds: number
}

export interface UpdateStatus {
  tmdbId: number
  mediaType: MediaType
  status: ImportStatus
  errors?: string[]
}

export interface UpdateStatusBulk {
  mediaDataRows: MediaData[]
  status: ImportStatus
  errors?: string[]
}

export interface MediaData {
  tmdb_id: number
  media_type: MediaType
  id?: number
  imdb_id?: string
  titles_dashed?: string[]
  titles_underscored?: string[]
  titles_pascal_cased?: string[]
  release_year?: number
  number_of_seasons?: number
}

export abstract class DataSource {
  async process(mediaDataRows: MediaData[]) {
    const config = this.getConfig()
    const statusAlreadyUpdated: MediaData[] = []
    await this.updateStatusBulk({ mediaDataRows, status: 'running' })

    const results: (FetchedMovieData | FetchedTvData)[] = []
    for (const mediaData of mediaDataRows) {
      const { tmdb_id, media_type } = mediaData

      // Fetch the data from the data source
      if (media_type === 'movie') {
        const data = await this.fetchMovieData(mediaData);

        // If there is no data, update the status to 'failed' and continue
        if (!data) {
          await this.updateStatus({
            tmdbId: tmdb_id,
            mediaType: media_type,
            status: 'failed',
            errors: ['No data found'],
          })
          statusAlreadyUpdated.push(mediaData)
          continue
        }

        results.push(data as FetchedMovieData)
      } else {
        const data = await this.fetchTvData(mediaData);

        // If there is no data, update the status to 'failed' and continue
        if (!data) {
          await this.updateStatus({
            tmdbId: tmdb_id,
            mediaType: media_type,
            status: 'failed',
            errors: ['No data found'],
          })
          statusAlreadyUpdated.push(mediaData)
          continue
        }

        results.push(data as FetchedTvData)
      }

      // Save the data in the database
      const movieResults = results.filter((result) => result.mediaType === 'movie') as FetchedMovieData[]
      const tvResults = results.filter((result) => result.mediaType === 'tv') as FetchedTvData[]
      await this.storeMovieDatas(movieResults)
      await this.storeTvDatas(tvResults)

      // Update the status to 'success'
      const remainingUpdates = mediaDataRows.filter((mediaData) => !statusAlreadyUpdated.includes(mediaData))
      await this.updateStatusBulk({ mediaDataRows: remainingUpdates, status: 'success' })
    }

    // Wait for the configured delay between requests
    await sleep(config.batchDelaySeconds * 1000);
  }

  async updateStatus({ tmdbId, mediaType, status, errors = [] }: UpdateStatus): Promise<void> {
    const { query, values } = this.generateUpdateQuery([{
      tmdbId,
      mediaType,
      status,
      errors
    }])

    try {
      await pool.query({
        text: query,
        values: values
      })
    } catch (error) {
      console.error(error)
    }
  }

  async updateStatusBulk(updateBulk: UpdateStatusBulk): Promise<void> {
    const updates = updateBulk.mediaDataRows.map((mediaData) => {
      const { tmdb_id, media_type } = mediaData
      return {
        tmdbId: tmdb_id,
        mediaType: media_type,
        status: updateBulk.status
      }
    })
    const { query, values } = this.generateUpdateQuery(updates)

    try {
      await pool.query({
        text: query,
        values: values
      })
    } catch (error) {
      console.error(error)
    }
  }

  generateUpdateQuery(updates: UpdateStatus[]) {
    const timestamp = new Date()
    let valueIndex = 1
    const queryValues: unknown[] = []

    const valuePlaceholders = updates.map((update) => {
      const { tmdbId, mediaType, status, errors = [] } = update
      const isSuccess = status === 'success'
      const isError = status === 'failed'

      let placeholders = [
        `$${valueIndex++}`, // $1
        `$${valueIndex++}`, // $2
        `$${valueIndex++}`, // $3
        `$${valueIndex++}`, // $4
      ]

      if (isSuccess) {
        placeholders.push(`$${valueIndex++}`) // $5
      }

      if (isError) {
        placeholders.push(`$${valueIndex++}`) // $5 or $6 depending on the previous if condition
      }

      queryValues.push(
        this.getConfig().name,
        tmdbId,
        mediaType,
        status
      )

      if (isSuccess) {
        queryValues.push(timestamp)
      }

      if (isError) {
        queryValues.push(errors)
      }

      return `(${placeholders.join(', ')})`
    })

    const updateColumns = [
      'last_status',
      ...(updates.some((update) => update.status === 'success') ? ['last_updated_successfully'] : []),
      ...(updates.some((update) => update.status === 'failed') ? ['last_updated_with_error', 'last_errors'] : [])
    ]

    const setClause = updateColumns.map((column, index) => `${column} = EXCLUDED.${column}`).join(',\n')

    const query = `
    INSERT INTO process_data_source (
      data_source,
      tmdb_id,
      media_type,
      last_status
      ${updates.some((update) => update.status === 'success') ? ', last_updated_successfully' : ''}
      ${updates.some((update) => update.status === 'failed') ? ', last_updated_with_error, last_errors' : ''}
    )
    VALUES
      ${valuePlaceholders.join(',\n')}
    ON CONFLICT (data_source, tmdb_id, media_type) DO UPDATE
    SET ${setClause};
  `

    return {
      query: query.trim(),
      values: queryValues
    }
  }

  abstract getConfig(): DataSourceConfig
  abstract getNextBatch(): Promise<MediaData[]>
  abstract fetchMovieData(mediaData: MediaData): Promise<unknown>
  abstract fetchTvData(mediaData: MediaData): Promise<unknown>
  abstract storeMovieDatas(movieDatas: FetchedMovieData[]): Promise<void>
  abstract storeTvDatas(tvDatas: FetchedTvData[]): Promise<void>

}
