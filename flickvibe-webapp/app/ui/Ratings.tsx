import React, { useState } from 'react'
import { IMDbRatings } from '~/server/ratings/imdb-scraper'
import InfoBox from '~/ui/InfoBox'
import { VibeRatings } from '~/server/ratings/vibes-calculator'
import { MetacriticRatings } from '~/server/ratings/metacritic-scraper'
import { RottenTomatoesRatings } from '~/server/ratings/rottentomatoes-scraper'

export interface RatingsProps {
  vibeRatings?: VibeRatings
  imdbRatings?: IMDbRatings
  metacriticRatings?: MetacriticRatings
  rottenTomatoesRatings?: RottenTomatoesRatings
}

export default function Ratings({ vibeRatings, imdbRatings, metacriticRatings, rottenTomatoesRatings }: RatingsProps) {
  const [isUpToDate, setIsUpToDate] = useState<boolean>(false)

  const isComplete = vibeRatings && imdbRatings && metacriticRatings && rottenTomatoesRatings
  return (
    <>
      {!isComplete && (
        <div className="mb-4">
          <InfoBox text="Ratings are currently calculated..." />
        </div>
      )}
      <div className="mt-2 mb-2 text-lg font-bold">Ratings</div>
      <ul className="flex gap-4 flex-wrap">
        <dl className="w-20 p-3 rounded-lg bg-green-700 shadow overflow-hidden text-center">
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-100">{vibeRatings?.vibes || '--'}</dd>
          <dt className="truncate text-xs font-medium text-gray-300">Vibes</dt>
        </dl>

        <dl className="w-20 p-3 rounded-lg bg-yellow-500 shadow overflow-hidden text-center">
          <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{imdbRatings?.score || '--'}</dd>
          <dt className="truncate text-xs font-medium text-gray-700">Score</dt>
        </dl>

        <dl className="w-56 p-3 rounded-lg bg-black shadow overflow-hidden text-center flex justify-center gap-8">
          <div>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-100">{metacriticRatings?.metaScore || '--'}</dd>
            <dt className="truncate text-xs font-medium text-gray-300">Metascore</dt>
          </div>
          <div>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-100">{metacriticRatings?.userScore || '--'}</dd>
            <dt className="truncate text-xs font-medium text-gray-300">User Score</dt>
          </div>
        </dl>

        <dl className="w-56 p-3 rounded-lg bg-red-500 shadow overflow-hidden text-center flex justify-center gap-8">
          <div>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-100">{rottenTomatoesRatings?.tomatometer || '--'}</dd>
            <dt className="truncate text-xs font-medium text-gray-300">Tomatometer</dt>
          </div>
          <div>
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-100">{rottenTomatoesRatings?.audienceScore || '--'}</dd>
            <dt className="truncate text-xs font-medium text-gray-300">Audience Score</dt>
          </div>
        </dl>
      </ul>
    </>
  )
}
