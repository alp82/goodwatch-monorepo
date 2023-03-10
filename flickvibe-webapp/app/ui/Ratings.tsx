import React, { useState } from 'react'
import { IMDbRatings } from '~/server/ratings/imdb-scraper'
import { VibeRatings } from '~/server/ratings/vibes-calculator'
import { MetacriticRatings } from '~/server/ratings/metacritic-scraper'
import { RottenTomatoesRatings } from '~/server/ratings/rottentomatoes-scraper'
import InfoBox from '~/ui/InfoBox'
import imdbLogo from '~/img/imdb-logo-250.png'
import metacriticLogo from '~/img/metacritic-logo-250.png'
import rottenLogo from '~/img/rotten-logo-250.png'

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
          <dd className="mt-1 text-5xl font-semibold tracking-tight text-gray-100">{vibeRatings?.vibes || '--'}</dd>
          <dt className="mt-2 truncate text-lg font-medium text-gray-300">Vibes</dt>
        </dl>

        <a className="" href={imdbRatings?.url} target="_blank">
          <dl className={`rounded-lg border-4 border-white/[.5] ${imdbRatings?.url && 'hover:border-white/[.9]'} w-24 p-3 bg-imdb shadow overflow-hidden text-center flex flex-col justify-center`}>
            <img className="h-6 object-contain" src={imdbLogo} />
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{imdbRatings?.score || '--'}</dd>
            <dt className="truncate text-xs font-medium text-gray-700">Score</dt>
          </dl>
        </a>

        <a className="" href={metacriticRatings?.url} target="_blank">
          <dl className={`rounded-lg border-4 border-white/[.2] ${metacriticRatings?.url && 'hover:border-white/[.45]'} w-56 p-3 bg-metacritic shadow overflow-hidden text-center flex flex-col justify-center`}>
            <img className="h-6 object-contain" src={metacriticLogo} />
            <div className="flex justify-center gap-8">
              <div>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-100">{metacriticRatings?.metaScore || '--'}</dd>
                <dt className="truncate text-xs font-medium text-gray-300">Metascore</dt>
              </div>
              <div>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-100">{metacriticRatings?.userScore || '--'}</dd>
                <dt className="truncate text-xs font-medium text-gray-300">User Score</dt>
              </div>
            </div>
          </dl>
        </a>

        <a className="" href={rottenTomatoesRatings?.url} target="_blank">
          <dl className={`rounded-lg border-4 border-white/[.5] ${rottenTomatoesRatings?.url && 'hover:border-white/[.9]'} w-56 p-3 bg-rotten shadow overflow-hidden text-center flex flex-col align-middle`}>
            <img className="h-6 object-contain" src={rottenLogo} />
            <div className="flex justify-center gap-8">
              <div>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-50">{rottenTomatoesRatings?.tomatometer || '--'}</dd>
                <dt className="truncate text-xs font-medium text-gray-100">Tomatometer</dt>
              </div>
              <div>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-50">{rottenTomatoesRatings?.audienceScore || '--'}</dd>
                <dt className="truncate text-xs font-medium text-gray-100">Audience Score</dt>
              </div>
            </div>
          </dl>
        </a>
      </ul>
    </>
  )
}
