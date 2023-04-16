import {DataSourceConfigForMedia, DataSourceForMedia} from "../dataSource";
import {
  getTMDBMovieCollection,
  getTMDBMovieDetails,
  getTMDBTvDetails, saveTMDBCollection, saveTMDBGenres,
  saveTMDBMovie,
  saveTMDBTv
} from "./tmdb-details-handler";
import {TMDBCollection, TMDBMovieDetails, TMDBTvDetails} from "../../types/details.types";

export interface FetchedMovieData {
  details: TMDBMovieDetails
  collection?: TMDBCollection
}

export interface FetchedTvData {
  details: TMDBTvDetails
}

// @ts-ignore
export class DataSourceTMDBDetails extends DataSourceForMedia {
  getConfig(): DataSourceConfigForMedia {
    return {
      name: "tmdb_details",
      classDefinition: DataSourceTMDBDetails,
      updateIntervalMinutes: 60 * 24,
      retryIntervalSeconds: 60,
      batchSize: 10,
      batchDelaySeconds: 1,
      rateLimitDelaySeconds: 60,
    }
  }

  async fetchMovieData(tmdbId: number): Promise<FetchedMovieData> {
    const details = await getTMDBMovieDetails(tmdbId)

    let collection: TMDBCollection | undefined
    if (details.belongs_to_collection) {
      collection = await getTMDBMovieCollection(details.belongs_to_collection.id)
    }

    return {
      details,
      collection,
    }
  }

  async fetchTvData(tmdbId: number): Promise<FetchedTvData> {
    const details = await getTMDBTvDetails(tmdbId)

    return {
      details,
    }
  }

  async storeMovieData(data: FetchedMovieData): Promise<void> {
    const mediaId = await saveTMDBMovie(data.details);
    console.log(`Movie: ${data.details.title} (ID: ${mediaId})`)
    const promises = [
      saveTMDBCollection(mediaId, data.collection),
      saveTMDBGenres(mediaId, data.details.genres),
    ]
    const results = await Promise.all(promises)
    const resultCollection = results[0] as unknown as Awaited<ReturnType<typeof saveTMDBCollection>>
    if (resultCollection?.collection && (resultCollection.rows || []).length > 0) {
      const { collection, rows } = resultCollection
      console.log(`\tCollection '${collection.name}' added with ${rows.length} movies`)
    }
    const resultGenres = results[1] as unknown as Awaited<ReturnType<typeof saveTMDBGenres>>
    if (resultGenres?.length) {
      console.log(`\tGenres added: ${resultGenres.join(', ')}`)
    }
  }

  async storeTvData(data: FetchedTvData): Promise<void> {
    const mediaId = await saveTMDBTv(data.details)
    console.log(`TV: ${data.details.name} (ID: ${mediaId})`)
    const promises: Promise<unknown>[] = [
      // created_by -> people
    ]
    const results = await Promise.all(promises)
  }

}