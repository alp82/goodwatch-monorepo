import {processDataSource} from "./dataSources/process"
import {DataSourceTMDBDaily} from "./dataSources/tmdb-daily/dataSourceTMDBDaily";
import {DataSourceTMDBDetails} from "./dataSources/tmdb-details/dataSourceTMDBDetails";

export const runMainDataFetchingLoop = async () => {
  await Promise.all([
    processDataSource(new DataSourceTMDBDaily()),
    processDataSource(new DataSourceTMDBDetails()),
  ])
}