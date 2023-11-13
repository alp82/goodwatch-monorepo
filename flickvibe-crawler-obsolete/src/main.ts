import {processDataSource} from "./dataSources/process"
import {DataSourceTMDBDetails} from "./dataSources/tmdb-details/dataSourceTMDBDetails";
import { DataSourceIMDBRatings } from './dataSources/imdb-ratings/dataSourceIMDBRatings'
import { DataSourceMetacriticRatings } from './dataSources/metacritic-ratings/dataSourceMetacriticRatings'
import { DataSourceRottenTomatoesRatings } from './dataSources/rotten-tomatoes-ratings/dataSourceRottenTomatoesRatings'
import { DataSourceTvTropesTags } from './dataSources/tvtropes-tags/dataSourceTvTropesTags'
import { processImportSource } from './importSources/process'
import { ImportSourceTMDBDaily } from './importSources/tmdb-daily/importSourceTMDBDaily'

export const runMainDataFetchingLoop = async () => {
  await Promise.all([
    // processImportSource(new ImportSourceTMDBDaily()),
    processDataSource(new DataSourceTMDBDetails()),
    // processDataSource(new DataSourceIMDBRatings()),
    // processDataSource(new DataSourceMetacriticRatings()),
    // processDataSource(new DataSourceRottenTomatoesRatings()),
    // processDataSource(new DataSourceTvTropesTags()),
  ])
}