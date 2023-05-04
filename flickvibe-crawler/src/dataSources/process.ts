import { isRateLimited, sleep } from '../utils/helpers'
import { pool } from '../db/db'
import { DataSource, DataSourceConfigForMedia, DataSourceForMedia, MediaData } from './dataSource'
import { AxiosError } from 'axios'

export const processDataSource = async (
  dataSource: DataSource,
) => {
  const dataSourceConfig = dataSource.getConfig()
  while (true) {
    try {
      if (dataSource instanceof DataSourceForMedia) {
        // Get the next batch of entries that need to be processed for this data source
        const { batchSize, usesExistingMedia } = dataSourceConfig as DataSourceConfigForMedia
        const query = `
          SELECT
            daily_media.tmdb_id,
            daily_media.media_type_id,
            media.id,
            media.imdb_id,
            media.release_year,
            media.titles_dashed,
            media.titles_underscored,
            media.titles_pascal_cased,
            tv.number_of_seasons
          FROM daily_media
          LEFT JOIN media ON media.tmdb_id = daily_media.tmdb_id
          LEFT JOIN tv ON tv.id = media.id
          LEFT JOIN data_sources_for_media
            ON data_sources_for_media.tmdb_id = media.tmdb_id
            AND data_sources_for_media.media_type_id = media.media_type_id
            AND data_sources_for_media.data_source_id = (SELECT id FROM data_sources WHERE name = '${dataSourceConfig.name}')
          WHERE (
            -- Condition 1: select only rows that have a media row if "usesExistingMedia" is true
            (${usesExistingMedia} AND media.id IS NOT NULL) OR
            
            -- Condition 2: prefer rows that do not exist in media if "usesExistingMedia" is false,
            -- but use those in media if there is nothing new left in daily_media
            (NOT ${usesExistingMedia} AND media.id IS NULL) OR
            (
              NOT ${usesExistingMedia} AND media.id IS NOT NULL AND
              NOT EXISTS (
                SELECT 1 FROM daily_media
                WHERE daily_media.tmdb_id = media.tmdb_id AND
                      daily_media.media_type_id = media.media_type_id
              )
            )
          ) AND (
            -- Condition 3: select all entries with last successful entry is too long in the past
            data_sources_for_media.last_successful_attempt_at IS NULL OR
            now() - data_sources_for_media.last_successful_attempt_at >= '${dataSourceConfig.updateIntervalMinutes} minutes'::interval
          ) AND (
            -- Condition 4: deprioritize entries the closer their last error has happened
            data_sources_for_media.data_status NOT IN ('failed') OR
            data_sources_for_media.last_attempt_at IS NULL OR
            now() - data_sources_for_media.last_attempt_at >= '${dataSourceConfig.updateIntervalMinutes} minutes'::interval
          ) AND (
            data_sources_for_media.data_status IS NULL OR
            data_sources_for_media.data_status NOT IN ('ignore')
          )
          ORDER BY 
            CASE 
                WHEN media.id IS ${usesExistingMedia ? 'NOT NULL' : 'NULL'} THEN 0 
                ELSE 1 
            END, 
            daily_media.popularity DESC, 
            COALESCE(data_sources_for_media.last_successful_attempt_at, '1970-01-01'::timestamp) ASC, 
            COALESCE(data_sources_for_media.last_attempt_at, '1970-01-01'::timestamp) ASC
          LIMIT $1;
        `
        const { rows } = await pool.query(query.trim(), [batchSize]);

        // If there are no entries to process, wait and try again later
        if (rows.length === 0) {
          await sleep(dataSourceConfig.retryIntervalSeconds * 1000);
          continue;
        }

        // Process each entry in parallel
        await Promise.all(
          rows.map(async (dataSourceRow: MediaData) => {
            try {
              await dataSource.process(dataSourceRow)
            } catch (error) {
              dataSource.updateStatus({ tmdbId: dataSourceRow.tmdb_id, mediaTypeId: dataSourceRow.media_type_id, newStatus: 'failed', retryCount: 0, timestamp: new Date(), success: false})
              throw error
            }
          })
        );

        await sleep(dataSourceConfig.batchDelaySeconds * 1000);
      } else {
        try {
          await dataSource.process()
        } catch (error) {
          dataSource.updateStatus({ newStatus: 'failed', retryCount: 0, timestamp: new Date(), success: false })
          throw error
        }

        await sleep(dataSourceConfig.batchDelaySeconds * 1000);
      }
    } catch (error) {
      if (error instanceof AxiosError) {
        if (isRateLimited(error)) {
          // handle rate limit errors by waiting for a configured time
          console.log(`----------------------------------------------------------------------------------------------------------------------`);
          console.log(`!!! Rate limit reached for ${dataSourceConfig.name}, waiting for ${dataSourceConfig.rateLimitDelaySeconds} seconds !!!`);
          console.log(`----------------------------------------------------------------------------------------------------------------------`);
          await sleep(dataSourceConfig.rateLimitDelaySeconds * 1000);
        } else {
          // handle connectivity errors by waiting for a configured time
          console.error(`Error processing data source ${dataSourceConfig.name}: ${error.message}`);
          await sleep(dataSourceConfig.batchDelaySeconds * 1000);
        }
      } else {
        await sleep(dataSourceConfig.batchDelaySeconds * 1000);
      }
    }
  }
}
