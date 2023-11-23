import { titleToDashed } from '~/utils/helpers'
import RatingProgressOverlay from '~/ui/RatingProgressOverlay'
import React from 'react'
import { extractRatings } from '~/utils/ratings'
import { TVDetails } from '~/server/details.server'

interface TvCardProps {
  tv: TVDetails
}

export function TvCard({ tv }: TvCardProps) {
  const ratings = extractRatings(tv)
  return (
    <a
      className="flex flex-col w-36 border-4 border-transparent hover:bg-indigo-900 hover:border-indigo-900"
      href={`/tv/${tv.tmdb_id}-${titleToDashed(tv.title)}`}
    >
      <div className="relative">
        <RatingProgressOverlay ratings={ratings} />
        <img
          className="block rounded-md"
          src={`https://www.themoviedb.org/t/p/w300_and_h450_bestv2${tv.poster_path}`}
          alt={`Poster for ${tv.title}`}
          title={`Poster for ${tv.title}`}
        />
      </div>
      <div className="my-2 px-2">
        <span className="text-sm font-bold">{tv.title}</span>
      </div>
    </a>
  )
}