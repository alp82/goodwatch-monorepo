// PROTOTYPE - throwaway. Chapter 3, "Picked for you", round 5. Every clip starts on chapter 2's last frame (RingEnd)
// and ends on the shared hand-over frame (HeroPoster alone), which chapter 4 starts from. In between, many posters
// shuffle and one is picked for the viewer: the hero, with its real match for someone who loved the two titles named
// (the guest recommendations, server/prototype-intro/r5score.server.ts).
import type { CSSProperties, ReactNode } from "react"
import { HeroPoster } from "../../hero"
import type { ClipProps } from "../../clip"
import { Layer, RingEnd, at, pickOf, poster, scoreTitle } from "./common"

/** Chapter 2's last frame, leaving: words fade, the ring shrinks away. */
function RingLeaving({ data }: ClipProps) {
	const { card } = scoreTitle(data)
	if (!card) return null
	return (
		<RingEnd
			card={card}
			wrap={(k, n) => (
				<Layer key={k} className={k === "ring" ? "lpc-r5score-shrinkout" : "lpc-r5score-fadeout"} style={at(k === "ring" ? 250 : 80, 650)}>
					{n}
				</Layer>
			)}
		/>
	)
}

/** A headline above the hero's place that rises at `inAt` and leaves at `outAt`. */
function Top({ children, inAt, outAt }: { children: ReactNode; inAt: number; outAt: number }) {
	return (
		<Layer className="lpc-r5score-fadeout" style={at(outAt, 600)}>
			<div className="lpc-r5score-head lpc-r5score-at-top lpc-r5score-rise" style={at(inAt)}>
				{children}
			</div>
		</Layer>
	)
}

/** Why the hero: its real match on the left, the loved titles on the right. Leaves at `outAt`. */
function Why({ data, inAt, outAt }: { data: ClipProps["data"]; inAt: number; outAt: number }) {
	const { loved, match } = pickOf(data)
	return (
		<Layer className="lpc-r5score-fadeout" style={at(outAt, 600)}>
			{match != null && (
				<div className="lpc-r5score-side lpc-r5score-side-l">
					<div className="lpc-r5score-kick lpc-r5score-fade" style={{ ...at(inAt - 150), color: "#fbbf24" }}>
						Picked for you
					</div>
					<div className="lpc-r5score-match lpc-r5score-rise" style={at(inAt)}>
						{match}%
					</div>
					<div className="lpc-r5score-sub lpc-r5score-rise" style={at(inAt + 150)}>
						your taste
					</div>
				</div>
			)}
			{loved.length > 0 && (
				<div className="lpc-r5score-side lpc-r5score-side-r">
					<div className="lpc-r5score-sub lpc-r5score-rise" style={at(inAt + 250)}>
						Because you loved
					</div>
					<div className="lpc-r5score-loved">
						{loved.map((c, i) => (
							<img key={c.key} src={poster(c.poster_path)} alt="" className="lpc-r5score-deal" style={at(inAt + 400 + i * 150)} />
						))}
					</div>
					<div className="lpc-r5score-sub lpc-r5score-rise" style={at(inAt + 700)}>
						{loved.map((c) => c.title).join(" and ")}
					</div>
				</div>
			)}
		</Layer>
	)
}

const CardBack = ({ style }: { style?: CSSProperties }) => (
	<div className="lpc-r5score-card lpc-r5score-back" style={style}>
		<span style={{ fontWeight: 800, fontSize: "14cqh", color: "#fbbf24", lineHeight: 1 }}>G</span>
	</div>
)

/** A stable pseudo-random number for card i. */
const rnd = (i: number, salt = 1) => {
	const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
	return x - Math.floor(x)
}

/** (a) A deck: many posters land in a stack, shuffle twice, and the top card turns over: picked for you. */
export function PickShuffle({ data }: ClipProps) {
	const { hero } = pickOf(data)
	if (!hero) return null
	const deck = data.pool.slice(1, 15)
	return (
		<div className="lpc-r5score">
			<RingLeaving data={data} />
			<Top inAt={900} outAt={4500}>
				Now, one <span className="lpc-r5score-amber">for you.</span>
			</Top>
			{deck.map((c, i) => {
				const side = i % 2 ? 1 : -1
				const shuffle = {
					"--sx": `${side * (18 + rnd(i) * 10)}cqw`,
					"--sy": `${(rnd(i, 2) - 0.5) * 8}cqh`,
					"--r0": `${(rnd(i, 3) - 0.5) * 10}deg`,
					"--r1": `${side * (6 + rnd(i, 4) * 8)}deg`,
					"--r2": `${-side * (6 + rnd(i, 5) * 8)}deg`,
				} as CSSProperties
				const from = { "--fx": `${(rnd(i, 6) - 0.5) * 120}cqw`, "--fy": `${70 + rnd(i, 7) * 20}cqh`, "--fs": 1.1 } as CSSProperties
				return (
					<Layer key={c.key} className="lpc-r5score-fadeout" style={at(4250 + i * 15, 400)}>
						<Layer className="lpc-r5score-from" style={{ ...at(700 + i * 90, 800), ...from }}>
							<Layer className="lpc-r5score-shuffle" style={{ ...at(2300 + (i % 3) * 60, 2100), ...shuffle }}>
								<img src={poster(c.poster_path, "w500")} alt="" className="lpc-r5score-card" />
							</Layer>
						</Layer>
					</Layer>
				)
			})}
			{/* The top card: lands last, shuffles with the rest, turns over as the hero. */}
			<Layer className="lpc-r5score-from" style={{ ...at(700 + deck.length * 90, 800), "--fx": "0cqw", "--fy": "80cqh" } as CSSProperties}>
				<Layer className="lpc-r5score-shuffle" style={{ ...at(2350, 2100), "--sx": "4cqw", "--sy": "2cqh", "--r0": "0deg", "--r1": "4deg", "--r2": "-4deg" } as CSSProperties}>
					<div className="lpc-r5score-3d">
						<div className="lpc-r5score-flipper lpc-r5score-unturn" style={{ ...at(4800, 1100), transformOrigin: "50cqw 46cqh" }}>
							<div className="lpc-r5score-face">
								<HeroPoster card={hero} />
							</div>
							<div className="lpc-r5score-face lpc-r5score-face-back">
								<CardBack />
							</div>
						</div>
					</div>
				</Layer>
			</Layer>
			<Why data={data} inAt={5700} outAt={7900} />
		</div>
	)
}

/** (b) A reel: posters race past and slow down; it stops on the hero, which grows into its place. */
export function PickReel({ data }: ClipProps) {
	const { hero } = pickOf(data)
	if (!hero) return null
	const others = data.pool.slice(1).filter((c) => c.poster_path)
	const AT = 18
	const strip = [...others.slice(0, AT), hero, ...others.slice(AT, AT + 4)]
	const PITCH = 40 * (2 / 3) + 2 // cqh: poster width plus gap
	return (
		<div className="lpc-r5score">
			<RingLeaving data={data} />
			<Top inAt={900} outAt={4300}>
				From <span className="lpc-r5score-amber">thousands</span> of titles…
			</Top>
			<Layer className="lpc-r5score-fadeout" style={at(4500, 500)}>
				<Layer className="lpc-r5score-fade" style={at(500, 500)}>
					<div
						className="lpc-r5score-reel"
						style={{ ...at(600, 3700), left: `calc(50cqw - ${AT * PITCH + (40 * (2 / 3)) / 2}cqh)`, "--from": `${16 * PITCH}cqh` } as CSSProperties}
					>
						{strip.map((c, i) => (
							<img key={`${c.key}-${i}`} src={poster(c.poster_path)} alt="" />
						))}
					</div>
				</Layer>
			</Layer>
			{/* The hero over its place in the reel, then growing into the hand-over frame. */}
			<Layer className="lpc-r5score-fade" style={at(4250, 200)}>
				<Layer className="lpc-r5score-from" style={{ ...at(4600, 1000), "--fs": 40 / 62, transformOrigin: "50cqw 46cqh" } as CSSProperties}>
					<HeroPoster card={hero} />
				</Layer>
			</Layer>
			<Top inAt={5200} outAt={7800}>
				This one's <span className="lpc-r5score-amber">yours.</span>
			</Top>
			<Why data={data} inAt={5600} outAt={7800} />
		</div>
	)
}

/** (c) Because you loved: the two titles step up, many candidates flicker past, and one lands for you. */
export function PickLoved({ data }: ClipProps) {
	const { hero, loved, match } = pickOf(data)
	if (!hero) return null
	const flicker = data.pool.slice(3, 15)
	const STEP = 170
	const land = 3300 + flicker.length * STEP
	return (
		<div className="lpc-r5score">
			<RingLeaving data={data} />
			<Top inAt={700} outAt={3000}>
				You loved <span className="lpc-r5score-amber">these.</span>
			</Top>
			{/* The loved titles: big in the middle, then aside as the reason. */}
			{loved.map((c, i) => (
				<Layer key={c.key} className="lpc-r5score-fadeout" style={at(7800, 600)}>
					<Layer className="lpc-r5score-to" style={{ ...at(3000, 1000), "--tx": `${16 - (50 + ((i ? 62 : 38) - 50) * 0.42)}cqw`, "--ty": `${(i ? 60 : 34) - (50 + (46 - 50) * 0.42)}cqh`, "--ts": 0.42 } as CSSProperties}>
						<Layer className="lpc-r5score-deal" style={at(900 + i * 250)}>
							<img src={poster(c.poster_path, "w500")} alt="" className="lpc-r5score-card" style={{ left: `${i ? 62 : 38}%`, height: "56cqh" }} />
						</Layer>
					</Layer>
				</Layer>
			))}
			<Layer className="lpc-r5score-fadeout" style={at(7800, 600)}>
				<div className="lpc-r5score-sub lpc-r5score-rise" style={{ ...at(3700), position: "absolute", left: "5cqw", top: "16cqh", width: "26cqw", textAlign: "center" }}>
					Because you loved
				</div>
			</Layer>
			{/* Candidates flicker in the hero's place. */}
			{flicker.map((c, i) => (
				<Layer
					key={c.key}
					style={{ animation: `lpc-r5score-flick calc(${STEP * 1.6}ms * var(--k)) steps(1, end) calc(${3300 + i * STEP}ms * var(--k)) both` } as CSSProperties}
				>
					<img src={poster(c.poster_path, "w500")} alt="" className="lpc-r5score-card" style={{ opacity: 0.85 }} />
				</Layer>
			))}
			<Layer className="lpc-r5score-pop" style={at(land, 800)}>
				<HeroPoster card={hero} />
			</Layer>
			<Top inAt={land + 300} outAt={7800}>
				So, this <span className="lpc-r5score-amber">one.</span>
			</Top>
			{match != null && (
				<Layer className="lpc-r5score-fadeout" style={at(7800, 600)}>
					<div className="lpc-r5score-side lpc-r5score-side-r">
						<div className="lpc-r5score-match lpc-r5score-rise" style={at(land + 500)}>
							{match}%
						</div>
						<div className="lpc-r5score-sub lpc-r5score-rise" style={at(land + 650)}>
							your taste
						</div>
						<div className="lpc-r5score-kick lpc-r5score-fade" style={{ ...at(land + 200), color: "#fbbf24", order: -1 }}>
							Picked for you
						</div>
					</div>
				</Layer>
			)}
		</div>
	)
}
export const LOVED_MS = 9400

/** (d) Exploration: the sign-up wall. Grey posters everywhere, a light searches, finds the hero in color, and it comes forward. */
export function PickWall({ data }: ClipProps) {
	const { hero } = pickOf(data)
	if (!hero) return null
	const COLS = 10
	const ROWS = 3
	const W = 8.6 // cqw
	const H = W * 1.5 * (16 / 9) // cqh
	const GAP = 1.2 // cqw
	const left = (100 - (COLS * W + (COLS - 1) * GAP)) / 2
	const TOP = 16 // cqh
	const RGAP = 2.4 // cqh
	const HERO_AT = { r: 1, c: 6 }
	const cells = Array.from({ length: COLS * ROWS }, (_, n) => {
		const r = Math.floor(n / COLS)
		const c = n % COLS
		const card = r === HERO_AT.r && c === HERO_AT.c ? hero : data.pool[1 + ((n * 7) % (data.pool.length - 1))]
		return { r, c, card, x: left + c * (W + GAP), y: TOP + r * (H + RGAP) }
	})
	const h = cells.find((x) => x.r === HERO_AT.r && x.c === HERO_AT.c)!
	const cx = h.x + W / 2 // cqw
	const cy = h.y + H / 2 // cqh
	return (
		<div className="lpc-r5score">
			<RingLeaving data={data} />
			<Top inAt={700} outAt={4600}>
				Somewhere in here is <span className="lpc-r5score-amber">yours.</span>
			</Top>
			<Layer className="lpc-r5score-fadeout" style={at(5000, 700)}>
				{cells.map((x, n) => (
					<Layer key={n} className="lpc-r5score-deal" style={at(500 + n * 28)}>
						<img
							src={poster(x.card.poster_path)}
							alt=""
							className="lpc-r5score-wall-cell lpc-r5score-grey"
							style={{ left: `${x.x}cqw`, top: `${x.y}cqh`, width: `${W}cqw`, height: `${H}cqh` }}
						/>
					</Layer>
				))}
				<div className="lpc-r5score-light" style={{ ...at(1600, 2800), "--lx": `${cx}cqw`, "--ly": `${cy}cqh` } as CSSProperties} />
			</Layer>
			{/* The hero in color in its cell, then forward into the hand-over frame. */}
			<Layer className="lpc-r5score-fade" style={at(4300, 500)}>
				<Layer
					className="lpc-r5score-from"
					style={{ ...at(5000, 1100), "--fx": `calc(${cx}cqw - 50cqw)`, "--fy": `${cy - 46}cqh`, "--fs": H / 62, transformOrigin: "50cqw 46cqh" } as CSSProperties}
				>
					<HeroPoster card={hero} />
				</Layer>
			</Layer>
			<Top inAt={5700} outAt={8100}>
				Found <span className="lpc-r5score-amber">it.</span>
			</Top>
			<Why data={data} inAt={6000} outAt={8100} />
		</div>
	)
}
