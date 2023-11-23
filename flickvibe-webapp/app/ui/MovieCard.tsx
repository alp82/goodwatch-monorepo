import { titleToDashed } from '~/utils/helpers'
import RatingProgressOverlay from '~/ui/RatingProgressOverlay'
import React from 'react'
import { extractRatings } from '~/utils/ratings'
import { MovieDetails } from '~/server/details.server'

interface MovieCardProps {
  movie: MovieDetails
}

export function MovieCard({ movie }: MovieCardProps) {
  const ratings = extractRatings(movie)
  return (
    <a
      className="flex flex-col w-36 border-4 border-transparent hover:bg-indigo-900 hover:border-indigo-900"
      href={`/movie/${movie.tmdb_id}-${titleToDashed(movie.title)}`}
    >
      <div className="relative">
        <RatingProgressOverlay ratings={ratings} />
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
}