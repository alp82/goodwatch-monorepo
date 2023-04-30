import {pool} from "../db/db";
import {Submittable} from "pg";
import {sleep} from "../utils/helpers";

export type DataStatus = 'running' | 'success' | 'failed' | 'ignore'

export interface BaseDataSourceConfig {
  name: string
  updateIntervalMinutes: number
  retryIntervalSeconds: number
  batchSize: number
  batchDelaySeconds: number
  rateLimitDelaySeconds: number
}

export interface DataSourceConfigForImport extends BaseDataSourceConfig {
  classDefinition: new () => DataSourceForImport
}

export interface DataSourceConfigForMedia extends BaseDataSourceConfig {
  classDefinition: new () => DataSourceForMedia
  usesExistingMedia: boolean
}

export type DataSourceConfig = DataSourceConfigForImport | DataSourceConfigForMedia

export interface UpdateStatus {
  newStatus: DataStatus
  retryCount: number
  timestamp: Date
  success: boolean
}

export interface UpdateStatusForMedia extends UpdateStatus{
  tmdbId: number
  mediaTypeId: number
}

export type DataSource = DataSourceForImport | DataSourceForMedia

export abstract class DataSourceForImport {
  async process() {
    const config = this.getConfig()
    await this.updateStatus({ newStatus: 'running', retryCount: 0, timestamp: new Date(), success: false})

    // Fetch the data from the data source
    const data = await this.fetchData();

    // If there is no data, update the status to 'failed' and continue
    if (!data) {
      await this.updateStatus({ newStatus: 'failed', retryCount: 0, timestamp: new Date(), success: false})
      return;
    }

    // Save the data in the database
    await this.storeData(data);

    // Update the status to 'success'
    await this.updateStatus({ newStatus: 'success', retryCount: 0, timestamp: new Date(), success: true})

    // Wait for the configured delay between requests
    await sleep(config.batchDelaySeconds * 1000);
  }

  async updateStatus({ newStatus, retryCount, timestamp, success }: UpdateStatus): Promise<void> {
    const query = `
      INSERT INTO data_sources_for_import (
        data_source_id,
        data_status,
        retry_count,
        last_attempt_at
        ${success ? ', last_successful_attempt_at' : ''}
      )
      VALUES (
        (SELECT id FROM data_sources WHERE name = '${this.getConfig().name}'),
        $1,
        $2,
        $3
        ${success ? ', $3' : ''}
      )
      ON CONFLICT (data_source_id) DO UPDATE
      SET data_status = EXCLUDED.data_status,
          retry_count = EXCLUDED.retry_count,
          last_attempt_at = EXCLUDED.last_attempt_at,
          last_successful_attempt_at = EXCLUDED.last_successful_attempt_at;
    `
    try {
      await pool.query({
        text: query.trim(),
        values: [
          newStatus,
          retryCount,
          timestamp,
        ]
      })
    } catch (error) {
      console.error(error)
    }
  }

  abstract getConfig(): DataSourceConfigForImport
  abstract fetchData(): Promise<unknown>
  abstract storeData(data: unknown): Promise<void>

}

export interface MediaData {
  tmdb_id: number
  media_type_id: number
  id?: number
  imdb_id?: string
  titles_dashed?: string[]
  titles_underscored?: string[]
  titles_pascal_cased?: string[]
  release_year?: number
  number_of_seasons?: number
}

export abstract class DataSourceForMedia {
  async process(mediaData: MediaData) {
    const { tmdb_id, media_type_id } = mediaData
    const config = this.getConfig()
    await this.updateStatus({ tmdbId: tmdb_id, mediaTypeId: media_type_id, newStatus: 'running', retryCount: 0, timestamp: new Date(), success: false})

    // Fetch the data from the data source
    if (media_type_id === 1) {
      const data = await this.fetchMovieData(mediaData);

      // If there is no data, update the status to 'failed' and continue
      if (!data) {
        await this.updateStatus({ tmdbId: tmdb_id, mediaTypeId: media_type_id, newStatus: 'failed', retryCount: 0, timestamp: new Date(), success: false})
        return;
      }

      // Save the data in the database
      await this.storeMovieData(data);
    } else {
      const data = await this.fetchTvData(mediaData);

      // If there is no data, update the status to 'failed' and continue
      if (!data) {
        await this.updateStatus({ tmdbId: tmdb_id, mediaTypeId: media_type_id, newStatus: 'failed', retryCount: 0, timestamp: new Date(), success: false})
        return;
      }

      // Save the data in the database
      await this.storeTvData(data);
    }

    // Update the status to 'success'
    await this.updateStatus({ tmdbId: tmdb_id, mediaTypeId: media_type_id, newStatus: 'success', retryCount: 0, timestamp: new Date(), success: true})

    // Wait for the configured delay between requests
    await sleep(config.batchDelaySeconds * 1000);
  }

  async updateStatus({ tmdbId, mediaTypeId, newStatus, retryCount, timestamp, success }: UpdateStatusForMedia): Promise<void> {
    const existsResult = await pool.query('SELECT id FROM media WHERE tmdb_id = $1 AND media_type_id = $2', [tmdbId, mediaTypeId])
    if (!existsResult || existsResult.rowCount === 0) {
      return
    }

    const query = `
      INSERT INTO data_sources_for_media (
        tmdb_id,
        media_type_id,
        data_source_id,
        data_status,
        retry_count,
        last_attempt_at
        ${success ? ', last_successful_attempt_at' : ''}
      )
      VALUES (
        $1,
        $2,
        (SELECT id FROM data_sources WHERE name = '${this.getConfig().name}'),
        $3,
        $4,
        $5
        ${success ? ', $5' : ''}
      )
      ON CONFLICT (tmdb_id, media_type_id, data_source_id) DO UPDATE
      SET data_status = EXCLUDED.data_status,
          retry_count = EXCLUDED.retry_count,
          last_attempt_at = EXCLUDED.last_attempt_at
          ${success ? ', last_successful_attempt_at = EXCLUDED.last_successful_attempt_at' : ''}
          ;
    `
    try {
      await pool.query({
        text: query.trim(),
        values: [
          tmdbId,
          mediaTypeId,
          newStatus,
          retryCount,
          timestamp,
        ]
      })
    } catch (error) {
      console.error(error)
    }
  }

  abstract getConfig(): DataSourceConfigForMedia
  abstract fetchMovieData(mediaData: MediaData): Promise<unknown>
  abstract fetchTvData(mediaData: MediaData): Promise<unknown>
  abstract storeMovieData(data: unknown): Promise<void>
  abstract storeTvData(data: unknown): Promise<void>

}
