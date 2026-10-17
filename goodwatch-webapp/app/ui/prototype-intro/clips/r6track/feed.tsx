// PROTOTYPE - throwaway. Chapter 9, "keeps track for you" (round 6). The owner: "a feed that scrolls. but without
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
import { A, DEAL, Example, Headline, Poster, at, img, picks } from "./kit"

// ---- Timing (ms at k = 1) and the feed's geometry (cqh).
/** When the first moment lands in the feed, and the time between moments. */
const FIRST = 2000
const EVERY = 1750
/** How long a moment shows big before it lands. */
const BIG = 1500
/** The height of a place in the feed (card and gap), and where a moment lands (its top). */
const STEP = 15.5
const LAND = 64
/** The clip's length: the feed keeps scrolling after the last moment. */
export const FEED_MS = 13200

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
		<svg viewBox="0 0 24 24" className="lpc-r6track-icon" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
			<div className="lpc-r6track-card lpc-r6track-card-landed" style={style}>
				<img src={img(m.service.logo_path, "w92")} alt="" className="lpc-r6track-card-logo" />
				<div className="lpc-r6track-card-body">
					<div className="lpc-r6track-card-tag">
						<Icon kind={m.kind} />
						GoodWatch · now
					</div>
					<div className="lpc-r6track-card-title">{m.title}</div>
					<div className="lpc-r6track-card-line">{m.line}</div>
				</div>
				<Poster path={m.card.poster_path} className="lpc-r6track-card-poster" size="w154" />
			</div>
		)
	if (m.kind === "next" || m.kind === "pickup")
		return (
			<div className={`lpc-r6track-card lpc-r6track-card-wide lpc-r6track-card-${m.kind}`} style={style}>
				<img src={img(m.card.backdrop_path, "w780")} alt="" className="lpc-r6track-card-art" />
				<div className="lpc-r6track-card-wide-shade" />
				<div className="lpc-r6track-card-body">
					<div className="lpc-r6track-card-tag">
						<Icon kind={m.kind} />
						{tone.label}
					</div>
					<div className="lpc-r6track-card-title">{m.title}</div>
					<div className="lpc-r6track-card-line">{m.line}</div>
				</div>
				<div className="lpc-r6track-card-progress">
					<i style={{ transform: `scaleX(${m.kind === "next" ? 0.92 : 0.38})` }} />
				</div>
			</div>
		)
	return (
		<div className={`lpc-r6track-card lpc-r6track-card-${m.kind}`} style={style}>
			<Poster path={m.card.poster_path} className="lpc-r6track-card-poster" size="w154" />
			<div className="lpc-r6track-card-body">
				<div className="lpc-r6track-card-tag">
					<Icon kind={m.kind} />
					{tone.label}
				</div>
				<div className="lpc-r6track-card-title">{m.title}</div>
				{m.kind === "wish" ? (
					<div className="lpc-r6track-stack" style={{ marginTop: "0.8cqh" }}>
						<span
							className={`lpc-r6track-pill ${live ? A(1, 1) : "lpc-r6track-gone"}`}
							style={live ? at(["lpc-r6track-fade", t, 300], ["lpc-r6track-press", t + 500, 320], ["lpc-r6track-out", t + 820, 160]) : undefined}
						>
							+ Want to See
						</span>
						<span className={`lpc-r6track-pill lpc-r6track-pill-off ${live ? "lpc-r6track-a" : ""}`} style={live ? at(["lpc-r6track-pop", t + 860, 520, DEAL]) : undefined}>
							✓ On your Wishlist
						</span>
					</div>
				) : (
					<div className="lpc-r6track-card-line">{m.line}</div>
				)}
			</div>
			{m.kind === "start" && (
				<span className="lpc-r6track-card-play" aria-hidden="true">
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

export type FeedLook = {
	/** "side": the headline on the left, the feed on the right. "center": one centred feed under the headline. */
	layout: "side" | "center"
	/** "card": the card itself shows big. "bleed": the title's picture fills the screen with a big line first. */
	big: "card" | "bleed"
}

/** Chapter 9: one feed, each moment big first, then into its place, the feed scrolling on. */
export function TrackingFlow({ data, look }: ClipProps & { look: FeedLook }) {
	const ms = moments(data)
	if (!ms) return <div className="absolute inset-0" />
	// The feed moves one place per moment, so each one lands at LAND. At t = 0 it sits so the first lands on time.
	const speed = STEP / EVERY
	const y0 = LAND + speed * FIRST
	const y1 = y0 - speed * FEED_MS
	// With the pictures first, the headline waits for the last moment: it would show through between pictures.
	const head = look.big === "bleed" ? FIRST + EVERY * 5 + 200 : 0
	return (
		<div className={`lpc-r6track-flow lpc-r6track-flow-${look.layout}`}>
			<div className="lpc-r6track-glow" />
			<Example delay={600} />
			<div className="lpc-r6track-flow-head">
				<div className="lpc-r6track-kicker lpc-r6track-a" style={at(["lpc-r6track-rise", head + 150, 700])}>
					Keeps track
				</div>
				<Headline text="It keeps track *for you.*" delay={head + 250} className="lpc-r6track-h-mid" />
				<p className="lpc-r6track-line lpc-r6track-a lpc-r6track-flow-line" style={at(["lpc-r6track-rise", FIRST + EVERY * 5 + (head ? 900 : 300), 800])}>
					Every service. Every show. <b>One feed.</b>
				</p>
			</div>
			{/* The feed: scrolls up from the start, one place per moment. */}
			<div className="lpc-r6track-feedview">
				<div className="lpc-r6track-column" style={{ "--y0": `${y0}cqh`, "--y1": `${y1}cqh`, "--dur": `${FEED_MS}ms` } as CSSProperties}>
					{ms.map((m, i) => (
						<div
							key={m.kind}
							className="lpc-r6track-place lpc-r6track-a"
							style={{ top: `${i * STEP}cqh`, ...at(["lpc-r6track-in", FIRST + i * EVERY, 1, "linear"]) }}
						>
							<Card m={m} t={0} live={false} />
						</div>
					))}
				</div>
			</div>
			{/* Each moment big first: it shows, holds, then shrinks into the place it lands in. */}
			{ms.map((m, i) => {
				const land = FIRST + i * EVERY
				const from = land - BIG
				return (
					<div key={m.kind} className="contents">
						{look.big === "bleed" && (
							<div className={`lpc-r6track-bleed ${A(1)}`} style={{ "--tone": TONE[m.kind].color, ...at(["lpc-r6track-in", from - 150, 380, "ease-out"], ["lpc-r6track-out", land - 650, 450, "ease-in"]) } as CSSProperties}>
								<img src={img(m.card.backdrop_path, "w1280")} alt="" className="lpc-r6track-bleed-art" />
								<div className="lpc-r6track-bleed-shade" />
								<div className="lpc-r6track-bleed-words">
									<span className="lpc-r6track-bleed-tag">
										<Icon kind={m.kind} />
										{TONE[m.kind].label}
									</span>
									<div className="lpc-r6track-bleed-big">{m.big}</div>
								</div>
							</div>
						)}
						<div
							className={`lpc-r6track-big ${A(1)}`}
							style={at(["lpc-r6track-bigshrink", from, BIG, "linear"], ["lpc-r6track-out", land, 1, "linear"])}
						>
							<Card m={m} t={from + 450} live={m.kind === "wish"} />
						</div>
					</div>
				)
			})}
		</div>
	)
}

