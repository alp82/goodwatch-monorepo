import { DataSource, DataSourceConfig, MediaData } from '../dataSource'
import { getTMDBMovieDetails, getTMDBTvDetails, saveTMDBMovies, saveTMDBTvs } from './tmdb-details-handler'
import { TMDBCollection, TMDBMovieDetails, TMDBTvDetails } from '../../types/details.types'
import { pool } from '../../db/db'

export interface FetchedMovieData {
  mediaType: 'movie'
  details: TMDBMovieDetails
  collection?: TMDBCollection
}

export interface FetchedTvData {
  mediaType: 'tv'
  details: TMDBTvDetails
}

// @ts-ignore
export class DataSourceTMDBDetails extends DataSource {
  getConfig(): DataSourceConfig {
    return {
      name: "tmdb_details",
      updateIntervalMinutes: 60 * 24 * 7,
      retryIntervalSeconds: 30,
      batchSize: 20,
      batchDelaySeconds: 0,
      rateLimitDelaySeconds: 60,
    }
  }

  async getNextBatch(): Promise<MediaData[]> {
    // Get the next batch of entries that need to be processed for this data source
    const { batchSize } = this.getConfig()
    const query = `
      SELECT batch.*
      FROM (
        SELECT
          daily_media.tmdb_id,
          daily_media.media_type,
          daily_media.popularity,
          NULL AS last_updated_successfully
          --media.id,
          --media.imdb_id,
          --media.release_year,
          --media.titles_dashed,
          --media.titles_underscored,
          --media.titles_pascal_cased,
          --tv.number_of_seasons
        FROM daily_media
        LEFT JOIN tmdb_movie ON daily_media.tmdb_id = tmdb_movie.tmdb_id
        LEFT JOIN tmdb_tv ON daily_media.tmdb_id = tmdb_tv.tmdb_id
        WHERE
          tmdb_movie.tmdb_id IS NULL-- Entries not in TMDB movie details
          AND  tmdb_tv.tmdb_id IS NULL -- Entries not in TMDB TV details
        UNION ALL
        SELECT
          daily_media.tmdb_id,
          daily_media.media_type,
          daily_media.popularity,
          tmdb_movie.last_updated_successfully
        FROM daily_media
        INNER JOIN tmdb_movie ON daily_media.tmdb_id = tmdb_movie.tmdb_id
        WHERE tmdb_movie.last_updated_with_error < (NOW() - INTERVAL '24 hours')
        UNION ALL
        SELECT
          daily_media.tmdb_id,
          daily_media.media_type,
          daily_media.popularity,
          tmdb_tv.last_updated_successfully
        FROM daily_media
        INNER JOIN tmdb_tv ON daily_media.tmdb_id = tmdb_tv.tmdb_id
        WHERE tmdb_tv.last_updated_with_error < (NOW() - INTERVAL '24 hours')
      ) AS batch
      ORDER BY batch.popularity DESC, batch.last_updated_successfully ASC
      LIMIT $1;
    `
    const { rows } = await pool.query(query.trim(), [batchSize]);
    return rows as MediaData[]
  }

  async fetchMovieData({ tmdb_id }: MediaData): Promise<FetchedMovieData> {
    const details = await getTMDBMovieDetails(tmdb_id)

    let collection: TMDBCollection | undefined
    // if (details.belongs_to_collection) {
    //   collection = await getTMDBMovieCollection(details.belongs_to_collection.id)
    // }

    return {
      mediaType: 'movie',
      details,
      collection,
    }
  }

  async fetchTvData({ tmdb_id }: MediaData): Promise<FetchedTvData> {
    const details = await getTMDBTvDetails(tmdb_id)

    return {
      mediaType: 'tv',
      details,
    }
  }

  async storeMovieDatas(movieDatas: FetchedMovieData[]): Promise<void> {
    await saveTMDBMovies(movieDatas)
    // const mediaId = await saveTMDBMovie(data.details);
    // const promises = [
    //   saveTMDBCollection(mediaId, data.collection),
    //   saveTMDBGenres(mediaId, data.details.genres),
    //   saveTMDBKeywords(mediaId, data.details.keywords, 'movie', data.details.id),
    //   saveTMDBAlternativeTitles(mediaId, data.details.alternative_titles.titles),
    //   (async () => {
    //     await saveTMDBCast(mediaId, data.details.credits.cast)
    //     await saveTMDBCrew(mediaId, data.details.credits.crew)
    //   })(),
    //   saveTMDBCertifications(mediaId, data.details.release_dates.results),
    //   saveTMDBStreamingProviders(mediaId, data.details['watch/providers']),
    //   saveTMDBMediaImages(mediaId, data.details.images),
    //   saveTMDBMediaVideos(mediaId, data.details.videos),
    //   saveTMDBProductionCompanies(mediaId, data.details.production_companies),
    //   saveTMDBTranslations(mediaId, data.details.translations),
    //   saveTMDBMediaRelations(mediaId, data.details.recommendations, data.details.similar),
    // ]
    // await Promise.all(promises)
  }

  async storeTvDatas(tvDatas: FetchedTvData[]): Promise<void> {
    await saveTMDBTvs(tvDatas)
    // const mediaId = await saveTMDBTv(data.details)
    // const promises: Promise<unknown>[] = [
    //   saveTMDBGenres(mediaId, data.details.genres),
    //   saveTMDBAlternativeTitles(mediaId, data.details.alternative_titles.results),
    //   saveTMDBKeywords(mediaId, data.details.keywords, 'tv', data.details.id),
    //   (async () => {
    //     await saveTMDBCast(mediaId, data.details.aggregate_credits.cast)
    //     await saveTMDBCrew(mediaId, data.details.aggregate_credits.crew)
    //     // TODO creator / created_by
    //   })(),
    //   saveTMDBCertifications(mediaId, data.details.content_ratings.results),
    //   saveTMDBStreamingProviders(mediaId, data.details['watch/providers']),
    //   saveTMDBMediaImages(mediaId, data.details.images),
    //   saveTMDBMediaVideos(mediaId, data.details.videos),
    //   saveTMDBProductionCompanies(mediaId, data.details.production_companies),
    //   saveTMDBNetworks(mediaId, data.details.networks),
    //   saveTMDBTranslations(mediaId, data.details.translations),
    //   saveTMDBMediaRelations(mediaId, data.details.recommendations, data.details.similar),
    //   saveTMDBTVSeasons(mediaId, data.details.seasons),
    // ]
    // await Promise.all(promises)
  }

}