import { PrefetchPageLinks } from '@remix-run/react'
import { titleToDashed } from '~/utils/helpers'
import RatingOverlay from '~/ui/ratings/RatingOverlay'
import React from 'react'
import { extractRatings } from '~/utils/ratings'
import { MovieDetails } from '~/server/details.server'
import { Poster } from '~/ui/Poster'
import StreamingOverlay from '~/ui/streaming/StreamingOverlay'
import { DiscoverResult } from '~/server/discover.server'

interface MovieCardProps {
  movie: MovieDetails | DiscoverResult
  prefetch?: boolean
}

export function MovieCard({ movie, prefetch = false }: MovieCardProps) {
  const ratings = extractRatings(movie)
  return (
    <a
      className="flex flex-col w-full border-4 border-transparent hover:bg-indigo-900 hover:border-indigo-900"
      href={`/movie/${movie.tmdb_id}-${titleToDashed(movie.title)}`}
    >
      <div className="relative">
        <RatingOverlay ratings={ratings} />
        <StreamingOverlay providers={movie.streaming_providers} />
        <Poster path={movie.poster_path} title={movie.title} />
      </div>
      <div className="my-2 px-2">
        <span className="text-sm font-bold">{movie.title}</span>
      </div>
      {prefetch && <PrefetchPageLinks page={`/movie/${movie.tmdb_id}-${titleToDashed(movie.title)}`} />}
    </a>
  )
}