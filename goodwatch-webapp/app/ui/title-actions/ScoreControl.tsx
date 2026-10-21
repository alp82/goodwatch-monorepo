import { useState } from "react"
import type { Score } from "~/server/scores.server"
import { ScoreChoices } from "~/ui/scoring/ScoreChoices"
import { getScoreLabelText, scoreLabels } from "~/utils/ratings"

export interface ScoreControlProps {
	value?: Score | null
	onRate: (score: Score) => void
	onClear?: () => void
	/** Retained for prototype callers; every production picker now sizes to its available width. */
	size?: "full" | "compact"
	fit?: "screen" | "box"
	busy?: boolean
	/** `value` is an answer just given and held (ui/scoring/score-ack.ts): its choices light. */
	acknowledged?: boolean
}

/** Four words above all ten exact scores, on phones as well as wide screens. */
export function ScoreControl({
	value = null,
	onRate,
	onClear,
	busy = false,
	acknowledged = false,
}: ScoreControlProps) {
	const [hot, setHot] = useState<number | null>(null)
	return (
		<div className="@container" onMouseLeave={() => setHot(null)}>
			{onClear && (
				<div className="mb-3 flex min-h-6 items-baseline justify-between gap-3">
					<p className="text-sm text-gray-400">
						{value ? (
							<>
								Your score:{" "}
								<strong className="text-white">
									{getScoreLabelText(value)}
								</strong>
							</>
						) : (
							scoreLabels[0]
						)}
					</p>
					{value && (
						<button
							type="button"
							data-clear-score
							disabled={busy}
							onClick={onClear}
							className="cursor-pointer text-xs text-gray-400 underline underline-offset-2 hover:text-white disabled:opacity-50"
						>
							Clear score
						</button>
					)}
				</div>
			)}
			<ScoreChoices
				value={value}
				hot={hot}
				disabled={busy}
				acknowledged={acknowledged}
				className={busy ? "opacity-70" : ""}
				renderChoice={(choice) => (
					<button
						key={choice.id}
						type="button"
						data-give={choice.kind === "score" ? choice.score : undefined}
						disabled={busy}
						aria-label={choice.label}
						aria-pressed={choice.selected}
						onClick={() => onRate(choice.score)}
						onMouseEnter={() => setHot(choice.level)}
						onFocus={() => setHot(choice.level)}
						style={choice.style}
						className={`${choice.acknowledged ? "score-ack" : ""} flex min-w-0 cursor-pointer items-center justify-center gap-1.5 font-extrabold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait ${choice.kind === "level" ? "h-14 rounded-xl text-[11px] @lg:h-16 @lg:text-sm @xl:text-base" : "h-11 rounded-md text-xs tabular-nums @lg:h-12 @lg:text-sm"}`}
					>
						{choice.children}
					</button>
				)}
			/>
		</div>
	)
}
