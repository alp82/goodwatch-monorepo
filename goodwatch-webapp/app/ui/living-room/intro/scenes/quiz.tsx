// The film's end: "Your turn!" and three empty slots, which fly into the quiz's own 1-2-3 as it opens
// (quiz/taste-quiz.tsx). Then a soft tap ripple shows on a random poster every few seconds, inviting a tap; it never
// selects anything, and it stops for good when the visitor touches or presses anything, or points at a poster.
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { FILM_LEAVE_EVENT } from "~/ui/living-room/intro/events"
import { stageK } from "~/ui/living-room/intro/parts/feed-kit"
import {
	A,
	DEAL,
	Headline,
	SWEEP,
	at,
	useBoxes,
} from "~/ui/living-room/intro/parts/turn-kit"
import { TasteQuiz, savedTaps } from "~/ui/living-room/intro/quiz/taste-quiz"
import type { IntroData, SceneProps } from "~/ui/living-room/intro/scene"

/** How long the quiz holds: the film waits on it. */
export const QUIZ_MS = 600_000
/** When the quiz shows, and when the first ripple comes (ms at k = 1). */
const SHOW = 3000
const FIRST_RIPPLE = 4600
const EVERY = 2300

/** The quiz's twelve titles: the intro's titles after Interstellar. */
const quizCards = (data: IntroData) =>
	data.pool
		.slice(1)
		.filter((c) => c.poster_path)
		.slice(0, 12)

export function Quiz({ data }: SceneProps) {
	const root = useRef<HTMLDivElement>(null)
	const mine = useBoxes(root, ".intro-turn-slot-box")
	const theirs = useBoxes(root, ".quiz-slot")
	const ready = mine.length === 3 && theirs.length === 3
	const cards = quizCards(data)
	const leave = () => window.dispatchEvent(new Event(FILM_LEAVE_EVENT))

	// The ripples: one random poster at a time, never the same twice in a row, until the visitor does anything.
	const [ripple, setRipple] = useState<{
		n: number
		x: number
		y: number
	} | null>(null)
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
			const posters = [...el.querySelectorAll(".quiz-poster")]
			if (r.width && posters.length) {
				let i = Math.floor(Math.random() * posters.length)
				if (i === last)
					i =
						(i + 1 + Math.floor(Math.random() * (posters.length - 1))) %
						posters.length
				last = i
				const b = posters[i].getBoundingClientRect()
				n += 1
				setRipple({
					n,
					x: ((b.left - r.left + b.width / 2) / r.width) * 100,
					y: ((b.top - r.top + b.height / 2) / r.height) * 100,
				})
			}
			timer = setTimeout(next, EVERY * k)
		}
		// Back from sign-up with taps made: the visitor knows the quiz, no invitation.
		if (savedTaps()) stopped = true
		else timer = setTimeout(next, FIRST_RIPPLE * k)
		// Any touch, click or key ends the invitation: the visitor has found the quiz. So does pointing the Remote (or
		// the mouse) at a poster: the TV's pointer moving over the tiles.
		const over = (e: PointerEvent) => {
			if ((e.target as Element | null)?.closest?.(".quiz-poster")) stop()
		}
		el.addEventListener("pointerdown", stop, { capture: true })
		el.addEventListener("pointermove", over)
		addEventListener("keydown", stop)
		return () => {
			stop()
			el.removeEventListener("pointerdown", stop, { capture: true })
			el.removeEventListener("pointermove", over)
			removeEventListener("keydown", stop)
		}
	}, [])

	// Back from sign-up: the quiz as the visitor left it, without "Your turn!" and the slots flying in again.
	const [back] = useState(
		() => typeof window !== "undefined" && Boolean(savedTaps()),
	)
	if (back)
		return (
			<div ref={root} className="absolute inset-0">
				<div className="intro-turn-quiz">
					<TasteQuiz cards={cards} onLeave={leave} />
				</div>
			</div>
		)

	return (
		<div ref={root} className="absolute inset-0">
			<div className="intro-turn-glow" />
			<div
				className="intro-turn-quiz intro-turn-quiz-stagger intro-turn-a"
				style={
					{
						"--qd": `${SHOW + 200}ms`,
						...at(["intro-turn-in", SHOW, 600]),
					} as CSSProperties
				}
			>
				{/* "Just look around": the intro steps aside for the TV's home (HomeIntro.tsx). */}
				<TasteQuiz cards={cards} onLeave={leave} />
			</div>
			<div className="intro-turn-turn">
				<div
					className={A()}
					style={at(["intro-turn-to", 2700, 700, SWEEP], undefined, undefined, {
						"--ty": "-10cqh",
					} as CSSProperties)}
				>
					<Headline
						text="Your *turn!*"
						delay={150}
						step={220}
						className="intro-turn-h-huge"
					/>
					<p
						className="intro-turn-h intro-turn-h-mid intro-turn-a"
						style={{ marginTop: "2cqh", ...at(["intro-turn-rise", 1300, 800]) }}
					>
						Tap three you loved.
					</p>
				</div>
				<div className="intro-turn-slots">
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
								className={`intro-turn-slot-box ${ready ? A(1) : ""}`}
								style={
									ready
										? at(
												["intro-turn-to", 2700 + i * 90, 850, DEAL],
												["intro-turn-out", 3700, 300],
												undefined,
												fly,
											)
										: undefined
								}
							>
								<div
									className="intro-turn-slot intro-turn-a"
									style={at(["intro-turn-pop", 700 + i * 130, 650, DEAL])}
								>
									{n}
								</div>
							</div>
						)
					})}
				</div>
			</div>
			{ripple && (
				<div
					key={ripple.n}
					className="intro-feed-tap"
					style={{ left: `${ripple.x}cqw`, top: `${ripple.y}cqh` }}
					aria-hidden="true"
				>
					<i className="intro-feed-tap-dot" />
					<i className="intro-feed-tap-ring" />
					<i className="intro-feed-tap-ring intro-feed-tap-ring2" />
				</div>
			)}
		</div>
	)
}
