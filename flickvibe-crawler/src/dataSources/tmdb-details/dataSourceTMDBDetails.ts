import {DataSourceConfigForMedia, DataSourceForMedia} from "../dataSource";
import {
  getTMDBMovieCollection,
  getTMDBMovieDetails,
  getTMDBTvDetails, saveTMDBAlternativeTitles, saveTMDBCollection, saveTMDBGenres,
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
    const promises = [
      saveTMDBCollection(mediaId, data.collection),
      saveTMDBGenres(mediaId, data.details.genres),
      saveTMDBAlternativeTitles(mediaId, data.details.alternative_titles.titles)
    ]
    const results = await Promise.all(promises)
  }

  async storeTvData(data: FetchedTvData): Promise<void> {
    const mediaId = await saveTMDBTv(data.details)
    const promises: Promise<unknown>[] = [
      // TODO created_by -> people
      saveTMDBGenres(mediaId, data.details.genres),
      saveTMDBAlternativeTitles(mediaId, data.details.alternative_titles.results)
    ]
    const results = await Promise.all(promises)
  }

}