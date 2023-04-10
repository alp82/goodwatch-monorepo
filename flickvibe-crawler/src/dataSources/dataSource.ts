import {DataStatus} from "./data_status";

export abstract class DataSourceInterval {
  abstract name: string

  async updateStatus(newStatus: DataStatus): Promise<void> {
    const query = `
      INSERT INTO data_sources_daily (data_source_id, data_status, retry_count, last_attempted_at, last_successful_attempt_at)
      VALUES (
        (SELECT id FROM data_sources WHERE name = $1),
        $2,
        0,
        null,
        null
      )
      ON CONFLICT (data_source_id) DO UPDATE
      SET data_status = EXCLUDED.data_status,
          retry_count = EXCLUDED.retry_count,
          last_attempted_at = EXCLUDED.last_attempted_at,
          last_successful_attempt_at = EXCLUDED.last_successful_attempt_at;
    `
  }

  abstract run(): Promise<void>
}