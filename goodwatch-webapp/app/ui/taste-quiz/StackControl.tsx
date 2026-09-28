import { useState } from "react"
import type { Score } from "~/server/scores.server"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { RATING_LEVELS, levelOf } from "./quiz-flow"

const SCORES = Array.from({ length: 10 }, (_, i) => (i + 1) as Score)

/**
 * The rating control: Dislike / Okay / Good / Excellent, each spanning its own scores, over a 1-10 strip at a third
 * of their height. A level press stores the level's score (3, 5, 7, or 9); a strip press stores the exact score.
 */
export function StackControl({ onRate }: { onRate: (score: Score) => void }) {
	const [hot, setHot] = useState<number | null>(null)
	return (
		<fieldset
			className="grid grid-cols-10 gap-1 sm:gap-1.5"
			onMouseLeave={() => setHot(null)}
		>
			<legend className="sr-only">Your score</legend>
			{RATING_LEVELS.map((level, i) => (
				<button
					key={level.name}
					type="button"
					onClick={() => onRate(level.score)}
					onMouseEnter={() => setHot(i)}
					onFocus={() => setHot(i)}
					aria-label={`${level.name}, ${level.score}`}
					className={`flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gray-800 px-1 text-left ring-2 transition hover:bg-gray-700 focus-visible:outline-none sm:h-16 sm:justify-start sm:px-3 ${hot === i ? "ring-amber-400" : "ring-transparent"}`}
					style={{ gridColumn: `span ${level.hi - level.lo + 1}` }}
				>
					<span
						className="hidden h-7 w-1.5 shrink-0 rounded-full sm:block"
						style={{ background: getVibeColorValue(level.score) }}
					/>
					<span className="text-xs font-extrabold sm:text-lg">
						{level.name}
					</span>
					<span className="ml-auto hidden text-[11px] tabular-nums text-gray-500 md:inline">
						{level.lo}–{level.hi}
					</span>
				</button>
			))}
			{SCORES.map((score) => {
				const on = hot != null && levelOf(score) === hot
				const off = hot != null && !on
				return (
					<button
						key={score}
						type="button"
						onClick={() => onRate(score)}
						onFocus={() => setHot(levelOf(score))}
						onMouseEnter={() => setHot(levelOf(score))}
						aria-label={`${score}, ${scoreLabels[score]}`}
						title={`${score} · ${scoreLabels[score]}`}
						className={`flex h-5 cursor-pointer items-center justify-center rounded-md text-xs font-black tabular-nums transition hover:scale-110 hover:text-gray-950 focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-amber-400 sm:h-5 ${on ? "text-white" : off ? "text-white/35" : "text-white/75"}`}
						style={{
							background: `${getVibeColorValue(score)}${on ? "77" : off ? "22" : "44"}`,
						}}
					>
						{score}
					</button>
				)
			})}
		</fieldset>
	)
}
