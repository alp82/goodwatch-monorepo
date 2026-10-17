// PROTOTYPE - throwaway. Chapter 4, "How it feels", round 5: bolder takes on round 4's attributes clip, for the hero.
// Every clip starts on the shared hand-over frame (hero.tsx: the hero's poster alone, centred) and opens up from it.
import type { CSSProperties } from "react"
import type { ClipProps } from "../../clip"
import { HeroPoster } from "../../hero"
import { Missing, Root, at, img, r5, sayable } from "./kit"

/** The hero's poster in its hand-over place, moving to (x, y, scale) from `ms` over `len`. */
function MovingHero({ data, ms, to, len = 1000 }: ClipProps & { ms: number; to: [string, string, number]; len?: number }) {
	const card = data.pool[0]
	if (!card) return null
	return (
		<div
			className="lpc-r5f-herowrap"
			style={at(ms, { "--hx": to[0], "--hy": to[1], "--hs": to[2], "--len": `${len}ms` })}
		>
			<HeroPoster card={card} />
		</div>
	)
}

/** The hero's backdrop, alive: it fades in at `ms` and drifts for the rest of the clip. */
function Backdrop({ path, ms, dim = 0.6, side }: { path: string | null; ms: number; dim?: number; side?: "left" | "right" }) {
	return (
		<>
			<div className="lpc-r5f-bd lpc-r5f-fade" style={at(ms, { "--len": "1400ms" })}>
				<img src={img(path, "w1280")} alt="" className="lpc-r5f-kb" />
			</div>
			<div className="lpc-r5f-fade absolute inset-0" style={at(ms, { "--len": "1400ms" })}>
				<div
					className="absolute inset-0"
					style={{
						background:
							side === "left"
								? `linear-gradient(90deg, rgba(5,6,10,${dim + 0.3}) 0, rgba(5,6,10,${dim}) 45%, rgba(5,6,10,${dim + 0.25}) 100%)`
								: side === "right"
									? `linear-gradient(270deg, rgba(5,6,10,${Math.min(0.97, dim + 0.35)}) 0, rgba(5,6,10,${dim + 0.15}) 55%, rgba(5,6,10,${dim - 0.1}) 100%)`
									: `radial-gradient(60% 70% at 50% 46%, rgba(5,6,10,${dim - 0.15}) 0, rgba(5,6,10,${dim + 0.3}) 100%)`,
					}}
				/>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// A. Burst: the poster steps back, and its four strongest feelings burst out of it to the corners, huge, each with a
// bar that slams full.
export const BURST_MS = 7200
export function AttributesBurst({ data }: ClipProps) {
	const hero = r5(data)?.hero
	if (!hero || !data.pool[0]) return <Missing />
	const words = sayable(hero.top, 4)
	// Final places: two to the left of the poster (right-aligned), two to the right; the burst starts at the poster.
	const spots = [
		{ x: "left", y: 27, fx: "26cqw", fy: "14cqh" },
		{ x: "right", y: 27, fx: "-26cqw", fy: "14cqh" },
		{ x: "left", y: 54, fx: "26cqw", fy: "-12cqh" },
		{ x: "right", y: 54, fx: "-26cqw", fy: "-12cqh" },
	] as const
	return (
		<Root>
			<Backdrop path={hero.backdrop_path} ms={650} dim={0.62} />
			<MovingHero data={data} ms={650} to={["0cqw", "0cqh", 0.7]} len={1100} />
			<div className="lpc-r5f-head lpc-r5f-rise absolute left-0 right-0 top-[6cqh] text-center" style={at(900)}>
				How it <em>feels.</em>
			</div>
			{words.map((w, i) => {
				const s = spots[i]
				return (
					<div
						key={w.key}
						className={`lpc-r5f-burst absolute ${s.x === "left" ? "right-[61cqw] items-end text-right" : "left-[61cqw] items-start"} flex flex-col`}
						style={at(1500 + i * 380, { top: `${s.y}cqh`, "--fx": s.fx, "--fy": s.fy })}
					>
						<div className="lpc-r5f-word">
							{s.x === "right" && <span className="lpc-r5f-emoji">{w.emoji}</span>}
							<span className={i === words.length - 1 ? "text-amber-300" : ""}>{w.word}</span>
							{s.x === "left" && <span className="lpc-r5f-emoji">{w.emoji}</span>}
						</div>
						<div className="lpc-r5f-bar" style={{ width: "20cqw" }}>
							<b
								className="lpc-r5f-slam"
								style={{ ...at(1900 + i * 380), background: w.hex, transformOrigin: s.x === "left" ? "100% 50%" : "0 50%" }}
							/>
						</div>
					</div>
				)
			})}
			<div className="lpc-r5f-sub lpc-r5f-rise absolute bottom-[12cqh] left-0 right-0 text-center" style={at(3700)}>
				Read from the story itself. For every movie and show.
			</div>
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// B. Stack: round 4's favourite, bolder. The poster slides left, the backdrop comes alive, and four huge feelings slam
// in on the right one by one, each with a thick bar in its own colour.
export const STACK_MS = 7400
export function AttributesStack({ data }: ClipProps) {
	const hero = r5(data)?.hero
	if (!hero || !data.pool[0]) return <Missing />
	const words = sayable(hero.top, 4)
	return (
		<Root>
			<Backdrop path={hero.backdrop_path} ms={650} dim={0.55} side="right" />
			<MovingHero data={data} ms={650} to={["-29cqw", "0cqh", 0.86]} len={1100} />
			<div className="absolute left-[44cqw] right-[5cqw] top-[9cqh]">
				<div className="lpc-r5f-kicker lpc-r5f-rise" style={at(1000)}>
					How {hero.title} feels
				</div>
				<div className="mt-[3.2cqh] flex flex-col gap-[3cqh]">
					{words.map((w, i) => (
						<div key={w.key} className="lpc-r5f-slamin" style={at(1500 + i * 600)}>
							<div className={`lpc-r5f-word lpc-r5f-word-xl ${i === words.length - 1 ? "text-amber-300" : ""}`}>
								<span className="lpc-r5f-emoji">{w.emoji}</span>
								{w.word}
							</div>
							<div className="lpc-r5f-bar lpc-r5f-bar-thick lpc-r5f-phone-hide" style={{ width: "36cqw" }}>
								<b className="lpc-r5f-slam" style={{ ...at(1800 + i * 600), background: w.hex, width: `${Math.min(100, w.value * 10)}%` }} />
							</div>
						</div>
					))}
				</div>
			</div>
			<div className="lpc-r5f-sub lpc-r5f-rise absolute bottom-[12cqh] left-[44cqw]" style={at(4400)}>
				Read from the story itself. For every movie and show.
			</div>
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// C. Reel: one feeling at a time, as big as the screen allows, slammed in over the living backdrop; then all four
// together under "That's Interstellar."
export const REEL_MS = 7800
export function AttributesReel({ data }: ClipProps) {
	const hero = r5(data)?.hero
	if (!hero || !data.pool[0]) return <Missing />
	const words = sayable(hero.top, 4)
	const STEP = 950
	const first = 1400
	const end = first + words.length * STEP
	return (
		<Root>
			<Backdrop path={hero.backdrop_path} ms={650} dim={0.5} side="left" />
			<MovingHero data={data} ms={650} to={["-31cqw", "0cqh", 0.78]} len={1000} />
			<div className="lpc-r5f-kicker lpc-r5f-rise absolute left-[38cqw] top-[16cqh]" style={at(900)}>
				How it feels
			</div>
			{/* One word at a time in the same place: each arrives big and leaves upward as the next one lands. */}
			<div className="absolute left-[38cqw] right-[4cqw] top-[24cqh] h-[24cqh]">
				{words.map((w, i) => (
					<div key={w.key} className="lpc-r5f-reel-in absolute inset-0" style={at(first + i * STEP)}>
						{/* The last word stays: only the others get a leaving box (a child would inherit the arrival's delay). */}
						{i < words.length - 1 ? (
							<div className="lpc-r5f-reel-out" style={at(first + (i + 1) * STEP - 120)}>
								<div className="lpc-r5f-reel-word">
									<span className="lpc-r5f-emoji">{w.emoji}</span> {w.word}.
								</div>
							</div>
						) : (
							<div className="lpc-r5f-reel-word text-amber-300">
								<span className="lpc-r5f-emoji">{w.emoji}</span> {w.word}.
							</div>
						)}
					</div>
				))}
			</div>
			<div className="absolute left-[38cqw] right-[4cqw] top-[52cqh]">
				<div className="flex flex-wrap gap-[1.2cqw]">
					{words.map((w, i) => (
						<span key={w.key} className="lpc-r5f-chip lpc-r5f-pop" style={at(end + 200 + i * 140, { "--c": w.hex })}>
							<span aria-hidden="true">{w.emoji}</span> {w.word}
						</span>
					))}
				</div>
				<div className="lpc-r5f-line lpc-r5f-rise mt-[3cqh]" style={at(end + 900)}>
					That's <em>{hero.title}.</em>
				</div>
			</div>
		</Root>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// D. Exploration: the feel card. The poster flips over like a trading card: on its back, how it feels. Then two more
// famous titles deal in beside it and flip too, each with a very different card.
export const CARD_MS = 7600
export function AttributesCard({ data }: ClipProps) {
	const d = r5(data)
	const hero = d?.hero
	const card = data.pool[0]
	if (!hero || !card) return <Missing />
	const others = (d?.others ?? []).slice(0, 2)
	return (
		<Root>
			<div className="lpc-r5f-fade absolute inset-0" style={at(2800, { "--len": "1200ms" })}>
				<div className="absolute inset-0" style={{ background: "radial-gradient(70% 70% at 50% 46%, #141a27 0, #05060a 75%)" }} />
			</div>
			{/* The two others, either side, dealt in face up and flipped. */}
			{others.map((o, i) => (
				<div
					key={o.title}
					className="lpc-r5f-side-wrap"
					style={at(2700 + i * 250, { "--sx": i === 0 ? "-31cqw" : "31cqw", "--dx": i === 0 ? "-12cqw" : "12cqw" })}
				>
					<FeelCard title={o} front={img(o.poster_path, "w342")} flipAt={3700 + i * 250} small />
				</div>
			))}
			<div className="lpc-r5f-card-place">
				<FeelCard title={hero} front={img(card.poster_path, "w500")} flipAt={700} />
			</div>
			<div className="lpc-r5f-line lpc-r5f-rise absolute bottom-[11cqh] left-0 right-0 text-center" style={at(5000)}>
				Every movie and show has <em>a feel of its own.</em>
			</div>
		</Root>
	)
}

function FeelCard({ title, front, flipAt, small = false }: { title: NonNullable<ReturnType<typeof r5>>["others"][number]; front: string; flipAt: number; small?: boolean }) {
	const words = sayable(title.top, small ? 3 : 4)
	return (
		<div className={`lpc-r5f-card ${small ? "lpc-r5f-card-small" : ""}`}>
			<div className="lpc-r5f-flip" style={at(flipAt)}>
				<div className="lpc-r5f-face">
					<img src={front} alt="" />
				</div>
				<div className="lpc-r5f-face lpc-r5f-back">
					<div className="lpc-r5f-back-bd" style={{ backgroundImage: `url(${img(title.backdrop_path, "w780")})` } as CSSProperties} />
					<div className="relative flex h-full flex-col justify-center gap-[1.6cqh] px-[8%]">
						<div className="lpc-r5f-back-title">{title.title}</div>
						{words.map((w, i) => (
							<div key={w.key} className="lpc-r5f-back-row lpc-r5f-rise" style={at(flipAt + 450 + i * 160)}>
								<span className="lpc-r5f-back-word">
									<span aria-hidden="true">{w.emoji}</span> {w.word}
								</span>
								<span className="lpc-r5f-bar">
									<b className="lpc-r5f-slam" style={{ ...at(flipAt + 600 + i * 160), background: w.hex, width: `${Math.min(100, w.value * 10)}%` }} />
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}
