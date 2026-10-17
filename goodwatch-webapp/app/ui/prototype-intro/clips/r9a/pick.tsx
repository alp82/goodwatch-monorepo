// PROTOTYPE - throwaway. Chapter 3, "Picked for you", round 9: round 6's dive (recommendations-wall-dive), retimed.
// Same wall, light, click and dive. What changed: "Picked for you" and the why leave after a 1.6 s read instead of
// holding 1.7 s with nothing moving, and from the moment the dive arrives the hero poster creeps toward the viewer
// (lpc-r9a-push), so the hand-over to chapter 4 never stands still; chapter 4 starts at the same scale and carries on.
//
// The helpers below are round 6's (r6score/pick.tsx), copied unchanged.
// Round 6's header: Owner: "exploration is nice, faster spotlight click".
// Round 5's sign-up-style wall (recommendations-wall), faster: the light finds the pick in about a second and a half,
// and the pick is a quick, punchy click. Three ways for the click and for the pick to come forward. Every clip starts
// on chapter 2's last frame (RingEnd, `enter: "cut"`) and ends on the hero alone (HeroPoster), where chapter 4 starts.
import type { CSSProperties, ReactNode } from "react"
import type { ClipProps } from "../../clip"
import { HeroPoster } from "../../hero"
import { Layer, RingEnd, at, pickOf, poster, scoreTitle } from "../r5score/common"
import { RING_PUSH } from "./score"

/** Chapter 2's last frame, leaving quickly. */
function RingLeaving({ data }: ClipProps) {
	const { card } = scoreTitle(data)
	if (!card) return null
	return (
		<RingEnd
			card={card}
			wrap={(k, n) => (
				<Layer key={k} className={k === "ring" ? "lpc-r5score-shrinkout" : "lpc-r5score-fadeout"} style={at(k === "ring" ? 150 : 50, 500)}>
					{n}
				</Layer>
			)}
		/>
	)
}

/** A headline at the top that rises at `inAt` and leaves at `outAt`. */
function Top({ children, inAt, outAt }: { children: ReactNode; inAt: number; outAt: number }) {
	return (
		<Layer className="lpc-r5score-fadeout" style={at(outAt, 450)}>
			<div className="lpc-r5score-head lpc-r5score-at-top lpc-r5score-rise" style={at(inAt, 700)}>
				{children}
			</div>
		</Layer>
	)
}

/** Why the pick: its real match on the left, the loved titles on the right. */
function Why({ data, inAt, outAt }: { data: ClipProps["data"]; inAt: number; outAt: number }) {
	const { loved, match } = pickOf(data)
	return (
		<Layer className="lpc-r5score-fadeout" style={at(outAt, 450)}>
			{match != null && (
				<div className="lpc-r5score-side lpc-r5score-side-l">
					<div className="lpc-r5score-match lpc-r5score-rise" style={at(inAt)}>
						{match}%
					</div>
					<div className="lpc-r5score-sub lpc-r5score-rise" style={at(inAt + 120)}>
						your taste
					</div>
				</div>
			)}
			{loved.length > 0 && (
				<div className="lpc-r5score-side lpc-r5score-side-r">
					<div className="lpc-r5score-sub lpc-r5score-rise" style={at(inAt + 200)}>
						Because you loved
					</div>
					<div className="lpc-r5score-loved">
						{loved.map((c, i) => (
							<img key={c.key} src={poster(c.poster_path)} alt="" className="lpc-r5score-deal" style={at(inAt + 320 + i * 120)} />
						))}
					</div>
				</div>
			)}
		</Layer>
	)
}

// The wall: as round 5's, 10 by 3 grey posters, the pick in the middle row.
const COLS = 10
const ROWS = 3
const W = 8.6 // cqw
const H = W * 1.5 * (16 / 9) // cqh
const GAP = 1.2 // cqw
const LEFT = (100 - (COLS * W + (COLS - 1) * GAP)) / 2
const TOP = 16 // cqh
const RGAP = 2.4 // cqh

function wallOf(data: ClipProps["data"], heroAt: { r: number; c: number }) {
	const { hero } = pickOf(data)
	const cells = Array.from({ length: COLS * ROWS }, (_, n) => {
		const r = Math.floor(n / COLS)
		const c = n % COLS
		const card = r === heroAt.r && c === heroAt.c ? hero : data.pool[1 + ((n * 7) % (data.pool.length - 1))]
		return { n, r, c, card, x: LEFT + c * (W + GAP), y: TOP + r * (H + RGAP) }
	})
	const h = cells.find((x) => x.r === heroAt.r && x.c === heroAt.c)!
	return { hero, cells, cx: h.x + W / 2, cy: h.y + H / 2, h }
}

/** The grey wall dealing in fast, from the top left. */
function Wall({ cells, dealAt = 250, step = 16 }: { cells: ReturnType<typeof wallOf>["cells"]; dealAt?: number; step?: number }) {
	return (
		<>
			{cells.map((x) => (
				<Layer key={x.n} className="lpc-r5score-deal" style={at(dealAt + (x.r + x.c) * step * 2.2, 600)}>
					<img
						src={poster(x.card.poster_path, "w185")}
						alt=""
						className="lpc-r5score-wall-cell lpc-r5score-grey"
						style={{ left: `${x.x}cqw`, top: `${x.y}cqh`, width: `${W}cqw`, height: `${H}cqh` }}
					/>
				</Layer>
			))}
		</>
	)
}

/** The searching light: a quick sweep with one detour, landing on (cx, cy) at `landAt`. */
function Light({ startAt, landAt, cx, cy, path = "zig" }: { startAt: number; landAt: number; cx: number; cy: number; path?: "zig" | "arc" }) {
	return (
		<div
			className={`lpc-r6score-light lpc-r6score-light-${path}`}
			style={{ ...at(startAt, landAt - startAt), "--lx": `${cx}cqw`, "--ly": `${cy}cqh` } as CSSProperties}
		/>
	)
}

/** The click: the cell lights up in color with a punch, an amber ring, and a ripple. */
function Click({ hero, h, clickAt }: { hero: ReturnType<typeof wallOf>["hero"]; h: ReturnType<typeof wallOf>["h"]; clickAt: number }) {
	const cell = { left: `${h.x}cqw`, top: `${h.y}cqh`, width: `${W}cqw`, height: `${H}cqh` }
	const origin = { transformOrigin: `${h.x + W / 2}cqw ${h.y + H / 2}cqh` }
	return (
		<>
			<Layer className="lpc-r6score-punch" style={{ ...at(clickAt, 420), ...origin }}>
				<img src={poster(hero.poster_path, "w185")} alt="" className="lpc-r5score-wall-cell lpc-r6score-chosen" style={cell} />
			</Layer>
			<div className="lpc-r6score-ripple" style={{ ...at(clickAt, 700), left: `${h.x + W / 2}cqw`, top: `${h.y + H / 2}cqh` } as CSSProperties} />
		</>
	)
}


/** How far the hero has pushed in by the end of chapter 3; chapter 4's first frame starts at this scale. */
export const HERO_PUSH = 1.08

const CLICK = 2300
const READ_OUT = 5250 // [6000] "Picked for you" and the why leave
/** The poster stands alone (still pushing in) for 100 ms after the words have gone; chapter 4 flies through it. */
export const PICK_DIVE_R9_MS = READ_OUT + 450 + 100

export function PickDiveR9({ data }: ClipProps) {
	const w = wallOf(data, { r: 1, c: 6 })
	if (!w.hero) return null
	const s = 62 / H
	const origin = `${w.cx}cqw ${w.cy}cqh`
	const pushAt = CLICK + 1150
	return (
		<div className="lpc-r5score lpc-r6score">
			{/* Chapter 2's last frame, at the scale chapter 2 pushed it to. */}
			<div className="lpc-r9a-pushed" style={{ "--p": RING_PUSH } as CSSProperties}>
				<RingLeaving data={data} />
			</div>
			<Top inAt={450} outAt={CLICK + 100}>
				Somewhere in here is <span className="lpc-r5score-amber">yours.</span>
			</Top>
			<Layer
				className="lpc-r5score-to"
				style={{ ...at(CLICK + 300, 900), transformOrigin: origin, "--tx": `${50 - w.cx}cqw`, "--ty": `${46 - w.cy}cqh`, "--ts": s } as CSSProperties}
			>
				<Layer className="lpc-r5score-fadeout" style={at(CLICK + 500, 500)}>
					<Wall cells={w.cells.filter((x) => x !== w.h)} />
				</Layer>
				<Layer className="lpc-r5score-fadeout" style={at(CLICK + 120, 300)}>
					<Light startAt={850} landAt={CLICK} cx={w.cx} cy={w.cy} />
				</Layer>
				<Layer className="lpc-r5score-fadeout" style={at(CLICK + 1450, 350)}>
					<Click hero={w.hero} h={w.h} clickAt={CLICK} />
				</Layer>
			</Layer>
			<Layer className="lpc-r5score-fade" style={at(pushAt, 250)}>
				<div className="lpc-r9a-push" style={at(pushAt, PICK_DIVE_R9_MS - pushAt, { "--p": HERO_PUSH } as CSSProperties)}>
					<HeroPoster card={w.hero} />
				</div>
			</Layer>
			<Top inAt={CLICK + 900} outAt={READ_OUT}>
				Picked <span className="lpc-r5score-amber">for you.</span>
			</Top>
			<Why data={data} inAt={CLICK + 1150} outAt={READ_OUT} />
		</div>
	)
}
