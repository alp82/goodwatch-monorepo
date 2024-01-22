import React, { useState } from 'react'
import InfoBox from '~/ui/InfoBox'
import imdbLogo from '~/img/imdb-logo-250.png'
import metacriticLogo from '~/img/metacritic-logo-250.png'
import rottenLogo from '~/img/rotten-logo-250.png'
import { AllRatings } from '~/utils/ratings'
import logo from '~/img/goodwatch-logo.png'

export interface RatingsProps {
  ratings?: AllRatings
  title?: string
  compact?: boolean
}

export default function Ratings({ ratings, title = 'Ratings', compact = false }: RatingsProps) {
  const isComplete = Boolean(ratings)
  const vibeColorIndex = ratings?.aggregated_overall_score_normalized_percent ? Math.floor(ratings.aggregated_overall_score_normalized_percent / 10) * 10 : null

  return (
    <div className="relative">
      {!isComplete && (
        <div className="absolute top-16 left-6 z-10">
          <InfoBox text="Ratings are currently calculated..." />
        </div>
      )}
      <div className={`mt-2 mb-2 font-bold ${compact ? 'text-lg' : 'text-xl'}`}>{title}</div>
      <ul className={`underline-offset-2 flex gap-4 flex-wrap ${isComplete ? '' : 'opacity-50'}`}>
        <dl className={`${vibeColorIndex == null ? 'bg-gray-700' : `bg-vibe-${vibeColorIndex}`} w-28 p-3 rounded-lg shadow overflow-hidden text-center`}>
          <dd className={`${vibeColorIndex == null ? 'text-gray-300' : 'text-gray-100'} mt-1 text-5xl font-semibold tracking-tight`}>{ratings?.aggregated_overall_score_normalized_percent ? Math.floor(ratings?.aggregated_overall_score_normalized_percent) : '--'}</dd>
          <dt className={`${vibeColorIndex == null ? 'text-gray-400' : 'text-gray-200'} mt-2 flex items-center justify-center gap-2 truncate text-md font-medium`}>
            <img
              className="h-4 w-auto"
              src={logo}
              alt="GoodWatch Logo"
            />
            Score
          </dt>
        </dl>

        <a className="" href={ratings?.imdb_url} target="_blank">
          <dl className={`${ratings?.imdb_url ? 'hover:border-white/[.45] active:border-white/[.45]' : 'opacity-60'} rounded-lg border-4 border-black/[.3] w-24 p-3 bg-imdb shadow overflow-hidden text-center flex flex-col justify-center`}>
            <img className="h-6 object-contain" src={imdbLogo} alt="IMDb Logo" />
            <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{ratings?.imdb_user_score_original ? ratings?.imdb_user_score_original.toFixed(1) : '--'}</dd>
            <dt className={`truncate text-xs font-medium text-gray-700 ${ratings?.imdb_url && 'underline'}`}>Score</dt>
          </dl>
        </a>

        <a className="" href={ratings?.metacritic_url} target="_blank">
          <dl className={`${ratings?.metacritic_url ? 'hover:border-white/[.45] active:border-white/[.45]' : 'opacity-60'} rounded-lg border-4 border-white/[.2] w-56 p-3 bg-metacritic shadow overflow-hidden text-center flex flex-col justify-center`}>
            <img className="h-6 object-contain" src={metacriticLogo} alt="Metacritic Logo" />
            <div className="flex justify-center gap-8">
              <div>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-100">{ratings?.metacritic_meta_score_original ? Math.floor(ratings?.metacritic_meta_score_original) : '--'}</dd>
                <dt className={`truncate text-xs font-medium text-gray-300 ${ratings?.metacritic_url && 'underline'}`}>Metascore</dt>
              </div>
              <div>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-100">{ratings?.metacritic_user_score_original ? ratings?.metacritic_user_score_original.toFixed(1) : '--'}</dd>
                <dt className={`truncate text-xs font-medium text-gray-300 ${ratings?.metacritic_url && 'underline'}`}>User Score</dt>
              </div>
            </div>
          </dl>
        </a>

        <a className="" href={ratings?.rotten_tomatoes_url} target="_blank">
          <dl className={`${ratings?.rotten_tomatoes_url ? 'hover:border-white/[.45] active:border-white/[.45]' : 'opacity-60'} rounded-lg border-4 border-black/[.3] w-56 p-3 bg-rotten shadow overflow-hidden text-center flex flex-col align-middle`}>
            <img className="h-6 object-contain" src={rottenLogo} alt="Rotten Tomatoes Logo" />
            <div className="flex justify-center gap-8">
              <div>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-50">{ratings?.rotten_tomatoes_tomato_score_original ? Math.floor(ratings?.rotten_tomatoes_tomato_score_original) : '--'}</dd>
                <dt className={`truncate text-xs font-medium text-gray-100 ${ratings?.rotten_tomatoes_url && 'underline'}`}>Tomatometer</dt>
              </div>
              <div>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-50 no-underline">{ratings?.rotten_tomatoes_audience_score_original ? Math.floor(ratings?.rotten_tomatoes_audience_score_original) : '--'}</dd>
                <dt className={`truncate text-xs font-medium text-gray-100 ${ratings?.rotten_tomatoes_url && 'underline'}`}>Audience Score</dt>
              </div>
            </div>
          </dl>
        </a>
      </ul>
    </div>
  )
}
