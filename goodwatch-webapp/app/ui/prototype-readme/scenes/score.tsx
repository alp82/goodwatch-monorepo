// PROTOTYPE (README still "score"): the five source cards fanned in an arc above the big GoodWatch ring, still.
// Same cards and data as the intro's "One score" scene (The Dark Knight), no heading.
import type { CSSProperties } from "react"
import { BrandCard } from "~/ui/living-room/intro/parts/brand-cards"
import {
	Ring,
	score,
	scoreTitle,
	verdictOf,
	vibeColor,
} from "~/ui/living-room/intro/parts/score-kit"
import type { SceneProps } from "~/ui/living-room/intro/scene"

/** The ring's centre and the arc the cards sit on (an ellipse around the ring), in stage px (1440x770). */
const CX = 720
const CY = 512
const RX = 640
const RY = 345
const DX = [-560, -290, 0, 290, 560]
const RING_D = 400

const place = (i: number) => {
	const dx = DX[i]
	const y = CY - RY * Math.sqrt(1 - (dx / RX) ** 2)
	// A gentle fan: 8 degrees a card.
	const rot = (i - 2) * 8
	return { x: CX + dx, y, rot }
}

const css = `
.readme-score { position:absolute; inset:0; overflow:hidden;
	background: radial-gradient(60% 70% at 50% 66%, #10161f 0%, #05060a 70%); }
.readme-score .intro-brand-card { width: 16.5cqw; height: 33cqh; }
.readme-score-ring { position:absolute; width:${RING_D}px; transform:translate(-50%,-50%); }
.readme-score-ring .intro-source-ring { width:100%; filter: drop-shadow(0 0 40px rgba(22,147,74,.28)); }
.readme-score-ring .intro-source-ring-n { font-size: 34cqw; letter-spacing:-0.02em; }
.readme-score-gw { position:absolute; left:50%; transform:translateX(-50%); text-align:center; white-space:nowrap; }
.readme-score-title { font-weight:700; text-transform:uppercase; letter-spacing:.18em; color:rgba(255,255,255,.62);
	font-size: 1.35cqw; }
`

export function ReadmeScore({ data }: SceneProps) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	const pct = score(card)
	return (
		<div className="intro-score intro-brand readme-score">
			<style>{css}</style>
			{/* Faint spokes from each card to the ring. */}
			<svg
				width="1440"
				height="770"
				style={{ position: "absolute", inset: 0 }}
				aria-hidden="true"
			>
				{sources.map((s, i) => {
					const p = place(i)
					// Stop at the ring's edge so nothing crosses the number.
					const len = Math.hypot(p.x - CX, p.y - CY)
					const r = RING_D / 2 + 14
					return (
						<line
							key={s.id}
							x1={p.x}
							y1={p.y}
							x2={CX + ((p.x - CX) * r) / len}
							y2={CY + ((p.y - CY) * r) / len}
							stroke="rgba(255,255,255,.10)"
							strokeWidth="2"
							strokeDasharray="3 9"
							strokeLinecap="round"
						/>
					)
				})}
			</svg>
			{sources.map((s, i) => {
				const p = place(i)
				return (
					<div
						key={s.id}
						className="intro-brand-place"
						style={{
							left: p.x,
							top: p.y,
							transform: `rotate(${p.rot}deg)`,
							zIndex: 3 - Math.abs(i - 2),
						}}
					>
						<BrandCard s={s} />
					</div>
				)
			})}
			<div
				className="readme-score-ring"
				style={{ left: CX, top: CY } as CSSProperties}
			>
				<Ring percent={pct} />
			</div>
			<div
				className="readme-score-gw"
				style={{ top: CY + RING_D / 2 + 14 }}
			>
				<span className="readme-score-title">{card.title}</span>
				<span className="readme-score-title" style={{ margin: "0 0.7em" }}>
					·
				</span>
				<span className="readme-score-title" style={{ color: vibeColor(pct) }}>
					{verdictOf(pct)}
				</span>
			</div>
		</div>
	)
}
