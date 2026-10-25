// The "Your taste" chapter: "Your fingerprint." while the taste print draws itself on the left; its four defining
// attributes land as big words on the right, one by one in their family's colour, then each shrinks and flies into its
// dot on the print's rim, which lights up. The words' place fills with the top picks, a pointer drags Humor out to
// "lots more" and the picks reshuffle, then World (the For you ranking at each shape), under "Tune your picks."
import type { CSSProperties } from "react"
import { Push } from "~/ui/living-room/intro/parts/push"
import type { SceneProps } from "~/ui/living-room/intro/scene"
import { DEFINING } from "./defining"
import {
	type Drag,
	OUT,
	Picks,
	Print,
	Swap,
	at,
	stageOfView,
	stateKeys,
	tl,
	viewAt,
} from "./kit"

const BOX = { left: 4, top: 10, size: 80 }
const LAND = 800
const STEP = 230
const FLY = LAND + DEFINING.length * STEP + 650
const FLY_DUR = 620
const D1: Drag = { f: "humor", from: 0, to: 2, at: FLY + 1450, dur: 700 }
const D2: Drag = { f: "world", from: 0, to: 2, at: D1.at + 1600, dur: 650 }
const C1 = D1.at + D1.dur + 50
const C2 = D2.at + D2.dur + 50
export const TASTE_MS = C2 + 1250

const COL = 53
const wordY = (i: number) => 35 + i * 15
const W = 10.4
const slot = (i: number) => ({
	x: COL + 4 + W / 2 + (i % 3) * (W + 1.4),
	y: i < 3 ? 47 : 79,
})

export function YourTaste(_props: SceneProps) {
	return (
		<div className="intro-ask">
			<Push
				from={LAND + 600}
				dur={FLY - LAND - 600}
				scale={1.025}
				origin="60% 55%"
			>
				<Push from={C1} dur={TASTE_MS - C1} scale={1.03} origin="65% 55%">
					<Print
						style={{
							left: `${BOX.left}cqw`,
							top: `${BOX.top}cqh`,
							width: `${BOX.size}cqh`,
							height: `${BOX.size}cqh`,
						}}
						drawAt={0}
						handlesAt={FLY + FLY_DUR + 300}
						drags={[D1, D2]}
						cursorFrom={{ x: 85, y: 105 }}
						cursorOut={C2 + 250}
					>
						{/* Each dot lights up as its word lands in it. */}
						{DEFINING.map((d, i) => {
							const t = FLY + i * 90 + FLY_DUR - 80
							return (
								<div
									key={d.key}
									className="intro-taste-at"
									style={tl(viewAt(d.m.x, d.m.y), [], 0, [
										{ at: t, dur: 120, to: 1 },
										{ at: t + 500, dur: 400, to: 0 },
									])}
								>
									<span
										className="intro-taste-dot"
										style={
											{
												"--c": d.color,
												...tl("scale(.6)", [
													{ at: t, dur: 900, to: "scale(2.2)", ease: OUT },
												]),
											} as CSSProperties
										}
									/>
								</div>
							)
						})}
					</Print>
					<div className="absolute" style={{ left: `${COL}cqw`, top: "10cqh" }}>
						<Swap
							className="intro-taste-head"
							t0={200}
							items={[
								{
									at: 0,
									node: (
										<>
											Your <em>fingerprint.</em>
										</>
									),
								},
								{
									at: FLY + 350,
									node: (
										<>
											Tune your <em>picks.</em>
										</>
									),
								},
							]}
						/>
					</div>
					{/* The words: each sits on its rim dot and starts out displaced to its line on the right, big. */}
					{DEFINING.map((d, i) => {
						const p = stageOfView(BOX, d.m.x, d.m.y)
						const dx = COL - p.x
						const dy = wordY(i) - p.y
						const t = FLY + i * 90
						return (
							<div
								key={d.key}
								className="absolute"
								style={{
									left: `${p.x}cqw`,
									top: `${p.y}cqh`,
									width: 0,
									height: 0,
									...tl(
										`translate(${dx.toFixed(2)}cqw, ${dy.toFixed(2)}cqh) scale(1)`,
										[
											{
												at: t,
												dur: FLY_DUR,
												to: "translate(0cqw, 0cqh) scale(.12)",
												ease: "cubic-bezier(.55,0,.25,1)",
											},
										],
										1,
										[{ at: t + FLY_DUR - 160, dur: 160, to: 0 }],
										{ transformOrigin: "0 0" },
									),
								}}
							>
								<div className="intro-taste-bigword" style={{ color: d.color }}>
									<div className="intro-taste-land" style={at(LAND + i * STEP)}>
										<span aria-hidden="true">{d.emoji}</span>
										{d.label}
									</div>
								</div>
							</div>
						)
					})}
					<Picks
						states={[
							stateKeys("flat", 6),
							stateKeys("humor2", 6),
							stateKeys("world2humor2", 6),
						]}
						changes={[C1, C2]}
						slot={slot}
						w={W}
						dealAt={FLY + 450}
					/>
				</Push>
			</Push>
		</div>
	)
}
