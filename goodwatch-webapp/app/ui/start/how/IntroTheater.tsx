// The intro film over the whole window, opened from How it works' TV corner (HowItWorksCorner.tsx loads this module
// on press, so the film's code and intro.css come with it and never with the page).
//
// - The camera push: a copy of the corner's room (the same picture where it was drawn) zooms about one fixed point
//   until the TV fills the film's box, the window dims behind it, and the film fades in on the TV as it lands. Close
//   (the button or Escape) pulls back out to the corner. Transform and opacity only.
// - The film is FilmScreen with the film that ends on Your turn (film.ts): Try it, Next on the end card, or a few
//   quiet seconds there pull back out and hand the guest to the search (onTryIt).
// - Without a corner on screen, or with reduced motion, the film's box fades in and out instead.
import {
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import FilmScreen from "~/ui/living-room/intro/FilmScreen"
import { FILM_ENDING_ON_YOUR_TURN } from "~/ui/living-room/intro/film"
import { YourTurnExit } from "~/ui/living-room/intro/scenes/your-turn"
import { type IntroFrom, type Rect, filmBox, pushFrames } from "./intro-push"

export type IntroTheaterProps = {
	/** Where the camera starts: the corner's TV on screen. Null opens the film plainly. */
	from: IntroFrom | null
	/** Closed: back on the page where it was. */
	onClose: () => void
	/** Try it: the theater has closed; the page brings the guest to its search. */
	onTryIt: () => void
}

const EASE = "cubic-bezier(0.65, 0, 0.2, 1)"
const PUSH_MS = 1150
const PULL_MS = 950

const reducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

const finished = (a: Animation | undefined) =>
	a?.finished.then(
		() => undefined,
		() => undefined,
	) ?? Promise.resolve()

/** The window without its scrollbar: the page under the theater keeps its own, so nothing behind moves. */
const viewport = () => ({
	w: document.documentElement.clientWidth,
	h: document.documentElement.clientHeight,
})

function useViewport() {
	const [vp, setVp] = useState(viewport)
	useEffect(() => {
		const on = () => setVp(viewport())
		window.addEventListener("resize", on)
		return () => window.removeEventListener("resize", on)
	}, [])
	return vp
}

export function IntroTheater({ from, onClose, onTryIt }: IntroTheaterProps) {
	const vp = useViewport()
	const film = filmBox({ left: 0, top: 0, width: vp.w, height: vp.h })
	const filmNow = useRef(film)
	filmNow.current = film
	const root = useRef<HTMLDivElement>(null)
	const dim = useRef<HTMLDivElement>(null)
	const room = useRef<HTMLDivElement>(null)
	const shade = useRef<HTMLDivElement>(null)
	const screen = useRef<HTMLDivElement>(null)
	const chrome = useRef<HTMLDivElement>(null)
	const closeButton = useRef<HTMLButtonElement>(null)
	const [phase, setPhase] = useState<"in" | "open" | "out">("in")
	const phaseNow = useRef(phase)
	phaseNow.current = phase
	const [failed, setFailed] = useState(false)
	// Decided once, as the theater opens.
	const [pushed] = useState(
		() => Boolean(from && from.tvRect.width > 0) && !reducedMotion(),
	)

	useLayoutEffect(() => {
		const target = filmNow.current
		const r = room.current
		if (pushed && from && r) {
			r.style.willChange = "transform, opacity"
			const push = r.animate(pushFrames(from, target), {
				duration: PUSH_MS,
				easing: EASE,
				fill: "both",
			})
			// The copy crossfades in over the real corner as the camera starts.
			r.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: 220,
				fill: "both",
			})
			dim.current?.animate([{ opacity: 0 }, { opacity: 0.75 }], {
				duration: 700,
				fill: "both",
			})
			shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: 320,
				delay: PUSH_MS - 330,
				fill: "both",
			})
			screen.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: 360,
				delay: PUSH_MS - 340,
				fill: "both",
			})
			finished(push).then(() => {
				if (phaseNow.current !== "in") return
				r.style.visibility = "hidden"
				r.style.willChange = ""
				setPhase("open")
			})
		} else {
			const rm = reducedMotion()
			shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: 250,
				fill: "both",
			})
			const a = screen.current?.animate(
				[
					{ opacity: 0, transform: rm ? "none" : "scale(0.96)" },
					{ opacity: 1, transform: "none" },
				],
				{
					duration: rm ? 120 : 320,
					delay: 80,
					easing: "ease-out",
					fill: "both",
				},
			)
			finished(a).then(() => phaseNow.current === "in" && setPhase("open"))
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// The film is on: the keyboard starts at Close.
	useEffect(() => {
		if (phase === "open") closeButton.current?.focus({ preventScroll: true })
	}, [phase])

	const closing = useRef(false)
	const close = useCallback(
		async (then: () => void) => {
			if (closing.current) return
			closing.current = true
			const was = phaseNow.current
			setPhase("out")
			const target = filmNow.current
			const fade = (el: HTMLElement | null, ms: number, delay = 0) =>
				el?.animate(
					[{ opacity: Number(getComputedStyle(el).opacity) }, { opacity: 0 }],
					{ duration: ms, delay, fill: "both" },
				)
			fade(chrome.current, 150)
			const r = room.current
			if (was === "open" && pushed && from && r) {
				fade(screen.current, 220)
				for (const a of r.getAnimations()) a.cancel()
				r.style.visibility = "visible"
				r.style.willChange = "transform, opacity"
				r.style.opacity = "1"
				const pull = r.animate(pushFrames(from, target), {
					duration: PULL_MS,
					delay: 120,
					easing: EASE,
					direction: "reverse",
					fill: "both",
				})
				fade(shade.current, 300, 100)
				r.animate([{ opacity: 1 }, { opacity: 0 }], {
					duration: 200,
					delay: 120 + PULL_MS - 200,
					fill: "both",
				})
				fade(dim.current, 450, 600)
				await finished(pull)
			} else {
				await finished(fade(root.current, 220))
			}
			then()
		},
		[from, pushed],
	)
	const closeNow = useCallback(() => close(onClose), [close, onClose])
	const tryIt = useCallback(() => close(onTryIt), [close, onTryIt])
	// Next on the end card steps past the film's last scene: that's Try it too.
	const onAt = useCallback(
		(i: number) => {
			if (i >= FILM_ENDING_ON_YOUR_TURN.length) tryIt()
		},
		[tryIt],
	)
	useTheaterKeys(closeNow, root)

	return createPortal(
		<div
			ref={root}
			className="fixed inset-0 z-[1100]"
			// biome-ignore lint/a11y/useSemanticElements: a full-window layer animated by hand; a <dialog>'s top layer would fight the push-in.
			role="dialog"
			aria-modal="true"
			aria-label="The GoodWatch intro"
		>
			<div
				ref={dim}
				className="fixed inset-0 bg-black"
				style={{ opacity: 0 }}
			/>
			{pushed && from ? <RoomCopy from={from} innerRef={room} /> : null}
			<div
				ref={shade}
				className="fixed inset-0 bg-black"
				style={{ opacity: 0 }}
			/>
			<div
				ref={screen}
				className="fixed overflow-hidden bg-[#05060a]"
				style={{
					left: film.left,
					top: film.top,
					width: film.width,
					height: film.height,
					opacity: 0,
				}}
			>
				{failed ? (
					<div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/60">
						The intro isn't available right now.
					</div>
				) : (
					<YourTurnExit.Provider value={tryIt}>
						<FilmScreen
							scenes={FILM_ENDING_ON_YOUR_TURN}
							startAt={0}
							firstEnter="deal"
							// The film starts as the screen lands.
							waitMs={pushed ? PUSH_MS : 300}
							onAt={onAt}
							onFail={() => setFailed(true)}
						/>
					</YourTurnExit.Provider>
				)}
			</div>
			{phase !== "in" ? (
				<div ref={chrome} className="start-intro-chrome">
					<button
						ref={closeButton}
						type="button"
						onClick={closeNow}
						className="fixed right-3 top-3 z-[40] flex h-10 items-center gap-1.5 rounded-full bg-black/60 pl-3 pr-4 text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-black/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
						aria-label="Close the intro"
					>
						<svg
							viewBox="0 0 24 24"
							className="size-4"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.4"
							strokeLinecap="round"
							aria-hidden="true"
						>
							<path d="M6 6l12 12M18 6L6 18" />
						</svg>
						Close
					</button>
					<TurnHint box={film} vp={vp} />
				</div>
			) : null}
		</div>,
		document.body,
	)
}

/** The corner's room exactly as it was on the page: its picture in the corner's box. */
function RoomCopy({
	from,
	innerRef,
}: {
	from: IntroFrom
	innerRef: RefObject<HTMLDivElement>
}) {
	const r = from.roomRect
	return (
		<div
			ref={innerRef}
			className="pointer-events-none fixed left-0 top-0 overflow-hidden"
			style={{
				left: r.left,
				top: r.top,
				width: r.width,
				height: r.height,
				transformOrigin: "0 0",
				opacity: 0,
			}}
		>
			{from.image.src ? (
				<img
					src={from.image.src}
					alt=""
					draggable={false}
					className="absolute max-w-none select-none"
					style={{
						left: from.image.left,
						top: from.image.top,
						width: from.image.width,
						height: from.image.height,
					}}
				/>
			) : null}
		</div>
	)
}

/** An upright phone's 16:9 picture is small: say how to make it bigger. */
function TurnHint({ box, vp }: { box: Rect; vp: { w: number; h: number } }) {
	if (vp.w >= vp.h || vp.w >= 768) return null
	return (
		<p
			className="pointer-events-none fixed inset-x-0 z-[35] px-4 text-center text-xs text-white/55"
			style={{ top: box.top + box.height + 16 }}
		>
			Turn your phone sideways for a bigger picture.
		</p>
	)
}

/** Escape closes; the page under the theater doesn't scroll (its scrollbar stays, so nothing behind moves). */
function useTheaterKeys(close: () => void, root: RefObject<HTMLElement>) {
	const closeRef = useRef(close)
	closeRef.current = close
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeRef.current()
		}
		const el = root.current
		const stop = (e: Event) => e.preventDefault()
		window.addEventListener("keydown", onKey)
		el?.addEventListener("wheel", stop, { passive: false })
		el?.addEventListener("touchmove", stop, { passive: false })
		return () => {
			window.removeEventListener("keydown", onKey)
			el?.removeEventListener("wheel", stop)
			el?.removeEventListener("touchmove", stop)
		}
	}, [root])
}
