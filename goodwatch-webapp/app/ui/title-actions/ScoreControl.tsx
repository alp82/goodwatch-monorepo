import { useState } from "react"
import type { Score } from "~/server/scores.server"
import { RATING_LEVELS, levelOf } from "~/ui/taste-quiz/quiz-flow"
import { getScoreLabelText, getVibeColorValue, scoreLabels } from "~/utils/ratings"

const SCORES = Array.from({ length: 10 }, (_, i) => (i + 1) as Score)

// The roomy look of the level buttons (taller, a color bar, larger names, the score range). The taste quiz switches to
// it by screen width; everywhere else the control sits in boxes of any width, so its own width decides.
const ROOMY = {
	screen: {
		gap: "sm:gap-1.5",
		level: "sm:h-16 sm:justify-start sm:px-3",
		bar: "sm:block",
		name: "sm:text-lg",
		range: "md:inline",
	},
	box: {
		gap: "@2xl:gap-1.5",
		level: "@2xl:h-16 @2xl:justify-start @2xl:px-3",
		bar: "@2xl:block",
		name: "@2xl:text-lg",
		range: "@4xl:inline",
	},
} as const

export interface ScoreControlProps {
	/** The person's score for the title. The taste quiz leaves it out: there every title is new. */
	value?: Score | null
	onRate: (score: Score) => void
	/** With it, the control names the current score above the buttons and offers "Clear score". */
	onClear?: () => void
	/** "compact" for popups: shorter level buttons, names only. */
	size?: "full" | "compact"
	/** What switches "full" to its roomy look: the screen's width (the taste quiz) or the control's own. */
	fit?: keyof typeof ROOMY
	/** While a score is being saved. */
	busy?: boolean
}

/**
 * The score control: Dislike / Okay / Good / Excellent, each spanning its own scores, over a 1-10 strip at a third of
 * their height. A level press gives the level's score (3, 5, 7, or 9); a strip press gives the exact score.
 */
export function ScoreControl({
	value = null,
	onRate,
	onClear,
	size = "full",
	fit = "box",
	busy = false,
}: ScoreControlProps) {
	const [hot, setHot] = useState<number | null>(null)
	const mine = value == null ? null : levelOf(value)
	const full = size === "full"
	const roomy = ROOMY[fit]
	return (
		<div className={fit === "box" ? "@container" : undefined}>
			{onClear && (
				<div className="mb-2 flex min-h-5 items-baseline justify-between gap-3">
					<p className={`font-semibold ${full ? "text-sm" : "text-xs"} text-gray-400`}>
						{value ? (
							<>
								Your score:{" "}
								<span style={{ color: getVibeColorValue(value) }}>{getScoreLabelText(value)}</span>
							</>
						) : (
							scoreLabels[0]
						)}
					</p>
					{value && (
						<button
							type="button"
							onClick={onClear}
							disabled={busy}
							className="shrink-0 cursor-pointer text-xs text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white"
						>
							Clear score
						</button>
					)}
				</div>
			)}
			<fieldset
				className={`grid grid-cols-10 gap-1 ${full ? roomy.gap : ""} ${busy ? "pointer-events-none opacity-70" : ""}`}
				onMouseLeave={() => setHot(null)}
			>
				<legend className="sr-only">Your score</legend>
				{RATING_LEVELS.map((level, i) => {
					const on = mine === i
					const color = getVibeColorValue(level.score)
					return (
						<button
							key={level.name}
							type="button"
							onClick={() => onRate(level.score)}
							onMouseEnter={() => setHot(i)}
							onFocus={() => setHot(i)}
							aria-label={`${level.name}, ${level.score}`}
							aria-pressed={onClear ? on : undefined}
							className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl text-left ring-2 transition focus-visible:outline-none ${
								full ? `h-14 px-1 ${roomy.level}` : "h-9 px-0.5"
							} ${on ? "" : "bg-gray-800 hover:bg-gray-700"} ${hot === i ? "ring-amber-400" : "ring-transparent"}`}
							style={{
								gridColumn: `span ${level.hi - level.lo + 1}`,
								...(on ? { background: `${color}55`, boxShadow: `inset 0 0 0 2px ${color}` } : {}),
							}}
						>
							{full && (
								<span
									className={`hidden h-7 w-1.5 shrink-0 rounded-full ${roomy.bar}`}
									style={{ background: color }}
								/>
							)}
							<span className={full ? `text-xs font-extrabold ${roomy.name}` : "text-[11px] font-extrabold"}>
								{level.name}
							</span>
							{full && (
								<span className={`ml-auto hidden text-[11px] tabular-nums text-gray-500 ${roomy.range}`}>
									{level.lo}–{level.hi}
								</span>
							)}
						</button>
					)
				})}
				{SCORES.map((score) => {
					const picked = value === score
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
							aria-pressed={onClear ? picked : undefined}
							title={`${score} · ${scoreLabels[score]}`}
							className={`flex h-5 cursor-pointer items-center justify-center rounded-md text-xs font-black tabular-nums transition hover:scale-110 hover:text-gray-950 focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-amber-400 ${
								picked
									? "scale-110 text-gray-950 ring-2 ring-white"
									: on
										? "text-white"
										: off
											? "text-white/35"
											: "text-white/75"
							}`}
							style={{
								background: `${getVibeColorValue(score)}${picked ? "" : on ? "77" : off ? "22" : "44"}`,
							}}
						>
							{score}
						</button>
					)
				})}
			</fieldset>
		</div>
	)
}
