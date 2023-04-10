import {
  IntervalDataSourceConfig,
  MediaDataSourceConfig,
  processIntervalDataSource,
  processMediaDataSource
} from "./dataSources/process"

const dataSourceTMDBDaily: IntervalDataSourceConfig = {
  name: "tmdb_daily",
  updateIntervalMinutes: 60 * 24,
  retryIntervalSeconds: 60,
}

const dataSourceTMDBDetails: MediaDataSourceConfig = {
  name: "tmdb_details",
  updateIntervalMinutes: 60 * 24,
  retryIntervalSeconds: 10,
  batchSize: 10,
  batchDelaySeconds: 1,
  rateLimitDelaySeconds: 60,
}

export const runMainDataFetchingLoop = async () => {
  await Promise.all([
    processIntervalDataSource(dataSourceTMDBDaily),
    processMediaDataSource(dataSourceTMDBDetails),
  ])
}