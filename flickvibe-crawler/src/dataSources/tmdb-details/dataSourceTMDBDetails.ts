import {DataSourceConfigForMedia, DataSourceForMedia} from "../dataSource";
import {
  getTMDBMovieCollection,
  getTMDBMovieDetails,
  getTMDBTvDetails,
  saveTMDBAlternativeTitles,
  saveTMDBCast,
  saveTMDBCertifications,
  saveTMDBCollection,
  saveTMDBCrew,
  saveTMDBGenres,
  saveTMDBMovie,
  saveTMDBTv,
} from './tmdb-details-handler'
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
      batchSize: 100,
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
      saveTMDBAlternativeTitles(mediaId, data.details.alternative_titles.titles),
      saveTMDBCast(mediaId, data.details.credits.cast),
      saveTMDBCrew(mediaId, data.details.credits.crew),
      saveTMDBCertifications(mediaId, data.details.release_dates.results)
      // TODO images
      // TODO videos
      // TODO keywords
      // TODO production companies
      // TODO production countries
      // TODO recommendations
      // TODO similar
      // TODO spoken languages
      // TODO translations
      // TODO watch providers
    ]
    const results = await Promise.all(promises)
  }

  async storeTvData(data: FetchedTvData): Promise<void> {
    const mediaId = await saveTMDBTv(data.details)
    const promises: Promise<unknown>[] = [
      saveTMDBGenres(mediaId, data.details.genres),
      saveTMDBAlternativeTitles(mediaId, data.details.alternative_titles.results),
      saveTMDBCast(mediaId, data.details.aggregate_credits.cast),
      saveTMDBCrew(mediaId, data.details.aggregate_credits.crew),
      saveTMDBCertifications(mediaId, data.details.content_ratings.results)
      // data.details.images
      // data.details.videos
      // data.details.keywords
      // TODO production companies
      // TODO production countries
      // TODO recommendations
      // TODO similar
      // data.details.spoken_languages
      // data.details.translations
      // data.details.languages
      // data.details.networks
      // data.details.seasons
      // TODO created_by -> people
    ]
    const results = await Promise.all(promises)
  }

}