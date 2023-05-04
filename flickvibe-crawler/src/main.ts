import {processDataSource} from "./dataSources/process"
import {DataSourceTMDBDaily} from "./dataSources/tmdb-daily/dataSourceTMDBDaily";
import {DataSourceTMDBDetails} from "./dataSources/tmdb-details/dataSourceTMDBDetails";
import { DataSourceIMDBRatings } from './dataSources/imdb-ratings/dataSourceIMDBRatings'
import { DataSourceMetacriticRatings } from './dataSources/metacritic-ratings/dataSourceMetacriticRatings'
import { DataSourceRottenTomatoesRatings } from './dataSources/rotten-tomatoes-ratings/dataSourceRottenTomatoesRatings'

export const runMainDataFetchingLoop = async () => {
  await Promise.all([
    processDataSource(new DataSourceTMDBDaily()),
    processDataSource(new DataSourceTMDBDetails()),
    processDataSource(new DataSourceIMDBRatings()),
    processDataSource(new DataSourceMetacriticRatings()),
    processDataSource(new DataSourceRottenTomatoesRatings()),
  ])
}