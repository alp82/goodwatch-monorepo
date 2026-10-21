import type { CSSProperties, ReactNode } from "react"
import type { Score } from "~/server/scores.server"
import {
	getVibeColorValue,
	scoreLabels,
	selectedScoreStyle,
} from "~/utils/ratings"
import { RATING_LEVELS, SCORES, levelOf } from "./score-model"

export interface ScoreChoice {
	id: string
	score: Score
	level: number
	kind: "level" | "score"
	label: string
	selected: boolean
	/**
	 * The answer just given and held (score-ack.ts): the chosen choices light with the `score-ack` class of main.css.
	 * A level lights with the score it gives.
	 */
	acknowledged: boolean
	style: CSSProperties
	children: ReactNode
}

/** The shared word/number layout. TV supplies its registered remote keys; web supplies ordinary buttons. */
export function ScoreChoices({
	value,
	hot,
	renderChoice,
	className = "",
	disabled = false,
	acknowledged = false,
}: {
	value: Score | null
	hot: number | null
	renderChoice: (choice: ScoreChoice) => ReactNode
	className?: string
	disabled?: boolean
	/** `value` is an answer just given (score-ack.ts): its choices light. */
	acknowledged?: boolean
}) {
	const mine = value == null ? -1 : levelOf(value)
	return (
		<fieldset
			disabled={disabled}
			className={`grid grid-cols-10 gap-1 @lg:gap-1.5 ${className}`}
			style={{ gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}
		>
			<legend className="sr-only">Your score</legend>
			{RATING_LEVELS.map((level, i) => {
				const color = getVibeColorValue(level.score)
				return renderChoice({
					id: `level:${level.score}`,
					score: level.score,
					level: i,
					kind: "level",
					label: `${level.name}, ${level.score}`,
					selected: mine === i,
					acknowledged: acknowledged && mine === i,
					style: {
						gridColumn: `span ${level.hi - level.lo + 1}`,
						borderTop: `3px solid ${color}`,
						background:
							mine === i
								? `color-mix(in srgb, ${color} 35%, #22201f)`
								: "#343333",
						...(mine === i
							? {
									boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 70%, white)`,
								}
							: {}),
					},
					children: (
						<>
							<span>{level.name}</span>
							<span data-score-range className="hidden whitespace-nowrap text-[10px] font-normal text-white/65 @lg:inline">
								{level.lo}–{level.hi}
							</span>
						</>
					),
				})
			})}
			{SCORES.map((score) => {
				const color = getVibeColorValue(score)
				const selected = value === score
				const lit = hot === levelOf(score)
				return renderChoice({
					id: `score:${score}`,
					score,
					level: levelOf(score),
					kind: "score",
					label: `${score}, ${scoreLabels[score]}`,
					selected,
					acknowledged: acknowledged && selected,
					style: {
						color: "#fff",
						background: `color-mix(in srgb, ${color} ${selected ? 42 : lit ? 35 : 25}%, #181b20)`,
						...(selected ? selectedScoreStyle(score) : {}),
					},
					children: score,
				})
			})}
		</fieldset>
	)
}
