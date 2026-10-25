// The For you chapter's opening: a grey wall of modern shows ("Somewhere in here is yours."), a light that zigzags
// across it and finds the pick, a punch of amber and a dive that brings the pick to the centre. At HANDOFF the poster
// sits exactly where `.film-hero` draws it (centred at 50cqw 46cqh, 62cqh tall).
import type { CSSProperties } from "react"
import type { IntroCard } from "~/ui/living-room/intro/data"
import { Layer, at, poster } from "~/ui/living-room/intro/parts/score-kit"

const COLS = 10
const ROWS = 3
const W = 8.6
const H = W * 1.5 * (16 / 9)
const GAP = 1.2
const LEFT = (100 - (COLS * W + (COLS - 1) * GAP)) / 2
const TOP = 16
const RGAP = 2.4
const HERO_AT = { r: 1, c: 6 }

const CLICK = 1900
/** The moment the dive has the poster at the centre, where the sharp poster takes over. */
export const HANDOFF = CLICK + 1150

/** Where `.film-hero` puts the poster, in stage units: its centre and height. */
const HERO_BOX = { cx: 50, cy: 46, h: 62 }

export function WallOpening({
	hero,
	others,
}: { hero: IntroCard; others: IntroCard[] }) {
	const cells = Array.from({ length: COLS * ROWS }, (_, n) => {
		const r = Math.floor(n / COLS)
		const c = n % COLS
		const card =
			r === HERO_AT.r && c === HERO_AT.c
				? hero
				: others[(n * 7) % Math.max(1, others.length)]
		return { n, r, c, card, x: LEFT + c * (W + GAP), y: TOP + r * (H + RGAP) }
	})
	const h = cells[HERO_AT.r * COLS + HERO_AT.c]
	const cx = h.x + W / 2
	const cy = h.y + H / 2
	const cell = {
		left: `${h.x}cqw`,
		top: `${h.y}cqh`,
		width: `${W}cqw`,
		height: `${H}cqh`,
	}
	return (
		<>
			<Layer className="intro-score-fadeout" style={at(CLICK + 100, 450)}>
				<div
					className="intro-score-head intro-score-at-top intro-score-rise"
					style={at(200, 650)}
				>
					Somewhere in here is <span className="intro-score-amber">yours.</span>
				</div>
			</Layer>
			<Layer
				className="intro-score-to"
				style={
					{
						...at(CLICK + 300, 900),
						transformOrigin: `${cx}cqw ${cy}cqh`,
						"--tx": `${HERO_BOX.cx - cx}cqw`,
						"--ty": `${HERO_BOX.cy - cy}cqh`,
						"--ts": HERO_BOX.h / H,
					} as CSSProperties
				}
			>
				<Layer className="intro-score-fadeout" style={at(CLICK + 500, 500)}>
					{cells
						.filter((x) => x !== h)
						.map((x) => (
							<Layer
								key={x.n}
								className="intro-score-deal"
								style={at(40 + (x.r + x.c) * 30, 550)}
							>
								<img
									src={poster(x.card.poster_path, "w185")}
									alt=""
									className="intro-score-wall-cell intro-score-grey"
									style={{
										left: `${x.x}cqw`,
										top: `${x.y}cqh`,
										width: `${W}cqw`,
										height: `${H}cqh`,
									}}
								/>
							</Layer>
						))}
				</Layer>
				{/* The pick, grey like the rest until the light lands on it. */}
				<Layer className="intro-score-fadeout" style={at(CLICK, 200)}>
					<Layer
						className="intro-score-deal"
						style={at(40 + (h.r + h.c) * 30, 550)}
					>
						<img
							src={poster(hero.poster_path, "w185")}
							alt=""
							className="intro-score-wall-cell intro-score-grey"
							style={cell}
						/>
					</Layer>
				</Layer>
				<Layer className="intro-score-fadeout" style={at(CLICK + 120, 300)}>
					<div
						className="intro-brand-light intro-brand-light-zig"
						style={
							{
								...at(450, CLICK - 450),
								"--lx": `${cx}cqw`,
								"--ly": `${cy}cqh`,
							} as CSSProperties
						}
					/>
				</Layer>
				{/* Leaves as the sharp poster takes over. */}
				<Layer className="intro-score-fadeout" style={at(HANDOFF + 100, 250)}>
					<Layer
						className="intro-brand-punch"
						style={{
							...at(CLICK, 420),
							transformOrigin: `${cx}cqw ${cy}cqh`,
						}}
					>
						<img
							src={poster(hero.poster_path, "w185")}
							alt=""
							className="intro-score-wall-cell intro-brand-chosen"
							style={cell}
						/>
					</Layer>
					<div
						className="intro-brand-ripple"
						style={{ ...at(CLICK, 700), left: `${cx}cqw`, top: `${cy}cqh` }}
					/>
				</Layer>
			</Layer>
		</>
	)
}
