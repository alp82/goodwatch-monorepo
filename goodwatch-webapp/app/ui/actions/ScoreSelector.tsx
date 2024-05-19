import React, { useState } from 'react'
import UserAction from '~/ui/auth/UserAction'

interface ScoreSelectorProps {
}

export default function ScoreSelector({}: ScoreSelectorProps) {
  const [score, setScore] = useState<number | null>(null)
  const [hoveredScore, setHoveredScore] = useState<number | null>(null)
  const [clearedScore, setClearedScore] = useState<number | null>(null)

  const scoreLabels = [
    "Not Rated",
    "Unwatchable",
    "Terrible",
    "Bad",
    "Weak",
    "Mediocre",
    "Decent",
    "Good",
    "Great",
    "Excellent",
    "Must Watch",
  ]

  const getColorForIndex = (index: number | null) => {
    if (index && hoveredScore && index <= hoveredScore && !clearedScore) {
      const vibeColorIndex = hoveredScore * 10
      return `bg-vibe-${vibeColorIndex}`
    }
    return 'bg-gray-600'
  }

  const handlePointerEnter = (index: number | null) => {
    setHoveredScore(index)
  }

  const handlePointerLeave = (index: number | null) => {
    setHoveredScore(score)
    setClearedScore(null)
  }

  const getLabelText = () => {
    if (hoveredScore !== clearedScore) {
      if (hoveredScore) return `${scoreLabels[hoveredScore]} (${hoveredScore})`
      if (score) return `${scoreLabels[score]} (${score})`
    }
    return scoreLabels[0]
  }

  const handleClick = (index: number | null) => {
    setScore((previousScore) => {
      const clearingScore = previousScore == index
      if (clearingScore) {
        setClearedScore(index)
        return null
      }

      return index
    })
  }

  return (
    <div className="divide-y divide-gray-600 py-2 rounded-lg bg-gray-900 bg-opacity-50 shadow">
      <div className="px-6 py-2">
        <span className="flex gap-2">
          Your score:
          <span className="font-semibold">
            {getLabelText()}
          </span>
        </span>
      </div>
      <div className="flex px-4 transition duration-150 ease-in-out">
        {Array.from({length: 10}, (_, i) => (
          <UserAction instructions={<>Rate movies and tv shows to get better recommendations.</>}>
            <div
              key={i + 1}
              className="w-full py-4 md:py-6 transition duration-200 ease-in-out transform origin-50 hover:scale-y-125 cursor-pointer"
              onPointerEnter={() => handlePointerEnter(i + 1)}
              onPointerLeave={() => handlePointerLeave(i + 1)}
              onClick={() => handleClick(i + 1)}
            >
              <div
                className={`h-6 w-full border-2 border-gray-800 rounded-md ${getColorForIndex(i + 1)}`}
              />
            </div>
          </UserAction>
        ))}
      </div>
    </div>
  )
}
