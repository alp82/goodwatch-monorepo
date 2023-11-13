import { isRateLimited, sleep } from '../utils/helpers'
import { pool } from '../db/db'
import { DataSource, MediaData, MediaType } from './dataSource'
import { AxiosError } from 'axios'

export const processDataSource = async (
  dataSource: DataSource,
) => {
  const dataSourceConfig = dataSource.getConfig()
  while (true) {
    try {
      const rows = await dataSource.getNextBatch()

      // If there are no entries to process, wait and try again later
      if (rows.length === 0) {
        await sleep(dataSourceConfig.retryIntervalSeconds * 1000);
        continue;
      }

      // Process each entry in parallel
      const dataSourceRows = rows as MediaData[]
      try {
        await dataSource.process(dataSourceRows)
      } catch (error) {
        const errors = [`${error}`]
        await dataSource.updateStatusBulk({
          mediaDataRows: dataSourceRows,
          status: 'failed',
          errors,
        })
        console.error(error)
        throw error
      }

      await sleep(dataSourceConfig.batchDelaySeconds * 1000);
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
        console.error(`Error processing data source ${dataSourceConfig.name}: ${error}`);
        await sleep(dataSourceConfig.batchDelaySeconds * 1000);
      }
    }
  }
}
