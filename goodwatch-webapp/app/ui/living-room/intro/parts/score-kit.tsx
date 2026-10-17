// What the score and pick scenes share: the five numbers, the score title, the ring's end frame, timing helpers.
import type { CSSProperties, ReactNode } from "react"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogo from "~/img/metacritic-logo-icon-64.webp"
import rottenLogo from "~/img/rotten-logo-icon-64.webp"
import type { ScoreData } from "~/ui/living-room/intro/data"
import type { IntroCard } from "~/ui/living-room/intro/data"
import {
	score,
	verdictOf,
	vibeColor,
} from "~/ui/living-room/intro/parts/source-kit"
import type { IntroData } from "~/ui/living-room/intro/scene"
import { goodwatchScoreDisplay } from "~/utils/ratings"
import { tmdbImageUrl } from "~/utils/tmdb-image"

export { score, verdictOf, vibeColor }

/**
 * The GoodWatch ring as the details page draws it, with the number arriving when the arc has filled:
 * `fillAt` starts the arc, `numberAt` brings the number in.
 */
export function Ring({
	percent,
	fillAt,
	numberAt,
}: { percent: number; fillAt?: number; numberAt?: number }) {
	const value = goodwatchScoreDisplay(percent)
	const r = 45.5
	const c = 2 * Math.PI * r
	const len = (value / 100) * c
	return (
		<div className="intro-source-ring">
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
			<span
				className={`intro-source-ring-n ${numberAt !== undefined ? "intro-score-pop" : ""}`}
				style={numberAt !== undefined ? at(numberAt, 700) : undefined}
			>
				{value}
			</span>
		</div>
	)
}

/** Delay and duration for an `intro-score-*` move, in ms at k = 1. */
export const at = (
	d: number,
	dur?: number,
	extra?: CSSProperties,
): CSSProperties =>
	({
		"--d": `${d}ms`,
		...(dur ? { "--dur": `${dur}ms` } : {}),
		...extra,
	}) as CSSProperties

export const poster = (path: string | null, size = "w342") =>
	path ? tmdbImageUrl(path, size) : ""
export const extraOf = (data: IntroData) =>
	(data.extra.score ?? null) as ScoreData | null

export type Source = {
	id: string
	logo: string
	n: string
	unit: string
	label: string
	wide?: boolean
}

/** The score chapter's title: the best-known pool title other than the hero with all five numbers. */
export function scoreTitle(data: IntroData) {
	const extra = extraOf(data)
	const full = (c: IntroCard) => {
		const s = extra?.sources.find((x) => x.key === c.key)
		return Boolean(
			s &&
				s.imdb != null &&
				s.tomatometer != null &&
				s.rtAudience != null &&
				s.metacritic != null &&
				s.metacriticUser != null,
		)
	}
	const card =
		data.pool.slice(1).find((c) => full(c) && score(c) >= 80) ??
		data.pool[1] ??
		data.pool[0]
	const s = extra?.sources.find((x) => x.key === card?.key) ?? null
	const fmt = (v: number | null | undefined, unit = "") =>
		v == null ? "–" : `${v}${unit}`
	const sources: Source[] = [
		{
			id: "imdb",
			logo: imdbLogo,
			n: fmt(s?.imdb),
			unit: "/10",
			label: "IMDb",
			wide: true,
		},
		{
			id: "rt",
			logo: rottenLogo,
			n: fmt(s?.tomatometer),
			unit: "%",
			label: "Critics",
		},
		{
			id: "rta",
			logo: rottenLogo,
			n: fmt(s?.rtAudience),
			unit: "%",
			label: "Audience",
		},
		{
			id: "mc",
			logo: metacriticLogo,
			n: fmt(s?.metacritic),
			unit: "",
			label: "Critics",
		},
		{
			id: "mcu",
			logo: metacriticLogo,
			n: fmt(s?.metacriticUser),
			unit: "/10",
			label: "Users",
		},
	]
	return { card, sources }
}

/**
 * The hand-over frame between "One score" and "Picked for you": the title, "One score.", the full ring, the verdict.
 * The score scene ends on it. `parts` wraps each piece so a scene can animate it.
 */
export function RingEnd({
	card,
	wrap = (_k, n) => n,
	fillAt,
}: {
	card: IntroCard
	wrap?: (
		key: "kick" | "head" | "ring" | "verdict",
		node: ReactNode,
	) => ReactNode
	fillAt?: number
}) {
	const numberAt = fillAt !== undefined ? fillAt + 1100 : undefined
	return (
		<>
			{wrap(
				"kick",
				<div className="intro-score-kick intro-score-at-kick">
					{card.title}
				</div>,
			)}
			{wrap(
				"head",
				<div className="intro-score-head intro-score-at-head">
					One <span className="intro-score-amber">score.</span>
				</div>,
			)}
			{wrap(
				"ring",
				<div className="intro-score-at-ring">
					<Ring percent={score(card)} fillAt={fillAt} numberAt={numberAt} />
				</div>,
			)}
			{wrap(
				"verdict",
				<div
					className="intro-score-verdict intro-score-at-verdict"
					style={{ color: vibeColor(score(card)) }}
				>
					{verdictOf(score(card))}.
				</div>,
			)}
		</>
	)
}

/** A full-stage layer: wrappers that animate a piece without touching its own place. */
export const Layer = ({
	className = "",
	style,
	children,
}: { className?: string; style?: CSSProperties; children: ReactNode }) => (
	<div className={`intro-score-layer ${className}`} style={style}>
		{children}
	</div>
)
