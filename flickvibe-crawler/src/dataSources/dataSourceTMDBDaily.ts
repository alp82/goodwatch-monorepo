import {DataSourceInterval} from "./dataSource";

export class DataSourceIntervalTMDB extends DataSourceInterval {
  name = 'tmdb_daily'

  async run(): Promise<void> {
    await this.updateStatus('running')
    // TODO: implement logic to fetch or update data
    await this.updateStatus('success')
  }
}