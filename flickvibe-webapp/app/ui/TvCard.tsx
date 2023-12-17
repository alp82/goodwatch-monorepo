import { titleToDashed } from '~/utils/helpers'
import RatingOverlay from '~/ui/RatingOverlay'
import React from 'react'
import { extractRatings } from '~/utils/ratings'
import { TVDetails } from '~/server/details.server'
import { Poster } from '~/ui/Poster'
import { PrefetchPageLinks } from '@remix-run/react'
import StreamingOverlay from '~/ui/StreamingOverlay'

interface TvCardProps {
  tv: TVDetails
  prefetch?: boolean
}

export function TvCard({ tv, prefetch = false }: TvCardProps) {
  const ratings = extractRatings(tv)
  return (
    <a
      className="flex flex-col w-full border-4 border-transparent hover:bg-indigo-900 hover:border-indigo-900"
      href={`/tv/${tv.tmdb_id}-${titleToDashed(tv.title)}`}
    >
      <div className="relative">
        <RatingOverlay ratings={ratings} />
        <StreamingOverlay providers={tv.streaming_providers} />
        <Poster path={tv.poster_path} title={tv.title}/>
      </div>
      <div className="my-2 px-2">
        <span className="text-sm font-bold">{tv.title}</span>
      </div>
      {prefetch && <PrefetchPageLinks page={`/tv/${tv.tmdb_id}-${titleToDashed(tv.title)}`} />}
    </a>
  )
}