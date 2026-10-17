// PROTOTYPE - throwaway. Chapter 2, "One score", round 7. Owner, on round 6's fan: "a hand. move them slightly up
// and decrease their size slightly when the ring comes up, which is right below. then we do the fly into the ring
// one by one animation and then center the ring". So: the five brand cards arrive as a fanned hand; as the ring
// comes up right below, the hand rises a little and shrinks a little; the cards fly into the ring one by one while
// it fills; then the ring glides to the centre and the clip ends on round 5's hand-over frame (RingEnd).
import type { CSSProperties, ReactNode } from "react"
import type { ClipProps } from "../../clip"
import { Layer, RingEnd, at, scoreTitle } from "../r5score/common"
import { BrandCard } from "../r6score/score"

// The hand: fanned cards around (50cqw, FAN_Y).
const FAN_Y = 50 // cqh
const fanRot = (i: number) => (i - 2) * 6 // deg
const fanX = (i: number) => 50 + (i - 2) * 15 // cqw
const fanLift = (i: number) => Math.abs(i - 2) * 2 // cqh

// When the ring comes up, the hand rises by HAND_UP and shrinks to HAND_SCALE, about its own centre.
const HAND_UP = 8 // cqh
const HAND_SCALE = 0.78

// The ring first shows right below the hand, smaller; it moves to its RingEnd place (50cqw, 52cqh) at the end.
const RING_Y = 74 // cqh, the ring's centre below the hand
const RING_SCALE = 0.7

// Timeline, ms at k = 1.
const T = {
	fanIn: 450, // first card swings in; then one every 160
	handUp: 2900, // the hand rises and shrinks, the ring pops up below it
	ringAt: 3050,
	flyAt: 3900, // first card flies into the ring; then one every FLY_STEP
	fillAt: 4600, // the arc fills as the cards land; the number arrives with the last one (fillAt + 1100)
	fillMs: 1300,
	centerAt: 6400, // the ring glides to the centre
	verdictAt: 7400,
	ms: 9000,
}
const FLY_STEP = 300
// Outer cards first, the middle one last, alternating sides.
const FLY_ORDER = [0, 4, 1, 3, 2]
const flyAt = (i: number) => T.flyAt + FLY_ORDER.indexOf(i) * FLY_STEP

/** Where card i's centre sits on screen once the hand has risen and shrunk. */
const handPos = (i: number) => ({
	x: 50 + (fanX(i) - 50) * HAND_SCALE,
	y: FAN_Y - HAND_UP + (FAN_Y + fanLift(i) - FAN_Y) * HAND_SCALE,
})

/** A headline in RingEnd's head place, word by word, that can leave again. */
function Head({ text, inAt, outAt, amber }: { text: string; inAt: number; outAt?: number; amber?: string }) {
	const words = text.split(" ")
	const body = (
		<div className="lpc-r5score-head lpc-r5score-at-head">
			{words.map((w, i) => (
				<span
					key={`${w}${i}`}
					className={`lpc-r5score-rise ${w === amber ? "lpc-r5score-amber" : ""}`}
					style={{ ...at(inAt + i * 150), display: "inline-block", whiteSpace: "pre" }}
				>
					{w}
					{i < words.length - 1 ? " " : ""}
				</span>
			))}
		</div>
	)
	return outAt ? (
		<Layer className="lpc-r5score-fadeout" style={at(outAt, 450)}>
			{body}
		</Layer>
	) : (
		body
	)
}

export function ScoreHand({ data }: ClipProps) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	return (
		<div className="lpc-r5score lpc-r6score lpc-r7open-score">
			<Head text="Five opinions." inAt={250} outAt={2750} amber="Five" />

			{/* The ring and its words: RingEnd, with the ring held right below the hand until it moves to the centre. */}
			<RingEnd
				card={card}
				fillAt={T.fillAt}
				wrap={(k, n): ReactNode => {
					if (k === "kick")
						return (
							<Layer key={k} className="lpc-r5score-fade" style={at(100, 600)}>
								{n}
							</Layer>
						)
					if (k === "head") return <Head key={k} text="One score." inAt={T.handUp + 150} amber="score." />
					if (k === "ring")
						return (
							<Layer
								key={k}
								className="lpc-r5score-from"
								style={{
									...at(T.centerAt, 900),
									"--fy": `${RING_Y - 52}cqh`,
									"--fs": RING_SCALE,
									transformOrigin: "50cqw 52cqh",
								} as CSSProperties}
							>
								<Layer className="lpc-r5score-pop" style={at(T.ringAt, 800)}>
									<div style={{ display: "contents", "--dur": `${T.fillMs}ms` } as CSSProperties}>{n}</div>
								</Layer>
							</Layer>
						)
					return (
						<Layer key={k} className="lpc-r5score-rise" style={at(T.verdictAt)}>
							{n}
						</Layer>
					)
				}}
			/>

			{/* The hand: it rises and shrinks as the ring comes up; then each card flies into the ring. */}
			<Layer
				className="lpc-r5score-to"
				style={{ ...at(T.handUp, 800), "--ty": `${-HAND_UP}cqh`, "--ts": HAND_SCALE, transformOrigin: `50cqw ${FAN_Y}cqh` } as CSSProperties}
			>
				{sources.map((s, i) => {
					const x = fanX(i)
					const y = FAN_Y + fanLift(i)
					const p = handPos(i)
					// The flight is drawn inside the shrunk hand, so its distance is divided by the hand's scale.
					const tx = (50 - p.x) / HAND_SCALE
					const ty = (RING_Y - p.y) / HAND_SCALE
					return (
						<Layer
							key={s.id}
							className="lpc-r6score-fold"
							style={{ ...at(flyAt(i), 700), transformOrigin: `${x}cqw ${y}cqh`, "--tx": `${tx}cqw`, "--ty": `${ty}cqh`, "--r": `${-fanRot(i)}deg` } as CSSProperties}
						>
							<Layer className="lpc-r6score-fanin" style={{ ...at(T.fanIn + i * 160, 800), transformOrigin: `${x}cqw ${y}cqh` }}>
								<div className="lpc-r6score-place" style={{ left: `${x}cqw`, top: `${y}cqh`, transform: `rotate(${fanRot(i)}deg)`, zIndex: 3 - Math.abs(i - 2) }}>
									<BrandCard s={s} />
								</div>
							</Layer>
						</Layer>
					)
				})}
			</Layer>

			{/* A flash in the ring as each card lands. */}
			{sources.map((s, i) => (
				<div key={`f${s.id}`} className="lpc-r6score-flash lpc-r7open-flash" style={at(flyAt(i) + 560, 500)} />
			))}
		</div>
	)
}

export const SCORE_HAND_MS = T.ms
