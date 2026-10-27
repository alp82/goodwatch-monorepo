// PROTOTYPE (start page lab): tv a · Camera push-in. A play button sized to the tiny screen and a "Watch the intro"
// label under the TV; pressing either pushes the camera into the room until the screen fills the window, and the film
// fades in on it as it lands. Close pulls back out. Variant d reuses this Theater with a remote beside the picture.
import { type ComponentType, useLayoutEffect, useRef, useState } from "react"
import type { IntroFrom, Rect } from "../../lab/types"
import {
	CloseButton,
	EASE,
	Film,
	type FilmControl,
	FilmFailed,
	NearLabel,
	PlayGlyph,
	RoomCopy,
	TurnHint,
	done,
	filmBox,
	pushFrames,
	reducedMotion,
	useFilmControl,
	useIntroData,
	useOnce,
	useTheater,
	useViewport,
} from "./kit"

export function PushHint({ size, onPlay }: { size: { w: number; h: number }; onPlay: () => void }) {
	// The screen element is 300 px wide in its own space; the button is a quarter of the screen's height.
	const d = Math.max(28, Math.round(size.h * 0.34))
	return (
		<button
			type="button"
			onClick={onPlay}
			className="labtv-hint flex h-full w-full items-center justify-center bg-black/30"
			aria-label="Watch the intro"
		>
			<span className="labtv-play" style={{ width: d, height: d }}>
				<PlayGlyph style={{ width: d * 0.5, height: d * 0.5, marginLeft: d * 0.06 }} />
			</span>
		</button>
	)
}

export function PushNear({ tvRect, onPlay }: { tvRect: Rect; onPlay: () => void }) {
	return (
		<NearLabel tvRect={tvRect} onPlay={onPlay} className="labtv-label-in">
			<span className="labtv-label-dot">
				<PlayGlyph className="ml-px size-2.5" />
			</span>
			Watch the intro
		</NearLabel>
	)
}

export type TheaterLayout = (vp: { w: number; h: number }) => { film: Rect; controls?: Rect }

const fullLayout: TheaterLayout = (vp) => ({ film: filmBox({ left: 0, top: 0, width: vp.w, height: vp.h }) })

const PUSH_MS = 1150

export function PushTheater({
	from,
	onClose,
	layout = fullLayout,
	Controls,
}: {
	from: IntroFrom | null
	onClose: () => void
	layout?: TheaterLayout
	Controls?: ComponentType<{ control: FilmControl; onPower: () => void }>
}) {
	const vp = useViewport()
	const box = layout(vp)
	const T = box.film
	const boxNow = useRef(box)
	boxNow.current = box
	const root = useRef<HTMLDivElement>(null)
	const dim = useRef<HTMLDivElement>(null)
	const room = useRef<HTMLDivElement>(null)
	const shade = useRef<HTMLDivElement>(null)
	const screen = useRef<HTMLDivElement>(null)
	const chrome = useRef<HTMLDivElement>(null)
	const filmEl = useRef<HTMLDivElement | null>(null)
	const [phase, setPhase] = useState<"in" | "open" | "out">("in")
	const phaseNow = useRef(phase)
	phaseNow.current = phase
	const { data, failed } = useIntroData()
	const film = useFilmControl(filmEl)
	const pushed = Boolean(from && from.tvRect.width > 0)

	useLayoutEffect(() => {
		const rm = reducedMotion()
		const target = boxNow.current.film
		if (pushed && from && room.current && !rm) {
			const r = room.current
			r.style.willChange = "transform, opacity"
			const push = r.animate(pushFrames(from, target), { duration: PUSH_MS, easing: EASE, fill: "both" })
			// The copy has no live posters: it crossfades in over the real room as the camera starts.
			r.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: "both" })
			dim.current?.animate([{ opacity: 0 }, { opacity: 0.75 }], { duration: 700, fill: "both" })
			shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: PUSH_MS - 330, fill: "both" })
			screen.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, delay: PUSH_MS - 340, fill: "both" })
			done(push).then(() => {
				if (phaseNow.current !== "in") return
				r.style.visibility = "hidden"
				r.style.willChange = ""
				setPhase("open")
			})
		} else {
			shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "both" })
			const a = screen.current?.animate(
				[
					{ opacity: 0, transform: "scale(0.96)" },
					{ opacity: 1, transform: "none" },
				],
				{ duration: rm ? 120 : 320, delay: 80, easing: "ease-out", fill: "both" },
			)
			done(a).then(() => phaseNow.current === "in" && setPhase("open"))
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const close = useOnce(async () => {
		const was = phaseNow.current
		setPhase("out")
		const target = boxNow.current.film
		const fade = (el: HTMLElement | null, ms: number, delay = 0) =>
			el?.animate([{ opacity: Number(getComputedStyle(el).opacity) }, { opacity: 0 }], { duration: ms, delay, fill: "both" })
		fade(chrome.current, 150)
		const r = room.current
		if (was === "open" && pushed && from && r && !reducedMotion()) {
			fade(screen.current, 220)
			for (const a of r.getAnimations()) a.cancel()
			r.style.visibility = "visible"
			r.style.willChange = "transform, opacity"
			r.style.opacity = "1"
			const pull = r.animate(pushFrames(from, target), {
				duration: 950,
				delay: 120,
				easing: EASE,
				direction: "reverse",
				fill: "both",
			})
			fade(shade.current, 300, 100)
			r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 120 + 950 - 200, fill: "both" })
			fade(dim.current, 450, 600)
			await done(pull)
		} else {
			await done(fade(root.current, 220))
		}
		onClose()
	})
	useTheater(close, root)

	return (
		<div ref={root} className="fixed inset-0 z-[1000]" role="dialog" aria-label="The GoodWatch intro">
			<div ref={dim} className="fixed inset-0 bg-black" style={{ opacity: 0 }} />
			{pushed && from ? <RoomCopy from={from} innerRef={room} /> : null}
			<div ref={shade} className="fixed inset-0 bg-black" style={{ opacity: 0 }} />
			<div
				ref={screen}
				className="fixed overflow-hidden bg-[#05060a]"
				style={{ left: T.left, top: T.top, width: T.width, height: T.height, opacity: 0 }}
			>
				{failed ? (
					<FilmFailed />
				) : data && phase !== "in" ? (
					<div className="labtv-fade-in absolute inset-0">
						<Film
							data={data}
							boxRef={filmEl}
							paused={film.control.paused}
							startAt={film.startAt}
							run={film.run}
							onAt={film.onAt}
						/>
						{film.control.paused ? (
							<span className="pointer-events-none absolute left-3 top-3 z-[30] rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
								Paused
							</span>
						) : null}
					</div>
				) : null}
			</div>
			{phase !== "in" ? (
				<div ref={chrome} className="labtv-fade-in">
					{Controls && box.controls ? (
						<div
							className="labtv-rise fixed z-[40]"
							style={{ left: box.controls.left, top: box.controls.top, width: box.controls.width, height: box.controls.height }}
						>
							<Controls control={film.control} onPower={close} />
						</div>
					) : null}
					{Controls ? null : <CloseButton onClick={close} />}
					{Controls ? null : <TurnHint box={T} vp={vp} />}
				</div>
			) : null}
		</div>
	)
}
