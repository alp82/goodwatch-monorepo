import React, { useState } from 'react'
import InfoBox from '~/ui/InfoBox'
import imdbLogo from '~/img/imdb-logo-250.png'
import metacriticLogo from '~/img/metacritic-logo-250.png'
import rottenLogo from '~/img/rotten-logo-250.png'
import { AllRatings } from '~/utils/ratings'

const minPosition = 30
const maxPosition = 70

export interface RatingsProps {
  ratings?: AllRatings
  title?: string
  compact?: boolean
}

export default function RatingProgressOverlay({ ratings }: RatingsProps) {
  const hasScore = typeof ratings?.aggregated_overall_score_normalized_percent === "number"
  const score = hasScore ? Math.floor(ratings.aggregated_overall_score_normalized_percent) : null
  const vibeColorIndex = hasScore ? Math.floor(ratings.aggregated_overall_score_normalized_percent / 10) * 10 : null
  const progressPosition = typeof score === "number" ? score : 50
  const badgePositionSmallScreen = typeof score === "number" ? (score / 100) * 90 + 5 : 50
  const badgePositionNormalScreen = typeof score === "number" ? (score / 100) * 55 + 20 : 57

  return (
    <div className="absolute -top-1 w-full rounded-t-md bg-gray-800 h-2 md:h-4">
      {hasScore && (
        <>
          <div className={`hidden md:flex ${vibeColorIndex == null ? 'bg-gray-700' : `bg-vibe-${vibeColorIndex}`} absolute -top-1 h-4 md:h-6 px-2 rounded-md items-center justify-center gap-2 text-gray-100 text-sm md:text-lg`} style={{left: `${badgePositionNormalScreen}%`, transform: "translateX(-50%)"}}>
            <small>Score:</small>
            <strong className="-top-2">{score}</strong>
          </div>
          <div className={`flex md:hidden ${vibeColorIndex == null ? 'bg-gray-700' : `bg-vibe-${vibeColorIndex}`} absolute -top-1 h-4 md:h-6 px-2 rounded-md items-center justify-center gap-2 text-gray-100 text-sm md:text-lg`} style={{left: `${badgePositionSmallScreen}%`, transform: "translateX(-50%)"}}>
            <small>Score:</small>
            <strong className="-top-2">{score}</strong>
          </div>
          <div className={`${vibeColorIndex == null ? 'bg-gray-700' : `bg-vibe-${vibeColorIndex}`} h-full rounded-tl-md`} style={{width: `${progressPosition}%`}}></div>
        </>
      )}
    </div>

  )
}
