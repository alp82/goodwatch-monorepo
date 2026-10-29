// The film's end on the start page (film.ts, FILM_ENDING_ON_YOUR_TURN): "Your turn", one line, and one amber Try it.
// The start page's search is right under the film, so the film doesn't run its own quiz: Try it, or a few quiet
// seconds, hands the visitor to the page (the theater around the film decides how, through YourTurnExit). The TV's
// film keeps its quiz (scenes/quiz.tsx).
import { createContext, useContext, useEffect, useRef } from "react"
import { Headline, at } from "~/ui/living-room/intro/parts/turn-kit"
import type { SceneProps } from "~/ui/living-room/intro/scene"

/** How long the end card waits with no input before it goes on by itself; the chapter bar fills over it. */
export const YOUR_TURN_MS = 8000
/** After any input, how many quiet ms before it goes on. */
const QUIET_MS = 6000
/** When the button has risen in and takes the keyboard's focus (ms). */
const FOCUS_AT = 900

/** What Try it does: the theater that plays the film provides it. */
export const YourTurnExit = createContext<() => void>(() => {})

export function YourTurn(_: SceneProps) {
	const tryIt = useContext(YourTurnExit)
	const button = useRef<HTMLButtonElement>(null)
	const go = useRef(tryIt)
	go.current = tryIt
	useEffect(() => {
		let timer = setTimeout(() => go.current(), YOUR_TURN_MS)
		const poke = () => {
			clearTimeout(timer)
			timer = setTimeout(() => go.current(), QUIET_MS)
		}
		const events = [
			"pointerdown",
			"pointermove",
			"keydown",
			"wheel",
			"touchstart",
		] as const
		for (const e of events) window.addEventListener(e, poke, { passive: true })
		return () => {
			clearTimeout(timer)
			for (const e of events) window.removeEventListener(e, poke)
		}
	}, [])
	// Keyboard users land on the button once it has risen in.
	useEffect(() => {
		const t = setTimeout(
			() => button.current?.focus({ preventScroll: true }),
			FOCUS_AT,
		)
		return () => clearTimeout(t)
	}, [])
	return (
		<div className="intro-your-turn">
			<Headline text="Your *turn" delay={150} />
			<p
				className="intro-your-turn-line intro-turn-a"
				style={at(["intro-your-turn-rise", 520, 700])}
			>
				Tap three titles you loved and get your first recommendations.
			</p>
			<span
				className="intro-turn-a inline-block"
				style={at(["intro-your-turn-rise", 720, 700])}
			>
				<button
					ref={button}
					type="button"
					onClick={tryIt}
					className="intro-your-turn-try"
				>
					Try it
				</button>
			</span>
		</div>
	)
}
