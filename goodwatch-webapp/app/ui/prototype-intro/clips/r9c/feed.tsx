// PROTOTYPE - throwaway. Round 9 rhythm pass of round 8's tracking-feed-r8 (chapter 9). The owner on round 8: "timing
// and rhythm is still weird. there are often weird pauses between scene transitions". Measured: after the last
// moment landed the clip held 3.2 s, its closing line arriving only 0.35 s after the last moment and then sitting
// still for 2 s. Now the closing line rises while the last moments rush in, the feed keeps drifting to a stop
// (slower slow-down), the scene pushes in gently during the read, and the clip ends 1.2 s sooner.
//
// Round 8's notes: Chapter 9, "keeps track for you" (round 8, from round 7's tracking-feed-r7). The owner on
// round 7: "acceleration is not quickly enough, timing feels off". Round 8: the first moment takes its time (big and
// readable for 1.5 s), then every gap is 0.7 of the one before, so the last moments rush in; after the last one the
// feed eases to a stop instead of dropping to a slower pace at once.
//
// Round 6's notes: The owner: "a feed that scrolls. but without
// the second feed. one screen that just shows one item after another, starting big and taking its place into the
// feed thats slowly scrolling out of view as more items come in that clearly indicate how distinct they are."
//
// One feed. Each moment first shows big, then shrinks into the feed's next place. The feed scrolls up at a steady
// pace from the start, so every moment lands on the same spot on screen: the scroll moves one place per moment.
// Each kind of moment has its own colour, icon and layout. The moments are an example; the titles, services and
// pictures are real.
import type { CSSProperties, ReactNode } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import type { ClipProps } from "../../clip"
import { A, DEAL, Example, Poster, at, img, picks } from "../r7track/kit"
import { Push } from "./kit"

// ---- Timing (ms at k = 1) and the feed's geometry (cqh).
/** When each moment lands in the feed: the first gap is 2.2 s, each next one 0.7 of the one before. */
const FIRST_LAND = 2400
const FIRST_GAP = 2200
const LANDS = Array.from({ length: 6 }, (_, i) => Math.round(FIRST_LAND + (FIRST_GAP * (1 - 0.7 ** i)) / 0.3))
/** How long a moment shows big before it lands: up to 1.5 s, never into the moment before it. */
// Round 9: the second moment shows big a little sooner (1.9 s), so nothing stands still after the first one lands.
const bigOf = (i: number) => Math.min(i === 1 ? 1900 : 1500, (i === 0 ? LANDS[0] : LANDS[i] - LANDS[i - 1]) - 120)
/** The height of a place in the feed (card and gap), and where a moment lands (its top). */
const STEP = 15.5
const LAND = 64
/** The closing line rises as the fifth moment lands, while the last ones still rush in; it lands 800 ms later. */
const LINE_AT = LANDS[4]
const LINE_LAND = LINE_AT + 800
/** The clip's length: the line reads ~0.9 s, then the 800 ms hand-over (still readable). */
export const FEED_MS = LINE_LAND + 1700
/** How quickly the feed eases to a stop after the last moment (ms): slow, so it is still drifting during the read. */
const SETTLE_TAU = 1100

type Kind = "wish" | "landed" | "next" | "waiting" | "pickup" | "start"

type Moment = { kind: Kind; card: LandingCard; title: string; line: string; big: string; service?: { name: string; logo_path: string } }

const TONE: Record<Kind, { color: string; label: string }> = {
	wish: { color: "#fbbf24", label: "Want to See" },
	landed: { color: "#22c55e", label: "Now streaming" },
	next: { color: "#ef4444", label: "Continue" },
	waiting: { color: "#a78bfa", label: "Waiting for episodes" },
	pickup: { color: "#38bdf8", label: "Pick up" },
	start: { color: "#34d399", label: "Start" },
}

/** Each kind's icon: a few strokes in its colour. */
function Icon({ kind }: { kind: Kind }) {
	const p: Record<Kind, ReactNode> = {
		wish: <path d="M7 3h10v18l-5-4-5 4z" />,
		landed: (
			<>
				<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
				<path d="M10 21h4" />
			</>
		),
		next: <path d="M8 5l11 7-11 7z" />,
		waiting: (
			<>
				<path d="M7 3h10M7 21h10" />
				<path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9" />
			</>
		),
		pickup: (
			<>
				<path d="M4 12a8 8 0 1 0 3-6.2" />
				<path d="M4 4v5h5" />
			</>
		),
		start: (
			<>
				<circle cx="12" cy="12" r="9" />
				<path d="M10 8l6 4-6 4z" />
			</>
		),
	}
	return (
		<svg viewBox="0 0 24 24" className="lpc-r7track-icon" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			{p[kind]}
		</svg>
	)
}

/** One moment as a feed card. `live` plays its little inner action (the Want to See press) from `t`. */
function Card({ m, t, live }: { m: Moment; t: number; live: boolean }) {
	const tone = TONE[m.kind]
	const style = { "--tone": tone.color } as CSSProperties
	if (m.kind === "landed" && m.service)
		return (
			<div className="lpc-r7track-card lpc-r7track-card-landed" style={style}>
				<img src={img(m.service.logo_path, "w92")} alt="" className="lpc-r7track-card-logo" />
				<div className="lpc-r7track-card-body">
					<div className="lpc-r7track-card-tag">
						<Icon kind={m.kind} />
						GoodWatch · now
					</div>
					<div className="lpc-r7track-card-title">{m.title}</div>
					<div className="lpc-r7track-card-line">{m.line}</div>
				</div>
				<Poster path={m.card.poster_path} className="lpc-r7track-card-poster" size="w154" />
			</div>
		)
	if (m.kind === "next" || m.kind === "pickup")
		return (
			<div className={`lpc-r7track-card lpc-r7track-card-wide lpc-r7track-card-${m.kind}`} style={style}>
				<img src={img(m.card.backdrop_path, "w780")} alt="" className="lpc-r7track-card-art" />
				<div className="lpc-r7track-card-wide-shade" />
				<div className="lpc-r7track-card-body">
					<div className="lpc-r7track-card-tag">
						<Icon kind={m.kind} />
						{tone.label}
					</div>
					<div className="lpc-r7track-card-title">{m.title}</div>
					<div className="lpc-r7track-card-line">{m.line}</div>
				</div>
				<div className="lpc-r7track-card-progress">
					<i style={{ transform: `scaleX(${m.kind === "next" ? 0.92 : 0.38})` }} />
				</div>
			</div>
		)
	return (
		<div className={`lpc-r7track-card lpc-r7track-card-${m.kind}`} style={style}>
			<Poster path={m.card.poster_path} className="lpc-r7track-card-poster" size="w154" />
			<div className="lpc-r7track-card-body">
				<div className="lpc-r7track-card-tag">
					<Icon kind={m.kind} />
					{tone.label}
				</div>
				<div className="lpc-r7track-card-title">{m.title}</div>
				{m.kind === "wish" ? (
					<div className="lpc-r7track-stack" style={{ marginTop: "0.8cqh" }}>
						<span
							className={`lpc-r7track-pill ${live ? A(1, 1) : "lpc-r7track-gone"}`}
							style={live ? at(["lpc-r7track-fade", t, 300], ["lpc-r7track-press", t + 500, 320], ["lpc-r7track-out", t + 820, 160]) : undefined}
						>
							+ Want to See
						</span>
						<span className={`lpc-r7track-pill lpc-r7track-pill-off ${live ? "lpc-r7track-a" : ""}`} style={live ? at(["lpc-r7track-pop", t + 860, 520, DEAL]) : undefined}>
							✓ On your Wishlist
						</span>
					</div>
				) : (
					<div className="lpc-r7track-card-line">{m.line}</div>
				)}
			</div>
			{m.kind === "start" && (
				<span className="lpc-r7track-card-play" aria-hidden="true">
					<Icon kind="next" />
				</span>
			)}
		</div>
	)
}

/** The moments, in order: want it once, it lands, then My shows' groups (CONTEXT.md terms), all from the pool. */
function moments(data: ClipProps["data"]): Moment[] | null {
	const { movie, service, shows } = picks(data)
	if (!movie || !service || shows.length < 4) return null
	const [cont, waiting, pickup, start] = shows
	return [
		{ kind: "wish", card: movie, title: movie.title, line: "", big: "Want it once." },
		{ kind: "landed", card: movie, title: `Now on ${service.name}`, line: `${movie.title}, from your Wishlist`, big: "We tell you when it lands.", service },
		{ kind: "next", card: cont, title: cont.title, line: "Next episode, out now", big: "New episode? You'll know." },
		{ kind: "waiting", card: waiting, title: waiting.title, line: "We'll tell you when it's back", big: "Waiting? We keep watch." },
		{ kind: "pickup", card: pickup, title: pickup.title, line: "Right where you left off", big: "Pick up where you stopped." },
		{ kind: "start", card: start, title: start.title, line: "From your Wishlist", big: "Start something new." },
	]
}

/**
 * The feed's scroll: it moves one place per moment, so each moment lands at LAND, and it speeds up with the
 * moments. Before the first and after the last it drifts at the pace of its neighbouring stretch.
 */
function scrollKeyframes(name: string) {
	const y = (i: number) => LAND - i * STEP
	const first = STEP / (LANDS[1] - LANDS[0])
	const last = STEP / (LANDS[LANDS.length - 1] - LANDS[LANDS.length - 2])
	const end = LANDS[LANDS.length - 1]
	// After the last moment the feed keeps its speed for an instant and eases to a stop: an exponential slow-down,
	// sampled finely enough that the linear pieces between keyframes read as one curve.
	const settle: [number, number][] = [...[80, 200, 360, 560, 800, 1100, 1500].filter((dt) => dt < FEED_MS - end), FEED_MS - end].map((dt) => [
		end + dt,
		y(LANDS.length - 1) - last * SETTLE_TAU * (1 - Math.exp(-dt / SETTLE_TAU)),
	])
	const stops: [number, number][] = [
		[0, y(0) + first * LANDS[0]],
		...LANDS.map((t, i) => [t, y(i)] as [number, number]),
		...settle,
	]
	const body = stops.map(([t, v]) => `${((t / FEED_MS) * 100).toFixed(3)}% { transform: translateY(${v.toFixed(2)}cqh); }`).join(" ")
	return `@keyframes ${name} { ${body} }`
}

/** Chapter 9: one feed, each moment big first, then into its place, the feed scrolling on, a little faster each time. */
export function TrackingFeedR9({ data }: ClipProps) {
	const ms = moments(data)
	if (!ms) return <div className="absolute inset-0" />
	return (
		<Push from={LANDS[LANDS.length - 1]} dur={FEED_MS - LANDS[LANDS.length - 1]} scale={1.025} origin="30% 40%">
		<div className="lpc-r7track-flow lpc-r7track-flow-side">
			<style>{scrollKeyframes("lpc-r9c-feedscroll")}</style>
			<div className="lpc-r7track-glow" />
			<Example delay={600} />
			<div className="lpc-r7track-flow-head">
				<h2 className="lpc-r7track-h lpc-r7track-h-feed">
					<span className="lpc-r7track-a lpc-r7track-feed-l1" style={at(["lpc-r7track-rise", 250, 800])}>
						You watch.
					</span>
					<span className="lpc-r7track-a lpc-r7track-accent lpc-r7track-feed-l2" style={at(["lpc-r7track-rise", 650, 800])}>
						We keep track.
					</span>
				</h2>
				<p className="lpc-r7track-line lpc-r7track-a lpc-r7track-flow-line" style={at(["lpc-r7track-rise", LINE_AT, 800])}>
					<span className="block">Your Wishlist and your shows,</span>
					<span className="block">
						on every service. <b>In one feed.</b>
					</span>
				</p>
			</div>
			{/* The feed: scrolls up from the start, one place per moment, faster as the moments come faster. */}
			<div className="lpc-r7track-feedview">
				<div
					className="lpc-r7track-column lpc-r7track-column-steps"
					style={{ animation: `lpc-r9c-feedscroll calc(${FEED_MS}ms * var(--k, 1)) linear both` }}
				>
					{ms.map((m, i) => (
						<div
							key={m.kind}
							className="lpc-r7track-place lpc-r7track-a"
							style={{ top: `${i * STEP}cqh`, ...at(["lpc-r7track-in", LANDS[i], 1, "linear"]) }}
						>
							<Card m={m} t={0} live={false} />
						</div>
					))}
				</div>
			</div>
			{/* Each moment big first: it shows, holds, then shrinks into the place it lands in. */}
			{ms.map((m, i) => {
				const big = bigOf(i)
				const from = LANDS[i] - big
				return (
					<div
						key={m.kind}
						className={`lpc-r7track-big ${A(1)}`}
						style={at(["lpc-r7track-bigshrink", from, big, "linear"], ["lpc-r7track-out", LANDS[i], 1, "linear"])}
					>
						<Card m={m} t={from + Math.min(450, big * 0.3)} live={m.kind === "wish"} />
					</div>
				)
			})}
		</div>
		</Push>
	)
}
