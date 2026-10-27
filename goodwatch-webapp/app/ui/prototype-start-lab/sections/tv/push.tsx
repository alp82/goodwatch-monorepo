// PROTOTYPE (start page lab): tv a · Camera push-in. One amber "Watch the intro" pill on (or just under) the quiet
// standby screen; pressing it (or the screen) pushes the camera into the room until the screen fills the window, and the film
// fades in on it as it lands. Close pulls back out. Variant d reuses this Theater with a remote beside the picture.
import { type ComponentType, useLayoutEffect, useRef, useState } from "react"
import type { IntroFrom, Rect } from "../../lab/types"
import {
	CloseButton,
	EASE,
	Film,
	type FilmControl,
	FilmFailed,
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
import "./push.css"

export function PushHint({ onPlay }: { size: { w: number; h: number }; onPlay: () => void }) {
	// The screen only shows standby glass; the pill (PushNear) is the one control. A tap on the screen still plays,
	// but the screen isn't a second button for keyboards and screen readers.
	return <div className="labtv-push-glass h-full w-full" onClick={onPlay} aria-hidden="true" />
}

/**
 * The one control: an amber "Watch the intro" pill, centered on the screen when the screen is big enough to hold
 * it, else just under the screen (above it when there's no room below), kept inside the room's box.
 */
export function PushNear({ tvRect, onPlay }: { tvRect: Rect; onPlay: () => void }) {
	const ref = useRef<HTMLSpanElement>(null)
	const [at, setAt] = useState<{ left: number; top: number } | null>(null)
	useLayoutEffect(() => {
		const el = ref.current
		const parent = el?.offsetParent as HTMLElement | null
		if (!el || !parent) return
		const W = parent.clientWidth
		const H = parent.clientHeight
		const w = el.offsetWidth
		const h = el.offsetHeight
		const cx = tvRect.left + tvRect.width / 2
		const onScreen = w <= tvRect.width - 12 && h <= tvRect.height * 0.62
		const below = tvRect.top + tvRect.height + 10
		const above = tvRect.top - 10 - h
		let top = onScreen
			? tvRect.top + (tvRect.height - h) / 2
			: below + h <= H - 8
				? below
				: above >= 8
					? above
					: tvRect.top + tvRect.height - h - 6
		top = Math.min(Math.max(8, top), Math.max(8, H - 8 - h))
		const left = Math.min(Math.max(8, cx - w / 2), Math.max(8, W - 8 - w))
		setAt({ left, top })
	}, [tvRect.left, tvRect.top, tvRect.width, tvRect.height])
	return (
		<span
			ref={ref}
			className="labtv-pill-at"
			style={at ? { left: at.left, top: at.top } : { left: 0, top: 0, visibility: "hidden" }}
		>
			<button type="button" onClick={onPlay} className="labtv-pill" data-labtv-play>
				<span className="labtv-pill-dot">
					<PlayGlyph className="ml-0.5 size-4" />
				</span>
				Watch the intro
			</button>
		</span>
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
