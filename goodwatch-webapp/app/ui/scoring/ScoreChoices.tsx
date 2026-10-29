import type { CSSProperties, ReactNode } from "react"
import type { Score } from "~/server/scores.server"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
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

/**
 * How the four levels and the ten scores stand: `grid`, the levels over their scores in two rows (the web's);
 * `band`, the same, each level joined to its scores with no gap between the rows, as one band of four parts (the
 * phone's TV).
 */
export type ScoreLayout = "grid" | "band"

/**
 * The chosen choice: the score's full color and white text, with one clean inner edge in a lighter tint of the same
 * color. Unmistakable next to the resting keys, which stay a dim tint of their color, without a second ring.
 */
export const pickedChoiceStyle = (color: string): CSSProperties => ({
	color: "#fff",
	background: color,
	boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${color} 45%, #fff)`,
	textShadow: "0 1px 2px rgb(0 0 0 / 0.45)",
})

/**
 * The shared word/number layout. Each choice carries its color as `--score-color` and its hover fill as
 * `--score-hover`, so a renderer can light the pointed or focused key in its own color (ScoreControl does). `hot`, the
 * level pointed at or focused, lights that level and its numbers a step brighter than rest. TV supplies its registered remote keys; web supplies ordinary buttons. */
export function ScoreChoices({
	value,
	hot,
	renderChoice,
	className = "",
	disabled = false,
	acknowledged = false,
	layout = "grid",
}: {
	value: Score | null
	hot: number | null
	renderChoice: (choice: ScoreChoice) => ReactNode
	className?: string
	disabled?: boolean
	/** `value` is an answer just given (score-ack.ts): its choices light. */
	acknowledged?: boolean
	layout?: ScoreLayout
}) {
	const mine = value == null ? -1 : levelOf(value)
	const levels = RATING_LEVELS.map((level, i) => {
		const color = getVibeColorValue(level.score)
		const lit = hot === i
		return renderChoice({
			id: `level:${level.score}`,
			score: level.score,
			level: i,
			kind: "level",
			label: `${level.name} ${level.lo}–${level.hi}. Give ${level.score}`,
			selected: mine === i,
			acknowledged: acknowledged && mine === i,
			style: {
				gridColumn: `span ${level.hi - level.lo + 1}`,
				borderTop: `3px solid ${color}`,
				"--score-color": color,
				"--score-hover": `color-mix(in srgb, ${color} 70%, #22201f)`,
				background: lit
					? `color-mix(in srgb, ${color} 38%, #2b2a29)`
					: "#343333",
				...(mine === i ? pickedChoiceStyle(color) : {}),
			} as CSSProperties,
			children: (
				<>
					<span>{level.name}</span>
					<span
						data-score-range
						className="hidden whitespace-nowrap text-[10px] font-normal text-white/65 @lg:inline"
					>
						{level.lo}–{level.hi}
					</span>
				</>
			),
		})
	})
	const scores = SCORES.map((score) => {
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
				"--score-color": color,
				"--score-hover": `color-mix(in srgb, ${color} 80%, #181b20)`,
				background: `color-mix(in srgb, ${color} ${lit ? 50 : 25}%, #181b20)`,
				...(selected ? pickedChoiceStyle(color) : {}),
			} as CSSProperties,
			children: score,
		})
	})
	return (
		<fieldset
			disabled={disabled}
			className={`grid grid-cols-10 ${layout === "band" ? "gap-x-1 gap-y-0" : "gap-1 @lg:gap-1.5"} ${className}`}
			style={{ gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}
		>
			<legend className="sr-only">Your score</legend>
			{levels}
			{scores}
		</fieldset>
	)
}
