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

export abstract class DataSourceForMedia {
  async process(tmdbId: number, mediaTypeId: number) {
    const config = this.getConfig()
    await this.updateStatus({ tmdbId, mediaTypeId, newStatus: 'running', retryCount: 0, timestamp: new Date(), success: false})

    // Fetch the data from the data source
    if (mediaTypeId === 1) {
      const data = await this.fetchMovieData(tmdbId);

      // If there is no data, update the status to 'failed' and continue
      if (!data) {
        await this.updateStatus({ tmdbId, mediaTypeId, newStatus: 'failed', retryCount: 0, timestamp: new Date(), success: false})
        return;
      }

      // Save the data in the database
      await this.storeMovieData(data);
    } else {
      const data = await this.fetchTvData(tmdbId);

      // If there is no data, update the status to 'failed' and continue
      if (!data) {
        await this.updateStatus({ tmdbId, mediaTypeId, newStatus: 'failed', retryCount: 0, timestamp: new Date(), success: false})
        return;
      }

      // Save the data in the database
      await this.storeTvData(data);
    }

    // Update the status to 'success'
    await this.updateStatus({ tmdbId, mediaTypeId, newStatus: 'success', retryCount: 0, timestamp: new Date(), success: true})

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
  abstract fetchMovieData(tmdbId: number): Promise<unknown>
  abstract fetchTvData(tmdbId: number): Promise<unknown>
  abstract storeMovieData(data: unknown): Promise<void>
  abstract storeTvData(data: unknown): Promise<void>

}
