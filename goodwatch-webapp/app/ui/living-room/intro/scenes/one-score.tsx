// "One score": five real numbers behind one title's GoodWatch score (IMDb, Rotten Tomatoes critics and audience,
// Metacritic critics and users) as a fanned hand of brand cards; the ring rises below, the cards fly into it one by
// one, it fills, and it moves to the centre with its verdict.
import type { CSSProperties, ReactNode } from "react"
import { BrandCard } from "~/ui/living-room/intro/parts/brand-cards"
import {
	Layer,
	RingEnd,
	at,
	scoreTitle,
} from "~/ui/living-room/intro/parts/score-kit"
import type { SceneProps } from "~/ui/living-room/intro/scene"

const FAN_Y = 50 // cqh
const fanRot = (i: number) => (i - 2) * 6 // deg
const fanX = (i: number) => 50 + (i - 2) * 15 // cqw
const fanLift = (i: number) => Math.abs(i - 2) * 2 // cqh
const HAND_UP = 8 // cqh
const HAND_SCALE = 0.78
const RING_Y = 74 // cqh
const RING_SCALE = 0.7

// Timeline, ms at k = 1.
const T = {
	headIn: 100, // [250]
	fanIn: 150, // [450] first card; then one every FAN_STEP
	headOut: 1850, // [2750]
	handUp: 1650, // [2900] the hand rises as the last card settles
	ringAt: 1750, // [3050]
	flyAt: 2350, // [3900] first flight while the ring is still popping up
	fillAt: 3050, // [4600] flyAt + 700, so the number lands with the last card (fillAt + 1100)
	fillMs: 1300,
	centerAt: 4250, // [6400] the ring heads to the centre as the arc finishes
	verdictAt: 4800, // [7400]
}
const FAN_STEP = 150 // [160]
const FLY_STEP = 300
/** Ends 250 ms after "Excellent." has risen (850 ms): chapter 3 continues this exact frame (`enter: "cut"`). */
export const ONE_SCORE_MS = T.verdictAt + 850 + 250
/** The ring frame creeps toward the viewer from the end of the centring; chapter 3 starts at this scale. */
export const RING_PUSH = 1.03
const PUSH_AT = T.centerAt + 900

const FLY_ORDER = [0, 4, 1, 3, 2]
const flyAt = (i: number) => T.flyAt + FLY_ORDER.indexOf(i) * FLY_STEP

const handPos = (i: number) => ({
	x: 50 + (fanX(i) - 50) * HAND_SCALE,
	y: FAN_Y - HAND_UP + (FAN_Y + fanLift(i) - FAN_Y) * HAND_SCALE,
})

function Head({
	text,
	inAt,
	outAt,
	amber,
}: { text: string; inAt: number; outAt?: number; amber?: string }) {
	const words = text.split(" ")
	const body = (
		<div className="intro-score-head intro-score-at-head">
			{words.map((w, i) => (
				<span
					key={`${w}${i}`}
					className={`intro-score-rise ${w === amber ? "intro-score-amber" : ""}`}
					style={{
						...at(inAt + i * 150),
						display: "inline-block",
						whiteSpace: "pre",
					}}
				>
					{w}
					{i < words.length - 1 ? " " : ""}
				</span>
			))}
		</div>
	)
	return outAt ? (
		<Layer className="intro-score-fadeout" style={at(outAt, 400)}>
			{body}
		</Layer>
	) : (
		body
	)
}

export function OneScore({ data }: SceneProps) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	return (
		<div className="intro-score intro-brand intro-chat-score">
			<div
				className="intro-tempo-push"
				style={at(PUSH_AT, ONE_SCORE_MS - PUSH_AT, {
					"--p": RING_PUSH,
				} as CSSProperties)}
			>
				<Head
					text="Five opinions."
					inAt={T.headIn}
					outAt={T.headOut}
					amber="Five"
				/>
				<RingEnd
					card={card}
					fillAt={T.fillAt}
					wrap={(k, n): ReactNode => {
						if (k === "kick")
							return (
								<Layer key={k} className="intro-score-fade" style={at(0, 500)}>
									{n}
								</Layer>
							)
						if (k === "head")
							return (
								<Head
									key={k}
									text="One score."
									inAt={T.handUp + 250}
									amber="score."
								/>
							)
						if (k === "ring")
							return (
								<Layer
									key={k}
									className="intro-score-from"
									style={
										{
											...at(T.centerAt, 900),
											"--fy": `${RING_Y - 52}cqh`,
											"--fs": RING_SCALE,
											transformOrigin: "50cqw 52cqh",
										} as CSSProperties
									}
								>
									<Layer className="intro-score-pop" style={at(T.ringAt, 800)}>
										<div
											style={
												{
													display: "contents",
													"--dur": `${T.fillMs}ms`,
												} as CSSProperties
											}
										>
											{n}
										</div>
									</Layer>
								</Layer>
							)
						return (
							<Layer
								key={k}
								className="intro-score-rise"
								style={at(T.verdictAt)}
							>
								{n}
							</Layer>
						)
					}}
				/>
				<Layer
					className="intro-score-to"
					style={
						{
							...at(T.handUp, 800),
							"--ty": `${-HAND_UP}cqh`,
							"--ts": HAND_SCALE,
							transformOrigin: `50cqw ${FAN_Y}cqh`,
						} as CSSProperties
					}
				>
					{sources.map((s, i) => {
						const x = fanX(i)
						const y = FAN_Y + fanLift(i)
						const p = handPos(i)
						const tx = (50 - p.x) / HAND_SCALE
						const ty = (RING_Y - p.y) / HAND_SCALE
						return (
							<Layer
								key={s.id}
								className="intro-brand-fold"
								style={
									{
										...at(flyAt(i), 700),
										transformOrigin: `${x}cqw ${y}cqh`,
										"--tx": `${tx}cqw`,
										"--ty": `${ty}cqh`,
										"--r": `${-fanRot(i)}deg`,
									} as CSSProperties
								}
							>
								<Layer
									className="intro-brand-fanin"
									style={{
										...at(T.fanIn + i * FAN_STEP, 800),
										transformOrigin: `${x}cqw ${y}cqh`,
									}}
								>
									<div
										className="intro-brand-place"
										style={{
											left: `${x}cqw`,
											top: `${y}cqh`,
											transform: `rotate(${fanRot(i)}deg)`,
											zIndex: 3 - Math.abs(i - 2),
										}}
									>
										<BrandCard s={s} />
									</div>
								</Layer>
							</Layer>
						)
					})}
				</Layer>
				{sources.map((s, i) => (
					<div
						key={`f${s.id}`}
						className="intro-brand-flash intro-chat-flash"
						style={at(flyAt(i) + 560, 500)}
					/>
				))}
			</div>
		</div>
	)
}
