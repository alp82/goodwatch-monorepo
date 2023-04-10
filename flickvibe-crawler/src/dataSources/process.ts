import {importDailyTMDBEntries} from "../tmdb-daily";
import {sleep} from "../utils/helpers";

export interface IntervalDataSourceConfig {
  name: string
  updateIntervalMinutes: number
  retryIntervalSeconds: number
}

export const processIntervalDataSource = async (
  intervalDataSourceConfig: IntervalDataSourceConfig,
) => {
  while (true) {
    try {
      await importDailyTMDBEntries()
      await sleep(1000 * 60 * 60);
    } catch (error) {

    }
  }
}

export interface MediaDataSourceConfig {
  name: string
  updateIntervalMinutes: number
  retryIntervalSeconds: number
  batchSize: number
  batchDelaySeconds: number
  rateLimitDelaySeconds: number
}

export const processMediaDataSource = async (
  mediaDataSourceConfig: MediaDataSourceConfig,
) => {
  while (true) {
    try {
      // Get the next batch of entries that need to be processed for this data source
      const batchSize = mediaDataSourceConfig.batchSize;
      const results = await db.any(`
        SELECT md.id, md.${mediaDataSourceConfig.lastUpdateField}
        FROM movie_data md
        INNER JOIN movie_data_status mds ON mds.movie_data_id = md.id
        WHERE mds.${mediaDataSourceConfig.statusField} = 'pending'
        AND (mds.${mediaDataSourceConfig.lastUpdateField} IS NULL
          OR now() - mds.${mediaDataSourceConfig.lastUpdateField} >= '${mediaDataSourceConfig.updateIntervalMinutes} minutes'::interval)
        ORDER BY mds.${mediaDataSourceConfig.priorityField} ASC, mds.${mediaDataSourceConfig.lastUpdateField} ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `, batchSize);

      // If there are no entries to process, wait and try again later
      if (results.length === 0) {
        await sleep(mediaDataSourceConfig.retryIntervalSeconds * 1000);
        continue;
      }

      // Process each entry in parallel
      await Promise.all(
        results.map(async (result) => {
          const movieId = result.id;
          const lastUpdate = result[mediaDataSourceConfig.lastUpdateField];

          // Fetch the data from the data source
          const data = await fetchDataSourceData(movieId, lastUpdate, mediaDataSourceConfig);

          // If there is no data, update the status to 'not found' and continue
          if (!data) {
            await updateMovieDataStatus(movieId, dataSourceName, 'not found', db);
            return;
          }

          // Save the data in the database
          await saveDataSourceData(movieId, data, mediaDataSourceConfig, db);

          // Update the status to 'done'
          await updateMovieDataStatus(movieId, dataSourceName, 'done', db);

          // Wait for the configured delay between requests
          await wait(mediaDataSourceConfig.delay);
        })
      );

    } catch (err) {
      // Handle rate limit errors by waiting for a configured time
      if (err.response && err.response.status === 403) {
        console.log(`Rate limit reached for ${dataSourceName}, waiting for ${mediaDataSourceConfig.rateLimitRetry} seconds`);
        await sleep(mediaDataSourceConfig.rateLimitDelaySeconds * 1000);
      } else {
        console.error(`Error processing data source ${dataSourceName}: ${err.message}`);
      }
    }
  }
}