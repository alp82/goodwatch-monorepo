// PROTOTYPE - throwaway. Round 11 "r11feel": "For you" now comes before "How it feels" (owner: "switch for you and how
// it feels"). Round 10's dive onto Avatar (r10b/pick.tsx), with round 9's ending back: "Picked for you" and the why
// read, then leave, and Avatar's poster is alone in the hand-over frame, still pushing in, where "How Avatar feels"
// cuts in. It follows the search (crossfade).
import type { CSSProperties } from "react"
import type { R10bData } from "~/server/prototype-intro/r10b.server"
import type { LandingCard } from "~/server/prototype-landing.server"
import type { ClipProps } from "../../clip"
import { HeroPoster } from "../../hero"
import { Layer, at, poster } from "../r5score/common"
import { HERO_PUSH } from "./feelings"

function pickOf(data: ClipProps["data"]) {
	const x = (data.extra.r10b ?? null) as R10bData | null
	const find = (k: number | null) => data.pool.find((c) => c.key === k) ?? null
	const hero = find(x?.pick ?? null) ?? data.pool[1]
	const loved = (x?.loved ?? []).map(find).filter((c): c is LandingCard => Boolean(c))
	return { hero, loved, match: x?.match ?? null }
}

// The wall: round 5's 10 by 3 grey posters, the pick in the middle row (as r10b/pick.tsx).
const COLS = 10
const ROWS = 3
const W = 8.6
const H = W * 1.5 * (16 / 9)
const GAP = 1.2
const LEFT = (100 - (COLS * W + (COLS - 1) * GAP)) / 2
const TOP = 16
const RGAP = 2.4

function wallOf(data: ClipProps["data"], heroAt: { r: number; c: number }) {
	const { hero } = pickOf(data)
	const others = data.pool.filter((x) => x.key !== hero.key)
	const cells = Array.from({ length: COLS * ROWS }, (_, n) => {
		const r = Math.floor(n / COLS)
		const c = n % COLS
		const card = r === heroAt.r && c === heroAt.c ? hero : others[(n * 7) % others.length]
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
export const PICK_R11_MS = WHY_OUT + 450 + 200

export function PickDiveR11({ data }: ClipProps) {
	const w = wallOf(data, { r: 1, c: 6 })
	const { loved, match } = pickOf(data)
	if (!w.hero) return null
	const s = 62 / H
	const origin = `${w.cx}cqw ${w.cy}cqh`
	const cell = { left: `${w.h.x}cqw`, top: `${w.h.y}cqh`, width: `${W}cqw`, height: `${H}cqh` }
	return (
		<div className="lpc-r5score lpc-r6score">
			<Layer className="lpc-r5score-fadeout" style={at(CLICK + 100, 450)}>
				<div className="lpc-r5score-head lpc-r5score-at-top lpc-r5score-rise" style={at(300, 700)}>
					Somewhere in here is <span className="lpc-r5score-amber">yours.</span>
				</div>
			</Layer>
			<Layer
				className="lpc-r5score-to"
				style={{ ...at(CLICK + 300, 900), transformOrigin: origin, "--tx": `${50 - w.cx}cqw`, "--ty": `${46 - w.cy}cqh`, "--ts": s } as CSSProperties}
			>
				<Layer className="lpc-r5score-fadeout" style={at(CLICK + 500, 500)}>
					{w.cells
						.filter((x) => x !== w.h)
						.map((x) => (
							<Layer key={x.n} className="lpc-r5score-deal" style={at(60 + (x.r + x.c) * 16 * 2.2, 600)}>
								<img
									src={poster(x.card.poster_path, "w185")}
									alt=""
									className="lpc-r5score-wall-cell lpc-r5score-grey"
									style={{ left: `${x.x}cqw`, top: `${x.y}cqh`, width: `${W}cqw`, height: `${H}cqh` }}
								/>
							</Layer>
						))}
				</Layer>
				<Layer className="lpc-r5score-fadeout" style={at(CLICK + 120, 300)}>
					<div
						className="lpc-r6score-light lpc-r6score-light-zig"
						style={{ ...at(700, CLICK - 700), "--lx": `${w.cx}cqw`, "--ly": `${w.cy}cqh` } as CSSProperties}
					/>
				</Layer>
				<Layer className="lpc-r5score-fadeout" style={at(CLICK + 1450, 350)}>
					<Layer className="lpc-r6score-punch" style={{ ...at(CLICK, 420), transformOrigin: `${w.h.x + W / 2}cqw ${w.h.y + H / 2}cqh` }}>
						<img src={poster(w.hero.poster_path, "w185")} alt="" className="lpc-r5score-wall-cell lpc-r6score-chosen" style={cell} />
					</Layer>
					<div className="lpc-r6score-ripple" style={{ ...at(CLICK, 700), left: `${w.h.x + W / 2}cqw`, top: `${w.h.y + H / 2}cqh` } as CSSProperties} />
				</Layer>
			</Layer>
			{/* Avatar alone in the hand-over frame, pushing in from the dive's arrival to the cut. */}
			<Layer className="lpc-r5score-fade" style={at(PUSH_AT, 250)}>
				<div className="lpc-r9a-push" style={at(PUSH_AT, PICK_R11_MS - PUSH_AT, { "--p": HERO_PUSH } as CSSProperties)}>
					<HeroPoster card={w.hero} />
				</div>
			</Layer>
			<Layer className="lpc-r5score-fadeout" style={at(WHY_OUT, 450)}>
				<div className="lpc-r5score-head lpc-r5score-at-top lpc-r5score-rise" style={at(CLICK + 900, 700)}>
					Picked <span className="lpc-r5score-amber">for you.</span>
				</div>
				{match != null && (
					<div className="lpc-r5score-side lpc-r5score-side-l">
						<div className="lpc-r5score-match lpc-r5score-rise" style={at(PUSH_AT)}>
							{match}%
						</div>
						<div className="lpc-r5score-sub lpc-r5score-rise" style={at(PUSH_AT + 120)}>
							your taste
						</div>
					</div>
				)}
				{loved.length > 0 && (
					<div className="lpc-r5score-side lpc-r5score-side-r">
						<div className="lpc-r5score-sub lpc-r5score-rise" style={at(PUSH_AT + 200)}>
							Because you loved
						</div>
						<div className="lpc-r5score-loved">
							{loved.map((c, i) => (
								<img key={c.key} src={poster(c.poster_path)} alt="" className="lpc-r5score-deal" style={at(PUSH_AT + 320 + i * 120)} />
							))}
						</div>
					</div>
				)}
			</Layer>
		</div>
	)
}
