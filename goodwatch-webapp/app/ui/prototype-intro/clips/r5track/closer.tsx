// PROTOTYPE - throwaway. Chapter 10, "your turn" (round 5): "Your turn!" and then the real tap-three quiz begins,
// inside the clip (FilmTaps from the start page's film variant, fed with famous pool titles). The clip holds there
// for as long as the visitor plays, so a sequence stops on it.
import { type CSSProperties, useRef } from "react"
import { FilmTaps } from "~/ui/prototype-landing/film-taps"
import type { ClipProps, IntroData } from "../../clip"
import { A, DEAL, Headline, SWEEP, at, img, useBoxes } from "./kit"

/** How long the quiz chapters hold: the sequence waits on the quiz. */
export const QUIZ_MS = 600_000

/** The quiz's twelve titles: famous pool titles after the hero, as FilmTaps picks them. */
const quizCards = (data: IntroData) => data.pool.slice(1).filter((c) => c.poster_path).slice(0, 12)

/** The real quiz, above the chapter bar. `mode` sets how its posters arrive; `at` when it shows. */
function Quiz({ data, show, posters, mode = "stagger" }: { data: IntroData; show: number; posters: number; mode?: "stagger" | "land" }) {
	const quizData = { ...data, member: false, landing: quizCards(data) } as unknown as Parameters<typeof FilmTaps>[0]["data"]
	return (
		<div
			className={`lpc-r5track-quiz lpc-r5track-quiz-${mode} lpc-r5track-a`}
			style={{ "--qd": `${posters}ms`, ...at(["lpc-r5track-in", show, 600]) } as CSSProperties}
		>
			{/* "Look around" has nowhere to go inside the lab: it does nothing here. */}
			{/* "Look around": the TV film listens for this and shows the TV home (v-film.tsx). */}
			<FilmTaps data={quizData} onLeave={() => window.dispatchEvent(new Event("lp-film-leave"))} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** A. "Your turn!" fills the screen, then shrinks away to where the quiz's own kicker sits as the quiz deals in. */
export function CloserShrink({ data }: ClipProps) {
	return (
		<>
			<div className="lpc-r5track-glow" />
			<Quiz data={data} show={1900} posters={2200} />
			<div className={`lpc-r5track-turn ${A()}`} style={at(["lpc-r5track-to", 1700, 900, SWEEP], undefined, undefined, { "--tx": "-34cqw", "--ty": "-38cqh", "--ts": "0.22" } as CSSProperties)}>
				<Headline text="Your *turn!*" delay={200} step={220} className="lpc-r5track-h-huge" />
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** B. "Your turn!" over the quiz, then the Explorer tutorial's pointer taps the first poster to show how. */
export function CloserPing({ data }: ClipProps) {
	const root = useRef<HTMLDivElement>(null)
	const first = useBoxes(root, ".lpft-poster")[0]
	return (
		<div ref={root} className="absolute inset-0">
			<Quiz data={data} show={900} posters={1100} />
			<div className={`absolute inset-0 bg-[#05060a] ${A()}`} style={{ zIndex: 6, ...at(["lpc-r5track-out", 1500, 600]) }} />
			<div className={`lpc-r5track-turn ${A()}`} style={at(["lpc-r5track-to", 1550, 700, SWEEP], undefined, undefined, { "--ty": "-6cqh", "--ts": "1.08" } as CSSProperties)}>
				<Headline text="Your *turn!*" delay={150} step={220} className="lpc-r5track-h-huge" />
			</div>
			{first && (
				<>
					<div className="lpc-r5track-ripple" style={{ left: `${first.x}cqw`, top: `${first.y}cqh`, "--d": "2600ms" } as CSSProperties} />
					<svg className="lpc-r5track-hand" viewBox="0 0 32 40" style={{ left: `${first.x}cqw`, top: `${first.y}cqh`, "--d": "2600ms" } as CSSProperties} aria-hidden="true">
						<path d="M3 2l24 22-11 1.5 6.5 12-5 2.5-6.5-12.5L3 34z" fill="#fff" stroke="#0a0e1a" strokeWidth="2.2" strokeLinejoin="round" />
					</svg>
				</>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** C. "Your turn!" with three empty slots under it; the slots fly up into the quiz's own 1-2-3 as it opens. */
export function CloserSlots({ data }: ClipProps) {
	const root = useRef<HTMLDivElement>(null)
	const mine = useBoxes(root, ".lpc-r5track-slot-box")
	const theirs = useBoxes(root, ".lpft-slot")
	const ready = mine.length === 3 && theirs.length === 3
	return (
		<div ref={root} className="absolute inset-0">
			<div className="lpc-r5track-glow" />
			<Quiz data={data} show={3000} posters={3200} />
			<div className="lpc-r5track-turn">
				<div className={A()} style={at(["lpc-r5track-to", 2700, 700, SWEEP], undefined, undefined, { "--ty": "-10cqh" } as CSSProperties)}>
					<Headline text="Your *turn!*" delay={150} step={220} className="lpc-r5track-h-huge" />
					<p className="lpc-r5track-h lpc-r5track-h-mid lpc-r5track-a" style={{ marginTop: "2cqh", ...at(["lpc-r5track-rise", 1300, 800]) }}>
						Tap three you loved.
					</p>
				</div>
				<div className="lpc-r5track-slots">
					{[1, 2, 3].map((n, i) => {
						const fly = ready
							? ({
									"--tx": `${theirs[i].x - mine[i].x}cqw`,
									"--ty": `${theirs[i].y - mine[i].y}cqh`,
									"--ts": `${theirs[i].w / mine[i].w}`,
									"--to": "1",
								} as CSSProperties)
							: undefined
						return (
							<div
								key={n}
								className={`lpc-r5track-slot-box ${ready ? A(1) : ""}`}
								style={ready ? at(["lpc-r5track-to", 2700 + i * 90, 850, DEAL], ["lpc-r5track-out", 3700, 300], undefined, fly) : undefined}
							>
								<div className="lpc-r5track-slot lpc-r5track-a" style={at(["lpc-r5track-pop", 700 + i * 130, 650, DEAL])}>
									{n}
								</div>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
/** D. Exploration: the posters float in a loose cloud around "Your turn!", then settle into the quiz's grid. */
export function CloserGather({ data }: ClipProps) {
	const root = useRef<HTMLDivElement>(null)
	const cells = useBoxes(root, ".lpft-poster")
	const cards = quizCards(data)
	const LAND = 2300
	return (
		<div ref={root} className="absolute inset-0">
			<div className="lpc-r5track-glow" />
			<Quiz data={data} show={1900} posters={LAND} mode="land" />
			<div className={`lpc-r5track-turn ${A()}`} style={{ zIndex: 7, ...at(["lpc-r5track-to", 1700, 700, SWEEP], undefined, undefined, { "--ty": "-8cqh", "--ts": "0.9" } as CSSProperties) }}>
				<Headline text="Your *turn!*" delay={250} step={220} className="lpc-r5track-h-huge" />
			</div>
			{cells.length === cards.length &&
				cards.map((c, i) => {
					const cell = cells[i]
					// A loose ring around the words, the same for every visit.
					const a = (i / cards.length) * Math.PI * 2 + 0.4
					const sx = 50 + Math.cos(a) * 40
					const sy = 48 + Math.sin(a) * 34
					const land = LAND + i * 70
					return (
						<img
							key={c.key}
							src={img(c.poster_path, "w185")}
							alt=""
							className="lpc-r5track-fly"
							style={{
								left: `${cell.x - cell.w / 2}cqw`,
								top: `${cell.y - cell.h / 2}cqh`,
								width: `${cell.w}cqw`,
								height: `${cell.h}cqh`,
								"--fx": `${sx - cell.x}cqw`,
								"--fy": `${sy - cell.y}cqh`,
								"--fr": `${((i * 37) % 30) - 15}deg`,
								"--fs": "0.8",
								animation: `lpc-r5track-gather calc(${land}ms * var(--k, 1)) linear both, lpc-r5track-out calc(300ms * var(--k, 1)) ease-out calc(${land + 450}ms * var(--k, 1)) forwards`,
							} as CSSProperties}
							draggable={false}
						/>
					)
				})}
		</div>
	)
}
