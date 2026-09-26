import React from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { goodwatchScoreDisplay, goodwatchVibeIndex, scoreLabels } from "~/utils/ratings"

// The GoodWatch score as a ring filled to the score. With `label` its verdict word and caption
// sit beside it; without, the ring carries them as its accessible name and tooltip.
export default function ScoreRing({ media, size = 56, label = true }: { media: MovieResult | ShowResult; size?: number; label?: boolean }) {
	const percent = media.details.goodwatch_overall_score_normalized_percent
	const score = percent ? goodwatchScoreDisplay(percent) : null
	const vibe = percent ? goodwatchVibeIndex(percent) : null
	const verdict = score == null ? "Not rated yet" : scoreLabels[Math.max(1, Math.round(score / 10))]
	const stroke = size / 11
	const r = (size - stroke) / 2
	const c = 2 * Math.PI * r
	const ring = (
		<div className="relative shrink-0" style={{ width: size, height: size }}>
			<svg width={size} height={size} className="-rotate-90" aria-hidden="true">
				<circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={stroke} />
				{score != null && (
					<circle
						cx={size / 2}
						cy={size / 2}
						r={r}
						fill="none"
						stroke={`var(--color-vibe-${vibe})`}
						strokeWidth={stroke}
						strokeLinecap="round"
						strokeDasharray={`${(score / 100) * c} ${c}`}
					/>
				)}
			</svg>
			<span aria-hidden={!label} className="absolute inset-0 flex items-center justify-center font-bold tabular-nums" style={{ fontSize: size * 0.36 }}>
				{score ?? "–"}
			</span>
		</div>
	)
	if (!label) {
		const name = score == null ? "GoodWatch score: not rated yet" : `GoodWatch score ${score} of 100, ${verdict}`
		return (
			<div role="img" aria-label={name} title={name} className="shrink-0">
				{ring}
			</div>
		)
	}
	return (
		<div className="flex items-center gap-2.5" title="GoodWatch score: critics and audiences combined">
			{ring}
			<span className="flex flex-col leading-tight">
				<span className="text-base font-semibold" style={vibe == null ? undefined : { color: `var(--color-vibe-${vibe})` }}>
					{verdict}
				</span>
				<span className="text-xs text-gray-300">GoodWatch score</span>
			</span>
		</div>
	)
}
