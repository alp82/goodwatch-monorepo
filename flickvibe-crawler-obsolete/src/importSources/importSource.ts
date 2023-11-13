import {pool} from "../db/db";
import {sleep} from "../utils/helpers";

export type DataStatus = 'running' | 'success' | 'failed' | 'ignore'

export interface ImportSourceConfig {
  name: string
  updateIntervalMinutes: number
  retryIntervalSeconds: number
  batchSize: number,
  batchDelaySeconds: number
  rateLimitDelaySeconds: number
}

export interface UpdateStatus {
  status: DataStatus
  errors?: string[]
}

export abstract class ImportSource {
  async process() {
    const config = this.getConfig()
    await this.updateStatus({ status: 'running' })

    // Fetch the data from the data source
    const data = await this.fetchData();

    // If there is no data, update the status to 'failed' and continue
    if (!data) {
      await this.updateStatus({ status: 'failed' })
      return;
    }

    // Save the data in the database
    await this.storeData(data);

    // Update the status to 'success'
    await this.updateStatus({ status: 'success' })

    // Wait for the configured delay between requests
    await sleep(config.batchDelaySeconds * 1000);
  }

  async updateStatus({ status, errors = [] }: UpdateStatus): Promise<void> {
    const timestamp = new Date()
    const isSuccess = status === 'success'
    const isError = status === 'failed'
    const query = `
      INSERT INTO process_import_source (
        import_source,
        last_status
        ${isSuccess ? ', last_updated_successfully' : ''}
        ${isError ? ', last_updated_with_error' : ''}
        ${isSuccess || isError ? ', last_errors' : ''}
      )
      VALUES (
        $1,
        $2
        ${isSuccess || isError ? ', $3' : ''}
        ${isSuccess || isError ? ', $4' : ''}
      )
      ON CONFLICT (import_source) DO UPDATE
      SET last_status = EXCLUDED.last_status,
          last_updated_successfully = EXCLUDED.last_updated_successfully,
          last_updated_with_error = EXCLUDED.last_updated_with_error,
          last_errors = EXCLUDED.last_errors;
    `
    try {
      const values = [
        this.getConfig().name,
        status,
        ...(isSuccess || isError ? [timestamp] : []),
        ...(isSuccess || isError ? [errors] : []),
      ];
      await pool.query({
        text: query.trim(),
        values,
      })
    } catch (error) {
      console.error(error)
    }
  }

  abstract getConfig(): ImportSourceConfig
  abstract fetchData(): Promise<unknown>
  abstract storeData(data: unknown): Promise<void>

}
