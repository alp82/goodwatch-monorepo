import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useUserData } from "~/routes/api.user-data"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import type { Score } from "~/server/scores.server"
import ScoreAction from "~/ui/user/actions/ScoreAction"

interface ScoreSelectorProps {
	details: MovieDetails | TVDetails
	onChange?: (score: Score | null) => void
}

export default function ScoreSelector({
	details,
	onChange,
}: ScoreSelectorProps) {
	const { tmdb_id, media_type } = details

	const { data: userData } = useUserData()

	const userScore = userData?.[media_type]?.[tmdb_id]?.score || null
	const [score, setScore] = useState<Score | null>(userScore)
	const [hoveredScore, setHoveredScore] = useState<Score | null>(null)
	const [clearedScore, setClearedScore] = useState<Score | null>(null)

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

	useEffect(() => {
		if (score === userScore) return
		setScore(userScore)
	}, [userScore])

	const getColorForIndex = (index: Score | null) => {
		const hovered = index && hoveredScore && index <= hoveredScore
		const scored = index && !hoveredScore && score && index <= score

		if ((hovered || scored) && !clearedScore) {
			const vibeColorIndex = (hoveredScore || score || -1) * 10
			return `bg-vibe-${vibeColorIndex}`
		}
		return "bg-gray-600"
	}

	const getLabelText = () => {
		if (score !== clearedScore || hoveredScore !== clearedScore) {
			if (hoveredScore) return `${scoreLabels[hoveredScore]} (${hoveredScore})`
			if (score) return `${scoreLabels[score]} (${score})`
		}
		return scoreLabels[0]
	}

	const handlePointerEnter = (
		event: React.TouchEvent | React.MouseEvent,
		index: Score | null,
	) => {
		event.preventDefault() // prevent text selection on desktop and scrolling on mobile
		setHoveredScore(index)
	}

	const handlePointerLeave = () => {
		setHoveredScore(null)
		setClearedScore(null)
	}

	const handleClick = (index: Score | null) => {
		setScore((previousScore) => {
			let newScore = null

			const clearingScore = previousScore === index
			if (clearingScore) {
				setClearedScore(index)
			} else {
				newScore = index
			}

			if (onChange) {
				onChange(newScore)
			}
			return newScore
		})
	}

	// touch controls
	const [lastTouchedElement, setLastTouchedElement] =
		useState<HTMLElement | null>(null)

	const containerRef = useRef<HTMLDivElement>(null)
	const handleTouchMove = (e: React.TouchEvent) => {
		const touch = e.touches[0]
		if (!containerRef.current) return

		const rect = containerRef.current.getBoundingClientRect()
		const touchX = touch.clientX - rect.left

		const containerWidth = rect.width
		const touchScore = Math.min(
			10,
			Math.max(1, Math.ceil((touchX / containerWidth) * 10)),
		) as Score

		setHoveredScore(touchScore)

		// Track the last touched element
		const element = document.elementFromPoint(
			touch.clientX,
			touch.clientY,
		) as HTMLElement
		setLastTouchedElement(element)
	}

	const handleTouchEnd = () => {
		if (hoveredScore && lastTouchedElement) {
			const clickEvent = new MouseEvent("click", {
				bubbles: true,
				cancelable: true,
				view: window,
			})
			lastTouchedElement.dispatchEvent(clickEvent)
		}
		setHoveredScore(null)
		setLastTouchedElement(null) // Reset the last touched element after submission
	}

	return (
		<div
			className="divide-y divide-gray-600 py-2 rounded-lg bg-gray-900 bg-opacity-50 shadow"
			ref={containerRef}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
		>
			<div className="px-6 py-2">
				<span className="flex gap-2">
					Your score:
					<span className="font-semibold">{getLabelText()}</span>
					{score && (!hoveredScore || hoveredScore === score) && (
						<>
							<span className="flex-grow" />
							<ScoreAction details={details} score={null}>
								<span className="px-2 py-1 bg-red-950 hover:bg-red-800 text-red-200 text-xs font-semibold rounded cursor-pointer">
									Remove
								</span>
							</ScoreAction>
						</>
					)}
				</span>
			</div>
			<div className="flex px-4 transition duration-150 ease-in-out">
				{Array.from({ length: 10 }, (_, i: number) => {
					const scoreIndex = (i + 1) as Score
					return (
						<ScoreAction
							key={i + 1}
							details={details}
							score={scoreIndex !== score ? scoreIndex : null}
						>
							<div
								className="w-full py-4 md:py-6 transition duration-200 ease-in-out transform origin-50 hover:scale-y-125 cursor-pointer"
								onTouchStart={(event) => handlePointerEnter(event, scoreIndex)}
								onMouseEnter={(event) => handlePointerEnter(event, scoreIndex)}
								onMouseLeave={handlePointerLeave}
								onClick={() => handleClick(scoreIndex)}
								onKeyPress={() => null}
							>
								<div
									className={`h-8 w-full border-2 border-gray-800 rounded-md ${getColorForIndex(
										scoreIndex,
									)}`}
								/>
							</div>
						</ScoreAction>
					)
				})}
			</div>
		</div>
	)
}
