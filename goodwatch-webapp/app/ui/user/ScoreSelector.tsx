import React, { useState } from 'react'

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

  const handleMouseEnter = (index: number | null) => {
    setHoveredScore(index)
  }

  const handleMouseLeave = (index: number | null) => {
    setHoveredScore(score)
    setClearedScore(null)
  }

  const getLabelText = () => {
    if (hoveredScore !== clearedScore) {
      if (hoveredScore) return scoreLabels[hoveredScore]
      if (score) return scoreLabels[score]
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
    <div className="py-2 rounded-lg bg-gray-900 bg-opacity-50 shadow">
      <div className="flex px-4 py-2 md:py-4 transition duration-150 ease-in-out">
        {Array.from({length: 10}, (_, i) => (
          <div
            key={i + 1}
            className={`h-6 w-full border-2 border-gray-800 rounded-md transition duration-200 ease-in-out transform hover:scale-y-125 ${getColorForIndex(i + 1)} cursor-pointer`}
            onMouseEnter={() => handleMouseEnter(i + 1)}
            onMouseLeave={() => handleMouseLeave(i + 1)}
            onClick={() => handleClick(i + 1)}
          />
        ))}
      </div>
      <div className="flex items-center justify-center px-4">
        <span className="flex gap-2 text-lg">
          Your score:
          <span className="font-semibold">
            {getLabelText()}
          </span>
        </span>
      </div>
    </div>

  )
}
