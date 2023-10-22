import { AxiosError } from 'axios'
import { isRateLimited, sleep } from '../utils/helpers'
import { ImportSource } from './importSource'

export const processImportSource = async (
  importSource: ImportSource,
) => {
  const importSourceConfig = importSource.getConfig()
  while (true) {
    try {
      try {
        await importSource.process()
      } catch (error) {
        const errors = [`${error}`]
        importSource.updateStatus({ status: 'failed', errors })
        console.error(error)
        throw error
      }

      await sleep(importSourceConfig.batchDelaySeconds * 1000);
    } catch (error) {
      if (error instanceof AxiosError) {
        if (isRateLimited(error)) {
          // handle rate limit errors by waiting for a configured time
          console.log(`----------------------------------------------------------------------------------------------------------------------`);
          console.log(`!!! Rate limit reached for ${importSourceConfig.name}, waiting for ${importSourceConfig.rateLimitDelaySeconds} seconds !!!`);
          console.log(`----------------------------------------------------------------------------------------------------------------------`);
          await sleep(importSourceConfig.rateLimitDelaySeconds * 1000);
        } else {
          // handle connectivity errors by waiting for a configured time
          console.error(`Error processing data source ${importSourceConfig.name}: ${error.message}`);
          await sleep(importSourceConfig.batchDelaySeconds * 1000);
        }
      } else {
        await sleep(importSourceConfig.batchDelaySeconds * 1000);
      }
    }
  }

}
