// PROTOTYPE - throwaway. What the round 5 score and pick clips share: the five numbers, the score title, the
// orbit, and the hand-over frame between the two chapters (RingEnd).
import type { CSSProperties, ReactNode } from "react"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogo from "~/img/metacritic-logo-icon-64.webp"
import rottenLogo from "~/img/rotten-logo-icon-64.webp"
import type { R5ScoreData } from "~/server/prototype-intro/r5score.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { IntroData } from "../../clip"
import { goodwatchScoreDisplay } from "~/utils/ratings"
import { score, verdictOf, vibeColor } from "../scorestream/common"
import "../scorestream.css"

export { score, verdictOf, vibeColor }

/**
 * The GoodWatch ring as the details page draws it (round 4's Ring), with the number arriving when the arc has filled:
 * `fillAt` starts the arc, `numberAt` brings the number in.
 */
export function Ring({ percent, fillAt, numberAt }: { percent: number; fillAt?: number; numberAt?: number }) {
	const value = goodwatchScoreDisplay(percent)
	const r = 45.5
	const c = 2 * Math.PI * r
	const len = (value / 100) * c
	return (
		<div className="lpc-ss-ring">
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
			<span className={`lpc-ss-ring-n ${numberAt !== undefined ? "lpc-r5score-pop" : ""}`} style={numberAt !== undefined ? at(numberAt, 700) : undefined}>
				{value}
			</span>
		</div>
	)
}

/** Delay and duration for an `lpc-r5score-*` move, in ms at k = 1. */
export const at = (d: number, dur?: number, extra?: CSSProperties): CSSProperties =>
	({ "--d": `${d}ms`, ...(dur ? { "--dur": `${dur}ms` } : {}), ...extra }) as CSSProperties

export const poster = (path: string | null, size = "w342") => (path ? tmdbImageUrl(path, size) : "")
export const extraOf = (data: IntroData) => (data.extra.r5score ?? null) as R5ScoreData | null

export type Source = { id: string; logo: string; n: string; unit: string; label: string; wide?: boolean }

/** The score chapter's title: the best-known pool title other than the hero with all five numbers. */
export function scoreTitle(data: IntroData) {
	const extra = extraOf(data)
	const full = (c: LandingCard) => {
		const s = extra?.sources.find((x) => x.key === c.key)
		return Boolean(s && s.imdb != null && s.tomatometer != null && s.rtAudience != null && s.metacritic != null && s.metacriticUser != null)
	}
	const card = data.pool.slice(1).find((c) => full(c) && score(c) >= 80) ?? data.pool[1] ?? data.pool[0]
	const s = extra?.sources.find((x) => x.key === card?.key) ?? null
	const fmt = (v: number | null | undefined, unit = "") => (v == null ? "–" : `${v}${unit}`)
	const sources: Source[] = [
		{ id: "imdb", logo: imdbLogo, n: fmt(s?.imdb), unit: "/10", label: "IMDb", wide: true },
		{ id: "rt", logo: rottenLogo, n: fmt(s?.tomatometer), unit: "%", label: "Critics" },
		{ id: "rta", logo: rottenLogo, n: fmt(s?.rtAudience), unit: "%", label: "Audience" },
		{ id: "mc", logo: metacriticLogo, n: fmt(s?.metacritic), unit: "", label: "Critics" },
		{ id: "mcu", logo: metacriticLogo, n: fmt(s?.metacriticUser), unit: "/10", label: "Users" },
	]
	return { card, sources }
}

/** A source chip: logo, number, who it speaks for. */
export function Chip({ s, className = "", style }: { s: Source; className?: string; style?: CSSProperties }) {
	return (
		<div className={`lpc-r5score-chip ${className}`} style={style}>
			<img src={s.logo} alt="" className={s.wide ? "lpc-r5score-chip-wide" : undefined} />
			<div className="lpc-r5score-chip-n">
				{s.n}
				{s.n !== "–" && <small>{s.unit}</small>}
			</div>
			<div className="lpc-r5score-chip-l">{s.label}</div>
		</div>
	)
}

// The orbit: an ellipse around the ring's centre (50cqw, 48cqh), squashed by SQUASH. Positions in cqw.
export const ORBIT_R = 40
export const SQUASH = 0.36
const CQH_PER_CQW = 16 / 9 // on the 16:9 stage
export const angleOf = (i: number, n = 5) => -90 + (i * 360) / n
/** Where chip `i` sits on the orbit after turning `turned` degrees, relative to the centre, in cqw (x) and cqh (y). */
export function orbitPos(i: number, n = 5, turned = 0) {
	const a = ((angleOf(i, n) + turned) * Math.PI) / 180
	return { x: ORBIT_R * Math.cos(a), y: ORBIT_R * Math.sin(a) * SQUASH * CQH_PER_CQW }
}

/**
 * Five chips on the orbit, turning from `spinAt` for `spinMs` by `turn` degrees. Each chip's own wrapper can carry
 * an entrance (`enter(i)`), and the whole orbit leaves from `leaveAt`.
 */
export function Orbit({
	sources,
	spinAt,
	spinMs,
	turn = 110,
	leaveAt,
	enter,
}: {
	sources: Source[]
	spinAt: number
	spinMs: number
	turn?: number
	leaveAt: number
	enter: (i: number) => { className: string; style: CSSProperties; inner?: { className: string; style: CSSProperties } }
}) {
	const spin = at(spinAt, spinMs, { "--turn": `${turn}deg` } as CSSProperties)
	return (
		<div className="lpc-r5score-orbit lpc-r5score-fadeout" style={at(leaveAt, 700)}>
			<div className="lpc-r5score-squash">
				<div className="lpc-r5score-spin" style={spin}>
					{sources.map((s, i) => {
						const a = angleOf(i)
						const e = enter(i)
						return (
							<div key={s.id} className="lpc-r5score-arm" style={{ transform: `rotate(${a}deg)` }}>
								<div style={{ transform: `translateX(${ORBIT_R}cqw) rotate(${-a}deg)` }}>
									<div className="lpc-r5score-counter" style={spin}>
										<div className="lpc-r5score-unsquash">
											<div className={e.className} style={e.style}>
												{e.inner ? (
													<div className={e.inner.className} style={e.inner.style}>
														<Chip s={s} />
													</div>
												) : (
													<Chip s={s} />
												)}
											</div>
										</div>
									</div>
								</div>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}

/**
 * The hand-over frame between "One score" and "Picked for you": the title, "One score.", the full ring, the verdict.
 * Chapter 2 clips end on it; chapter 3 clips start on it. `parts` wraps each piece so a clip can animate it.
 */
export function RingEnd({
	card,
	wrap = (_k, n) => n,
	fillAt,
}: {
	card: LandingCard
	wrap?: (key: "kick" | "head" | "ring" | "verdict", node: ReactNode) => ReactNode
	fillAt?: number
}) {
	const numberAt = fillAt !== undefined ? fillAt + 1100 : undefined
	return (
		<>
			{wrap(
				"kick",
				<div className="lpc-r5score-kick lpc-r5score-at-kick">{card.title}</div>,
			)}
			{wrap(
				"head",
				<div className="lpc-r5score-head lpc-r5score-at-head">
					One <span className="lpc-r5score-amber">score.</span>
				</div>,
			)}
			{wrap(
				"ring",
				<div className="lpc-r5score-at-ring">
					<Ring percent={score(card)} fillAt={fillAt} numberAt={numberAt} />
				</div>,
			)}
			{wrap(
				"verdict",
				<div className="lpc-r5score-verdict lpc-r5score-at-verdict" style={{ color: vibeColor(score(card)) }}>
					{verdictOf(score(card))}.
				</div>,
			)}
		</>
	)
}

/** A full-stage layer: wrappers that animate a piece without touching its own place. */
export const Layer = ({ className = "", style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) => (
	<div className={`lpc-r5score-layer ${className}`} style={style}>
		{children}
	</div>
)

/** The pick chapter's data: the hero, the loved titles, the hero's real match, other picks. */
export function pickOf(data: IntroData) {
	const extra = extraOf(data)
	const hero = data.pool[0]
	const loved = (extra?.pick.loved ?? []).map((k) => data.pool.find((c) => c.key === k)).filter((c): c is LandingCard => Boolean(c))
	return { hero, loved, match: extra?.pick.heroMatch ?? null }
}

export const Frame = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
	<div className={`lpc-r5score ${className}`}>{children}</div>
)
