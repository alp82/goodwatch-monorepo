import React, { useEffect } from 'react'
import { PrefetchPageLinks, useFetcher } from '@remix-run/react'
import {titleToDashed} from "~/utils/helpers";
import {Collection} from "~/server/details.server";
import { CollectionMovie } from '~/server/collection.server'

export interface CollectionProps {
  collection: Collection
  movieId: number
}

export default function Collection({ collection, movieId }: CollectionProps) {
  const collectionId = collection?.id.toString()
  const movieIds = (collection?.movie_ids || []).map(movieId => movieId.toString()).join(",")
  const moviesFetcher = useFetcher()

  useEffect(() => {
    if (!movieIds) return

    moviesFetcher.submit(
      { collectionId, movieIds },
      {
        method: 'get',
        action: '/api/movie/collection',
      }
    )
  }, [movieIds])

  const movies = (moviesFetcher.data?.movies || []) as CollectionMovie[]
  return (
    <>
      {collection && <div className="mt-8 mb-4">
        <div className="mb-2 text-lg font-bold">Movies from same collection</div>
        <div className="flex flex-wrap">
          {movies.filter((movie) => movie.tmdb_id !== movieId).map((movie) => {
            const url = `/movie/${movie.tmdb_id}-${titleToDashed(movie.title)}`
            return (
              <a key={movie.tmdb_id} className="flex flex-col w-36 border-4 border-transparent hover:bg-indigo-900 hover:border-indigo-900" href={url}>
                <div>
                  <img
                    className="block rounded-md"
                    src={`https://www.themoviedb.org/t/p/w300_and_h450_bestv2${movie.poster_path}`}
                    alt={`Poster for ${movie.title}`}
                    title={`Poster for ${movie.title}`}
                  />
                </div>
                <div className="my-2 px-2">
                  <span className="text-sm font-bold">{movie.title}</span>
                </div>
                <PrefetchPageLinks page={url} />
              </a>
            )
          })}
        </div>
      </div>}
    </>
  )
}
