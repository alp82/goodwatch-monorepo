import React, { useState } from 'react'
import InfoBox from '~/ui/InfoBox'
import imdbLogo from '~/img/imdb-logo-250.png'
import metacriticLogo from '~/img/metacritic-logo-250.png'
import rottenLogo from '~/img/rotten-logo-250.png'
import { AllRatings } from '~/utils/ratings'

export interface RatingsProps {
  ratings?: AllRatings
  title?: string
  compact?: boolean
}

export default function RatingProgressOverlay({ ratings }: RatingsProps) {
  const hasScore = Boolean(ratings?.aggregated_overall_score_normalized_percent)
  const score = ratings?.aggregated_overall_score_normalized_percent ? Math.floor(ratings.aggregated_overall_score_normalized_percent) : null
  const vibeColorIndex = ratings?.aggregated_overall_score_normalized_percent ? Math.floor(ratings.aggregated_overall_score_normalized_percent / 10) * 10 : null

  return (
    <div className="absolute w-full rounded-t-md bg-gray-800 h-2 lg:h-4">
      {hasScore && (
        <>
          <div className={`${vibeColorIndex == null ? 'bg-gray-700' : `bg-vibe-${vibeColorIndex}`} absolute -top-1 lg:-top-2 w-6 h-4 lg:w-12 lg:h-8 rounded flex items-center justify-center text-gray-100 font-bold text-sm lg:text-lg`} style={{left: `${score}%`, transform: "translateX(-50%)"}}>
            {score}
          </div>
          <div className={`${vibeColorIndex == null ? 'bg-gray-700' : `bg-vibe-${vibeColorIndex}`} h-full rounded-t-md`} style={{width: `${score}%`}}></div>
        </>
      )}
    </div>

  )
}
