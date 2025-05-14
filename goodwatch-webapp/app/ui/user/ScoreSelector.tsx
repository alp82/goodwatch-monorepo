import type React from "react"
import { useEffect, useRef, useState } from "react"
import { useUserData } from "~/routes/api.user-data"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import type { Score } from "~/server/scores.server"
import ScoreAction from "~/ui/user/actions/ScoreAction"
import { scoreLabels } from "~/utils/ratings"
import { CheckIcon } from "@heroicons/react/20/solid"
import { XMarkIcon } from "@heroicons/react/24/outline"

interface ScoreSelectorProps {
	details: MovieDetails | TVDetails
	onChange?: (score: Score | null) => void
	onCancel?: () => void
}

export default function ScoreSelector({
	details,
	onChange,
	onCancel,
}: ScoreSelectorProps) {
	const { tmdb_id, media_type } = details

	const { data: userData } = useUserData()

	const userScore = userData?.[media_type]?.[tmdb_id]?.score || null
	const [score, setScore] = useState<Score | null>(userScore)
	const [hoveredScore, setHoveredScore] = useState<Score | null>(null)
	const [clearedScore, setClearedScore] = useState<Score | null>(null)

	useEffect(() => {
		if (score === userScore) return
		setScore(userScore)
	}, [userScore])

	const getColorForIndex = (index: Score | null, withDimming: boolean) => {
		const hovered = index && hoveredScore && index <= hoveredScore
		const scored = index && !hoveredScore && score && index <= score

		if ((hovered || scored) && !clearedScore) {
			const vibeColorIndex = (hoveredScore || score || -1) * 10
			return `bg-vibe-${vibeColorIndex}`
		}

		// Handle the unrated state for desktop explicitly
		// if (!score && !hoveredScore && !clearedScore && withDimming) {
		// 	return "bg-gray-600/70 animate-pulse"
		// }

		// Dimmed background for inactive bars or the base unrated state
		return `bg-vibe-${index * 10}${withDimming ? "/35" : ""}`
	}

	const getLabelColor = (targetScore?: Score | null) => {
		const effectiveScore = targetScore ?? hoveredScore ?? score
		if (effectiveScore && (!clearedScore || effectiveScore !== clearedScore)) {
			const vibeColorIndex = effectiveScore * 10
			return `text-vibe-${vibeColorIndex}`
		}
		return "text-gray-500"
	}

	const getLabelText = (targetScore?: Score | null) => {
		const effectiveScore = targetScore ?? hoveredScore ?? score
		// if (score !== clearedScore || hoveredScore !== clearedScore) {
		if (effectiveScore && (!clearedScore || effectiveScore !== clearedScore)) {
			return `${scoreLabels[effectiveScore]} (${effectiveScore})`
			// return scoreLabels[effectiveScore]
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
	const [startY, setStartY] = useState<number | null>(null)
	const verticalThreshold = 30 // You can adjust this threshold based on your needs

	const [lastTouchedElement, setLastTouchedElement] =
		useState<HTMLElement | null>(null)

	const handleTouchStart = (e: React.TouchEvent) => {
		const touch = e.touches[0]
		setStartY(touch.clientY)
	}

	const containerRef = useRef<HTMLDivElement>(null)
	const handleTouchMove = (e: React.TouchEvent) => {
		const touch = e.touches[0]
		if (!containerRef.current) return

		// Check if vertical movement is above the threshold
		if (startY !== null) {
			const verticalMovement = Math.abs(touch.clientY - startY)
			if (verticalMovement > verticalThreshold) {
				// Cancel further movement handling if threshold is exceeded
				setHoveredScore(null)
				setLastTouchedElement(null)
				return
			}
		}

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

	// marker indicators

	const Markers = ({ mode = "bar" }: { mode?: "bar" | "slider" }) => {
		if (mode === "slider") {
			// 10 markers, spaced evenly, positioned absolutely
			return (
				<div className="relative w-full h-6">
					{Array.from({ length: 10 }, (_, i) => {
						const scoreIndex = i + 1
						return (
							<div
								key={scoreIndex}
								className="absolute flex flex-col items-center"
								style={{
									left: `calc(${i === 9 ? 100 : ((scoreIndex - 1) * 100) / 9}% - 0.5px)`,
									transform:
										i === 0
											? "translateX(0)"
											: i === 9
												? "translateX(-100%)"
												: "translateX(-50%)",
								}}
							>
								<div className="h-2 w-0.5 bg-gray-600" />
								<span
									className={`text-xs font-medium ${getLabelColor(scoreIndex as Score)} transition-colors duration-200`}
								>
									{scoreIndex}
								</span>
							</div>
						)
					})}
				</div>
			)
		}

		// bar mode (desktop)
		return (
			<div className="relative w-full flex h-6 -mt-1">
				{Array.from({ length: 10 }, (_, i) => {
					const scoreIndex = i + 1
					return (
						<div
							key={scoreIndex}
							className="flex-1 flex justify-center items-start"
						>
							<div className="flex flex-col items-center">
								<div className="h-2 w-0.5 bg-gray-600" />
								<span
									className={`text-xs font-medium ${getLabelColor(scoreIndex as Score)} transition-colors duration-200`}
								>
									{scoreIndex}
								</span>
							</div>
						</div>
					)
				})}
			</div>
		)
	}

	return (
		<div
			ref={containerRef}
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
		>
			<div className="px-5 pt-4">
				<div className="h-12 md:h-8 flex items-center justify-end md:justify-between gap-2">
					{/* Desktop: Score Preview */}
					<div className="hidden md:flex items-start xs:items-center flex-col xs:flex-row xs:gap-3">
						<div className="flex items-center gap-2">
							<span className={`font-semibold ${getLabelColor()}`}>
								{getLabelText()}
							</span>
						</div>
					</div>

					{/* User Actions */}
					<span className="w-full md:w-auto flex items-center justify-between gap-4">
						<button
							type="button"
							className="
									flex md:hidden items-center gap-2 px-2 py-1.5
									 bg-slate-950 hover:bg-black rounded-full border-2 border-slate-800 hover:border-slate-700
									 text-slate-300 hover:text-slate-100
									 transition duration-100 cursor-pointer
								"
							onClick={onCancel}
							onKeyDown={() => {}}
						>
							<XMarkIcon className="h-4 w-4" aria-hidden="true" />
						</button>
						<span className="flex items-center gap-2">
							{score && (!hoveredScore || hoveredScore === score) && (
								<ScoreAction details={details} score={null}>
									<span
										className="
											px-2 py-1
											text-red-400 hover:text-red-300 text-xs
											transition duration-100 cursor-pointer
										"
									>
										Remove Score
									</span>
								</ScoreAction>
							)}
							<div
								className={`md:hidden ${userScore === score ? "opacity-50 pointer-events-none" : ""}`}
							>
								<ScoreAction details={details} score={score}>
									<span
										className={`
											flex items-center gap-2 px-2 py-1.5
											bg-amber-950/40 hover:bg-amber-950/20 border-2 rounded-sm border-amber-800 hover:border-amber-700
											text-slate-300 hover:text-slate-100 font-semibold
											transition duration-100 cursor-pointer
										`}
									>
										<CheckIcon className="h-4 w-4" aria-hidden="true" />
										Save
									</span>
								</ScoreAction>
							</div>
						</span>
					</span>
				</div>
			</div>

			<div>
				{/* Mobile: Score Preview*/}
				<div className="md:hidden mt-6 mx-6 flex items-start xs:items-center flex-col xs:flex-row xs:gap-3">
					<div className="flex items-center gap-2">
						<span className={`font-semibold ${getLabelColor()}`}>
							{getLabelText()}
						</span>
					</div>
				</div>
			</div>

			{/* Mobile: Score Slider */}
			<div className="md:hidden flex flex-col items-center px-6 py-8">
				<div className="relative mb-6 w-full flex items-center justify-center">
					<input
						type="range"
						className="w-full h-6 rounded-lg appearance-none bg-gray-700 cursor-grab"
						min={1}
						max={10}
						value={score || 5}
						onChange={(e) => {
							const val = Number.parseInt(e.target.value, 10) as Score
							setScore(val)
							if (onChange) onChange(val)
						}}
					/>
					<div
						className="absolute left-0 top-1/2 transform -translate-y-1/2"
						style={{ width: "100%" }}
					>
						<div
							className={`
								absolute w-14 h-14
								flex items-center justify-center
								rounded-full ${score ? getColorForIndex(score, false) : "bg-gray-500"}
								pointer-events-none cursor-grab
							`}
							style={{
								left: `calc(${((score || 5) - 1) * 11.11}% - 28px)`,
								top: "-28px", // Adjust based on new handle size
							}}
						>
							<span className="text-3xl font-bold text-white drop-shadow-md">
								{score}
							</span>
						</div>
					</div>
				</div>

				<Markers mode="slider" />
			</div>

			{/* Desktop: Score Selector */}
			<div className="hidden md:block pb-8 px-4 transition duration-150 ease-in-out">
				<div className="flex">
					{Array.from({ length: 10 }, (_, i: number) => {
						const scoreIndex = (i + 1) as Score
						return (
							<ScoreAction
								key={i + 1}
								details={details}
								score={scoreIndex === score ? null : scoreIndex}
							>
								<div
									className="w-full py-4 md:py-6 transition duration-100 ease-in-out transform origin-bottom hover:scale-y-125 cursor-pointer group"
									onTouchStart={(event) =>
										handlePointerEnter(event, scoreIndex)
									}
									onMouseEnter={(event) =>
										handlePointerEnter(event, scoreIndex)
									}
									onMouseLeave={handlePointerLeave}
									onClick={() => handleClick(scoreIndex)}
									onKeyUp={() => null}
								>
									<div
										className={`h-8 w-full border-2 border-gray-800 rounded-md transition-all duration-100 group-hover:border-gray-600 ${getColorForIndex(
											scoreIndex,
											true,
										)}`}
									/>
								</div>
							</ScoreAction>
						)
					})}
				</div>
				<Markers mode="bar" />
			</div>
		</div>
	)
}
