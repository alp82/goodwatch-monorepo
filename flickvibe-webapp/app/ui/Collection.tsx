import React from 'react'
import {titleToDashed} from "~/utils/helpers";
import {BelongsToCollection} from "~/server/details.server";

export interface CollectionProps {
  collection: BelongsToCollection
  movieId: string
}

export default function Collection({ collection, movieId }: CollectionProps) {
  return (
    <>
      {collection && <div className="mb-4">
        <div className="mt-6 mb-2 text-lg font-bold">Movies from same collection</div>
        <div className="flex flex-wrap">
          {collection.parts.filter((part) => part.id !== movieId).map((movie) => {
            return (
              <a key={movie.id} className="flex flex-col w-36 border-4 border-transparent hover:bg-indigo-900 hover:border-indigo-900" href={`/movie/${movie.id}-${titleToDashed(movie.title)}`}>
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
              </a>
            )
          })}
        </div>
      </div>}
    </>
  )
}
