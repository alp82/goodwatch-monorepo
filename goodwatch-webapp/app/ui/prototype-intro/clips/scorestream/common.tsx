// PROTOTYPE - throwaway. Helpers the score and streaming clips share: timing styles, the GoodWatch ring drawn to
// fill its box (the details page's ScoreRing, by container units), word-by-word headlines, and the data.
import type { CSSProperties, ReactNode } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import type { ScoreStreamData } from "~/server/prototype-intro/scorestream.server"
import { goodwatchScoreDisplay, goodwatchVibeIndex, scoreLabels } from "~/utils/ratings"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { IntroData } from "../../clip"

/** Delay (and optionally duration) for an `lpc-ss-*` animation, in ms at k = 1. */
export const at = (d: number, dur?: number): CSSProperties =>
	({ "--d": `${d}ms`, ...(dur ? { "--dur": `${dur}ms` } : {}) }) as CSSProperties

export const poster = (path: string | null, size = "w342") => (path ? tmdbImageUrl(path, size) : "")
export const backdrop = (path: string | null) => (path ? tmdbImageUrl(path, "w1280") : "")
export const logo = (path: string) => tmdbImageUrl(path, "w154")

export const extraOf = (data: IntroData) => (data.extra.scorestream ?? null) as ScoreStreamData | null
export const verdictOf = (percent: number) => scoreLabels[Math.max(1, Math.round(goodwatchScoreDisplay(percent) / 10))]
export const vibeColor = (percent: number) => `var(--color-vibe-${goodwatchVibeIndex(percent)})`
export const score = (c: LandingCard) => c.goodwatch_overall_score_normalized_percent ?? 0

/** The best-known card: the most votes. */
export const bestKnown = (cards: LandingCard[], ok: (c: LandingCard) => boolean = () => true) =>
	[...cards].filter(ok).sort((a, b) => (b.goodwatch_overall_score_voting_count ?? 0) - (a.goodwatch_overall_score_voting_count ?? 0))[0] ??
	cards[0]

/** One brand per tile: add-on channels and repeats go. */
export function brands<T extends { name: string }>(list: T[]): T[] {
	const seen = new Set<string>()
	const brand = (name: string) =>
		name
			.toLowerCase()
			.replace(/[^a-z]/g, "")
			.replace(/(plus|premium|amazonchannel|channels?|withads|freewithads|standard|basic)$/g, "")
			.replace(/^amazonprimevideo/, "primevideo")
	return list.filter((s) => {
		if (/channel/i.test(s.name)) return false
		const b = brand(s.name)
		if (seen.has(b)) return false
		seen.add(b)
		return true
	})
}

/**
 * The GoodWatch score ring, as the details page draws it (ScoreRing.tsx), scaled to its box: `fill` animates the arc
 * from empty from delay `fillAt` (the one paint animation of these clips: a small SVG stroke).
 */
export function Ring({ percent, className = "", fillAt }: { percent: number; className?: string; fillAt?: number }) {
	const value = goodwatchScoreDisplay(percent)
	const r = 45.5
	const c = 2 * Math.PI * r
	const len = (value / 100) * c
	return (
		<div className={`lpc-ss-ring ${className}`}>
			<svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden="true">
				<circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="9" />
				<circle
					cx="50"
					cy="50"
					r={r}
					fill="none"
					stroke={vibeColor(percent)}
					strokeWidth="9"
					strokeLinecap="round"
					strokeDasharray={`${len} ${c}`}
					className={fillAt !== undefined ? "lpc-ss-fill" : undefined}
					style={fillAt !== undefined ? ({ ...at(fillAt), "--len": len } as CSSProperties) : undefined}
				/>
			</svg>
			<span className="lpc-ss-ring-n">{value}</span>
		</div>
	)
}

/** A headline whose words rise one after another from `from`, `step` apart. */
export function Words({ text, from = 0, step = 160, className = "", accent }: { text: string; from?: number; step?: number; className?: string; accent?: string }) {
	return (
		<span className={className}>
			{text.split(" ").map((w, i) => (
				<span key={`${w}-${i}`} className={`lpc-ss-word lpc-ss-rise ${w === accent ? "lpc-ss-amber" : ""}`} style={at(from + i * step, 800)}>
					{w}
					{i < text.split(" ").length - 1 ? " " : ""}
				</span>
			))}
		</span>
	)
}

/** The clips' root: fills the stage, one look for every clip of the group. */
export const Frame = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
	<div className={`lpc-ss ${className}`}>{children}</div>
)
