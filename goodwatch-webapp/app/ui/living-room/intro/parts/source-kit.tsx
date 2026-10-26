// Helpers the score scenes share: timing styles and the GoodWatch ring drawn at stage size.
import type { CSSProperties } from "react"
import type { IntroCard } from "~/ui/living-room/intro/data"
import type { SourceData } from "~/ui/living-room/intro/data"
import type { IntroData } from "~/ui/living-room/intro/scene"
import {
	goodwatchScoreDisplay,
	goodwatchVibeIndex,
	scoreWord,
} from "~/utils/ratings"
import { tmdbImageUrl } from "~/utils/tmdb-image"

/** Delay (and optionally duration) for an `intro-source-*` animation, in ms at k = 1. */
export const at = (d: number, dur?: number): CSSProperties =>
	({
		"--d": `${d}ms`,
		...(dur ? { "--dur": `${dur}ms` } : {}),
	}) as CSSProperties

export const poster = (path: string | null, size = "w342") =>
	path ? tmdbImageUrl(path, size) : ""
export const logo = (path: string) => tmdbImageUrl(path, "w154")

export const extraOf = (data: IntroData) =>
	(data.extra.sources ?? null) as SourceData | null
export const verdictOf = (percent: number) =>
	scoreWord(goodwatchScoreDisplay(percent))
export const vibeColor = (percent: number) =>
	`var(--color-vibe-${goodwatchVibeIndex(percent)})`
export const score = (c: IntroCard) =>
	c.goodwatch_overall_score_normalized_percent ?? 0

/**
 * The GoodWatch score ring, as the details page draws it (ScoreRing.tsx), scaled to its box: `fill` animates the arc
 * from empty from delay `fillAt` (the one paint animation of these scenes: a small SVG stroke).
 */
export function Ring({
	percent,
	className = "",
	fillAt,
}: { percent: number; className?: string; fillAt?: number }) {
	const value = goodwatchScoreDisplay(percent)
	const r = 45.5
	const c = 2 * Math.PI * r
	const len = (value / 100) * c
	return (
		<div className={`intro-source-ring ${className}`}>
			<svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden="true">
				<circle
					cx="50"
					cy="50"
					r={r}
					fill="none"
					stroke="rgba(255,255,255,.12)"
					strokeWidth="9"
				/>
				<circle
					cx="50"
					cy="50"
					r={r}
					fill="none"
					stroke={vibeColor(percent)}
					strokeWidth="9"
					strokeLinecap="round"
					strokeDasharray={`${len} ${c}`}
					className={fillAt !== undefined ? "intro-source-fill" : undefined}
					style={
						fillAt !== undefined
							? ({ ...at(fillAt), "--len": len } as CSSProperties)
							: undefined
					}
				/>
			</svg>
			<span className="intro-source-ring-n">{value}</span>
		</div>
	)
}
