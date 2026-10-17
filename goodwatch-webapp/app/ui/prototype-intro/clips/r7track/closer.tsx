// PROTOTYPE - throwaway. Chapter 11, "your turn" (round 7, from round 5's closer-slots). The owner: "slots fly in.
// instead of the pointer, lets do random tap ripples". "Your turn!" and three empty slots; the slots fly into the
// real quiz's own 1-2-3 as it opens. Then a soft tap ripple shows on a random poster about every second, inviting
// a tap; it never selects anything, and it stops for good the moment the visitor touches or presses anything.
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { FilmTaps } from "~/ui/prototype-landing/film-taps"
import type { ClipProps, IntroData } from "../../clip"
import { A, DEAL, Headline, SWEEP, at, useBoxes } from "../r5track/kit"
import { stageK } from "./kit"

/** How long the quiz chapter holds: the sequence waits on the quiz. */
export const QUIZ_MS = 600_000
/** When the quiz shows, and when the first ripple comes (ms at k = 1). */
const SHOW = 3000
const FIRST_RIPPLE = 4600
const EVERY = 1150

/** The quiz's twelve titles: famous pool titles after the hero. */
const quizCards = (data: IntroData) => data.pool.slice(1).filter((c) => c.poster_path).slice(0, 12)

/** Round 5's closer-slots, with ripples instead of a pointer. */
export function CloserRipples({ data }: ClipProps) {
	const root = useRef<HTMLDivElement>(null)
	const mine = useBoxes(root, ".lpc-r5track-slot-box")
	const theirs = useBoxes(root, ".lpft-slot")
	const ready = mine.length === 3 && theirs.length === 3
	const quizData = { ...data, member: false, landing: quizCards(data) } as unknown as Parameters<typeof FilmTaps>[0]["data"]

	// The ripples: one random poster at a time, never the same twice in a row, until the visitor does anything.
	const [ripple, setRipple] = useState<{ n: number; x: number; y: number } | null>(null)
	useEffect(() => {
		const el = root.current
		if (!el) return
		const k = stageK(el)
		let stopped = false
		let n = 0
		let last = -1
		let timer: ReturnType<typeof setTimeout>
		const stop = () => {
			stopped = true
			clearTimeout(timer)
			setRipple(null)
		}
		const next = () => {
			if (stopped) return
			const r = el.getBoundingClientRect()
			const posters = [...el.querySelectorAll(".lpft-poster")]
			if (r.width && posters.length) {
				let i = Math.floor(Math.random() * posters.length)
				if (i === last) i = (i + 1 + Math.floor(Math.random() * (posters.length - 1))) % posters.length
				last = i
				const b = posters[i].getBoundingClientRect()
				n += 1
				setRipple({ n, x: ((b.left - r.left + b.width / 2) / r.width) * 100, y: ((b.top - r.top + b.height / 2) / r.height) * 100 })
			}
			timer = setTimeout(next, EVERY * k)
		}
		timer = setTimeout(next, FIRST_RIPPLE * k)
		// Any touch, click or key ends the invitation: the visitor has found the quiz.
		el.addEventListener("pointerdown", stop, { capture: true })
		addEventListener("keydown", stop)
		return () => {
			stop()
			el.removeEventListener("pointerdown", stop, { capture: true })
			removeEventListener("keydown", stop)
		}
	}, [])

	return (
		<div ref={root} className="absolute inset-0">
			<div className="lpc-r5track-glow" />
			<div className="lpc-r5track-quiz lpc-r5track-quiz-stagger lpc-r5track-a" style={{ "--qd": `${SHOW + 200}ms`, ...at(["lpc-r5track-in", SHOW, 600]) } as CSSProperties}>
				{/* "Look around": the TV film listens for this and shows the TV home (v-film.tsx). */}
				<FilmTaps data={quizData} onLeave={() => window.dispatchEvent(new Event("lp-film-leave"))} />
			</div>
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
			{ripple && (
				<div key={ripple.n} className="lpc-r7track-tap" style={{ left: `${ripple.x}cqw`, top: `${ripple.y}cqh` }} aria-hidden="true">
					<i className="lpc-r7track-tap-dot" />
					<i className="lpc-r7track-tap-ring" />
					<i className="lpc-r7track-tap-ring lpc-r7track-tap-ring2" />
				</div>
			)}
		</div>
	)
}
