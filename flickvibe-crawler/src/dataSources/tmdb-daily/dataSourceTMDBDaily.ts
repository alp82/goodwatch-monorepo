import {DataSourceConfigForImport, DataSourceForImport} from "../dataSource";
import {
  downloadAndExtract,
  ExportType,
  insertMovieRowsInChunks,
  insertTvRowsInChunks,
  readLinesFromFile,
  TMDBDailyMovie,
  TMDBDailyTv
} from "./tmdb-daily-handler";
import {pool} from "../../db/db";

export interface FetchedData {
  movies: TMDBDailyMovie[]
  tvShows: TMDBDailyTv[]
}

// @ts-ignore
export class DataSourceTMDBDaily extends DataSourceForImport {
  getConfig(): DataSourceConfigForImport {
    return {
      name: "tmdb_daily",
      classDefinition: DataSourceTMDBDaily,
      updateIntervalMinutes: 60 * 24,
      retryIntervalSeconds: 60,
      batchSize: 5000,
      batchDelaySeconds: 60 * 60,
      rateLimitDelaySeconds: 60,
    }
  }

  async fetchData(): Promise<FetchedData> {
    const exportTypes = ['movie_ids', 'tv_series_ids'] as ExportType[];
    const promises = exportTypes.map(async (exportType) => {
      const timestamp = await downloadAndExtract(exportType);
      return readLinesFromFile(exportType, timestamp);
    });
    const results = await Promise.all(promises);

    if (results?.[0]?.[0]) {
      const query = `
        SELECT tmdb_id, media_type_id FROM daily_media
        WHERE last_updated = $1
      `
      const { rows: upToDate } = await pool.query(query, [results[0][0].last_updated]);

      if (upToDate.length !== results[0].length + results[1].length) {
        return {
          movies: results[0] as TMDBDailyMovie[],
          tvShows: results[1] as TMDBDailyTv[],
        }
      }
    }

    return {
      movies: [],
      tvShows: [],
    }
  }

  async storeData(data: FetchedData): Promise<void> {
    if (!data.movies && !data.tvShows) {
      return
    }

    const config = this.getConfig()
    console.log('storing data...', data.movies.length, data.tvShows.length)
    const promises = [
      insertMovieRowsInChunks(data.movies, config.batchSize),
      insertTvRowsInChunks(data.tvShows, config.batchSize),
    ]
    await Promise.all(promises)
  }

}