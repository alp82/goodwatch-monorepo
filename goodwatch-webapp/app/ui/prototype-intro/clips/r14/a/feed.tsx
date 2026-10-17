// PROTOTYPE - throwaway. Round 14 tracking: round 10's feed (r10c/feed.tsx, ms 6100 as round 12 cut it), with the
// Want to See button moved beside the title so it never overflows its card.
// PROTOTYPE - throwaway. Round 10 of the tracking feed (chapter 9, now after the filters). The owner on round 9:
// "tracking - make it shorter". From round 9's tracking-feed-r9 (10.5 s) to ~7 s: five moments instead of six
// (Waiting for episodes goes), the same accelerating cadence but tighter (first gap 1.4 s, each next 0.7 of the
// one before), the movie's alert on Netflix where a famous pool movie streams there, and a short live hold on the line.
//
// Earlier rounds: one feed; each moment shows big first, then shrinks into the feed's next place while the feed
// scrolls up one place per moment, so every moment lands on the same spot. The moments are an example; the titles,
// services and pictures are real.
import type { CSSProperties, ReactNode } from "react"
import type { LandingCard } from "~/server/prototype-landing.server"
import type { ClipProps } from "../../../clip"
import { A, DEAL, Example, Poster, at, img, knownService, picks } from "../../r7track/kit"
import { Push } from "../../r9c/kit"

// ---- Timing (ms at k = 1) and the feed's geometry (cqh).
/** When each moment lands in the feed: the first gap is 1.4 s, each next one 0.7 of the one before. */
const FIRST_LAND = 1700
const FIRST_GAP = 1400
const COUNT = 5
const LANDS = Array.from({ length: COUNT }, (_, i) => Math.round(FIRST_LAND + (FIRST_GAP * (1 - 0.7 ** i)) / 0.3))
/** How long a moment shows big before it lands: the first 1.4 s (its Want to See press reads early), never into the one before. */
const bigOf = (i: number) => Math.min(i === 0 ? 1400 : 1250, (i === 0 ? LANDS[0] : LANDS[i] - LANDS[i - 1]) - 120)
/** The height of a place in the feed (card and gap), and where a moment lands (its top). */
const STEP = 15.5
const LAND = 64
/** The closing line rises as the fourth moment lands, while the last one still rushes in; it lands 700 ms later. */
const LINE_AT = LANDS[3]
const LINE_LAND = LINE_AT + 700
/** The clip's length: the line reads ~0.7 s, then the 800 ms hand-over (still readable). */
export const FEED_R10_MS = LINE_LAND + 1500
/** How quickly the feed eases to a stop after the last moment (ms): slow, so it still drifts during the read. */
const SETTLE_TAU = 900

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
				{m.kind !== "wish" && <div className="lpc-r7track-card-line">{m.line}</div>}
			</div>
			{/* Round 14: the Want to See button sits beside the title, at the card's end, so it always fits inside. */}
			{m.kind === "wish" && (
				<div className="lpc-r7track-stack lpc-r14a-wish-btn">
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
			)}
			{m.kind === "start" && (
				<span className="lpc-r7track-card-play" aria-hidden="true">
					<Icon kind="next" />
				</span>
			)}
		</div>
	)
}

/** A pool movie on Netflix where the visitor lives (real availability), else round 9's choice. */
function netflixMovie(data: ClipProps["data"]) {
	const order = ["Inception", "The Dark Knight", "Interstellar", "The Matrix", "Inglourious Basterds", "Pulp Fiction", "Fight Club", "Forrest Gump"]
	const onNetflix = data.pool.filter(
		(c) => c.media_type === "movie" && c.poster_path && c.services?.some((s) => s.logo_path && /^netflix$/i.test(s.name)),
	)
	const movie = order.flatMap((t) => onNetflix.find((c) => c.title === t) ?? [])[0] ?? onNetflix[0]
	const service = movie?.services?.find((s) => /^netflix$/i.test(s.name)) ?? null
	return movie && service ? { movie, service } : null
}

/** The moments, in order: want it once, it lands, then My shows' Continue, Pick up and Start (CONTEXT.md terms). */
function moments(data: ClipProps["data"]): Moment[] | null {
	const base = picks(data)
	const nf = netflixMovie(data)
	const movie = nf?.movie ?? base.movie
	const service = nf?.service ?? (base.movie ? knownService(base.movie) : null)
	const shows = base.shows
	if (!movie || !service || shows.length < 4) return null
	const [cont, , pickup, start] = shows
	return [
		{ kind: "wish", card: movie, title: movie.title, line: "", big: "Want it once." },
		{ kind: "landed", card: movie, title: `Now on ${service.name}`, line: `${movie.title}, from your Wishlist`, big: "We tell you when it lands.", service },
		{ kind: "next", card: cont, title: cont.title, line: "Next episode, out now", big: "New episode? You'll know." },
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
	const settle: [number, number][] = [...[80, 200, 360, 560, 800, 1100, 1500].filter((dt) => dt < FEED_R10_MS - end), FEED_R10_MS - end].map((dt) => [
		end + dt,
		y(LANDS.length - 1) - last * SETTLE_TAU * (1 - Math.exp(-dt / SETTLE_TAU)),
	])
	const stops: [number, number][] = [
		[0, y(0) + first * LANDS[0]],
		...LANDS.map((t, i) => [t, y(i)] as [number, number]),
		...settle,
	]
	const body = stops.map(([t, v]) => `${((t / FEED_R10_MS) * 100).toFixed(3)}% { transform: translateY(${v.toFixed(2)}cqh); }`).join(" ")
	return `@keyframes ${name} { ${body} }`
}

/** Chapter 9, shorter: five moments, each big first, then into its place, faster each time. */
export function TrackingFeedR14({ data }: ClipProps) {
	const ms = moments(data)
	if (!ms) return <div className="absolute inset-0" />
	return (
		<Push from={LANDS[LANDS.length - 1]} dur={FEED_R10_MS - LANDS[LANDS.length - 1]} scale={1.025} origin="30% 40%">
		<div className="lpc-r7track-flow lpc-r7track-flow-side">
			<style>{scrollKeyframes("lpc-r10c-feedscroll")}</style>
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
					style={{ animation: `lpc-r10c-feedscroll calc(${FEED_R10_MS}ms * var(--k, 1)) linear both` }}
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
						<Card m={m} t={from + 100} live={m.kind === "wish"} />
					</div>
				)
			})}
		</div>
		</Push>
	)
}
