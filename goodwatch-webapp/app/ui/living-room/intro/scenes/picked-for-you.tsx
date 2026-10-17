// "Picked for you": a grey wall of posters, a light that finds the pick, a punch of colour and a dive into it, with
// the pick's real match and "because you loved". It ends on the pick's poster alone, which "How it feels" continues
// from.
import type { CSSProperties } from "react"
import type { PickData } from "~/ui/living-room/intro/data"
import type { IntroCard } from "~/ui/living-room/intro/data"
import { HERO_PUSH } from "~/ui/living-room/intro/parts/feelings-zoom"
import { HeroPoster } from "~/ui/living-room/intro/parts/hero-poster"
import { Layer, at, poster } from "~/ui/living-room/intro/parts/score-kit"
import type { SceneProps } from "~/ui/living-room/intro/scene"

function pickOf(data: SceneProps["data"]) {
	const x = (data.extra.pick ?? null) as PickData | null
	const find = (k: number | null) => data.pool.find((c) => c.key === k) ?? null
	const hero = find(x?.pick ?? null) ?? data.pool[1]
	const loved = (x?.loved ?? [])
		.map(find)
		.filter((c): c is IntroCard => Boolean(c))
	return { hero, loved, match: x?.match ?? null }
}

// The wall: 10 by 3 grey posters, the pick in the middle row.
const COLS = 10
const ROWS = 3
const W = 8.6
const H = W * 1.5 * (16 / 9)
const GAP = 1.2
const LEFT = (100 - (COLS * W + (COLS - 1) * GAP)) / 2
const TOP = 16
const RGAP = 2.4

function wallOf(data: SceneProps["data"], heroAt: { r: number; c: number }) {
	const { hero } = pickOf(data)
	const others = data.pool.filter((x) => x.key !== hero.key)
	const cells = Array.from({ length: COLS * ROWS }, (_, n) => {
		const r = Math.floor(n / COLS)
		const c = n % COLS
		const card =
			r === heroAt.r && c === heroAt.c ? hero : others[(n * 7) % others.length]
		return { n, r, c, card, x: LEFT + c * (W + GAP), y: TOP + r * (H + RGAP) }
	})
	const h = cells.find((x) => x.r === heroAt.r && x.c === heroAt.c)!
	return { hero, cells, cx: h.x + W / 2, cy: h.y + H / 2, h }
}

const CLICK = 2300
const PUSH_AT = CLICK + 1150
/** The why's last loved poster lands at CLICK + 1150 + 440 + 750; it reads 0.9 s more, then the words leave (450 ms). */
const WHY_OUT = CLICK + 1150 + 440 + 750 + 900
/** The poster alone for 200 ms after the words are gone, still pushing: the cut into "How Avatar feels". */
export const PICKED_FOR_YOU_MS = WHY_OUT + 450 + 200

export function PickedForYou({ data }: SceneProps) {
	const w = wallOf(data, { r: 1, c: 6 })
	const { loved, match } = pickOf(data)
	if (!w.hero) return null
	const s = 62 / H
	const origin = `${w.cx}cqw ${w.cy}cqh`
	const cell = {
		left: `${w.h.x}cqw`,
		top: `${w.h.y}cqh`,
		width: `${W}cqw`,
		height: `${H}cqh`,
	}
	return (
		<div className="intro-score intro-brand">
			<Layer className="intro-score-fadeout" style={at(CLICK + 100, 450)}>
				<div
					className="intro-score-head intro-score-at-top intro-score-rise"
					style={at(300, 700)}
				>
					Somewhere in here is <span className="intro-score-amber">yours.</span>
				</div>
			</Layer>
			<Layer
				className="intro-score-to"
				style={
					{
						...at(CLICK + 300, 900),
						transformOrigin: origin,
						"--tx": `${50 - w.cx}cqw`,
						"--ty": `${46 - w.cy}cqh`,
						"--ts": s,
					} as CSSProperties
				}
			>
				<Layer className="intro-score-fadeout" style={at(CLICK + 500, 500)}>
					{w.cells
						.filter((x) => x !== w.h)
						.map((x) => (
							<Layer
								key={x.n}
								className="intro-score-deal"
								style={at(60 + (x.r + x.c) * 16 * 2.2, 600)}
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
				<Layer className="intro-score-fadeout" style={at(CLICK + 120, 300)}>
					<div
						className="intro-brand-light intro-brand-light-zig"
						style={
							{
								...at(700, CLICK - 700),
								"--lx": `${w.cx}cqw`,
								"--ly": `${w.cy}cqh`,
							} as CSSProperties
						}
					/>
				</Layer>
				<Layer className="intro-score-fadeout" style={at(CLICK + 1450, 350)}>
					<Layer
						className="intro-brand-punch"
						style={{
							...at(CLICK, 420),
							transformOrigin: `${w.h.x + W / 2}cqw ${w.h.y + H / 2}cqh`,
						}}
					>
						<img
							src={poster(w.hero.poster_path, "w185")}
							alt=""
							className="intro-score-wall-cell intro-brand-chosen"
							style={cell}
						/>
					</Layer>
					<div
						className="intro-brand-ripple"
						style={
							{
								...at(CLICK, 700),
								left: `${w.h.x + W / 2}cqw`,
								top: `${w.h.y + H / 2}cqh`,
							} as CSSProperties
						}
					/>
				</Layer>
			</Layer>
			{/* Avatar alone in the hand-over frame, pushing in from the dive's arrival to the cut. */}
			<Layer className="intro-score-fade" style={at(PUSH_AT, 250)}>
				<div
					className="intro-tempo-push"
					style={at(PUSH_AT, PICKED_FOR_YOU_MS - PUSH_AT, {
						"--p": HERO_PUSH,
					} as CSSProperties)}
				>
					<HeroPoster card={w.hero} />
				</div>
			</Layer>
			<Layer className="intro-score-fadeout" style={at(WHY_OUT, 450)}>
				<div
					className="intro-score-head intro-score-at-top intro-score-rise"
					style={at(CLICK + 900, 700)}
				>
					Picked <span className="intro-score-amber">for you.</span>
				</div>
				{match != null && (
					<div className="intro-score-side intro-score-side-l">
						<div
							className="intro-score-match intro-score-rise"
							style={at(PUSH_AT)}
						>
							{match}%
						</div>
						<div
							className="intro-score-sub intro-score-rise"
							style={at(PUSH_AT + 120)}
						>
							your taste
						</div>
					</div>
				)}
				{loved.length > 0 && (
					<div className="intro-score-side intro-score-side-r">
						<div
							className="intro-score-sub intro-score-rise"
							style={at(PUSH_AT + 200)}
						>
							Because you loved
						</div>
						<div className="intro-score-loved">
							{loved.map((c, i) => (
								<img
									key={c.key}
									src={poster(c.poster_path)}
									alt=""
									className="intro-score-deal"
									style={at(PUSH_AT + 320 + i * 120)}
								/>
							))}
						</div>
					</div>
				)}
			</Layer>
		</div>
	)
}
