// PROTOTYPE (start page lab): tv b · Screen lifts out. The TV sits in standby (dark glass, a breathing amber light,
// a soft glow on the wall and a label above it); pressing it lifts the screen out of the TV, from its four corners
// in perspective to a flat full-window picture, while the room dims behind. Close puts it back.
import { useLayoutEffect, useRef, useState } from "react"
import type { IntroFrom, Rect } from "../../lab/types"
import { quadTransform } from "../../scene/homography"
import {
	CloseButton,
	EASE,
	Film,
	FilmFailed,
	NearLabel,
	PlayGlyph,
	type Quad4,
	TurnHint,
	done,
	filmBox,
	morphFrames,
	rectQuad,
	reducedMotion,
	useIntroData,
	useOnce,
	useTheater,
	useViewport,
} from "./kit"

export function StandbyHint({ size, onPlay }: { size: { w: number; h: number }; onPlay: () => void }) {
	const dot = Math.max(5, Math.round(size.h * 0.035))
	return (
		<button type="button" onClick={onPlay} className="labtv-glass relative block h-full w-full" aria-label="Watch the intro">
			<span className="labtv-standby" style={{ width: dot, height: dot, marginLeft: -dot / 2 }} />
		</button>
	)
}

export function StandbyNear({ tvRect, onPlay }: { tvRect: Rect; onPlay: () => void }) {
	const w = tvRect.width * 1.9
	const h = tvRect.height * 2.1
	return (
		<>
			<div
				className="labtv-wall-glow"
				style={{ left: tvRect.left + tvRect.width / 2 - w / 2, top: tvRect.top + tvRect.height / 2 - h / 2, width: w, height: h }}
			/>
			<NearLabel tvRect={tvRect} onPlay={onPlay} prefer="above" gap={12} className="labtv-label-in">
				<span className="labtv-label-dot">
					<PlayGlyph className="ml-px size-2.5" />
				</span>
				Watch the intro
			</NearLabel>
		</>
	)
}

const LIFT_MS = 1000

export function LiftTheater({ from, onClose }: { from: IntroFrom | null; onClose: () => void }) {
	const vp = useViewport()
	const T = filmBox({ left: 0, top: 0, width: vp.w, height: vp.h })
	const Tnow = useRef(T)
	Tnow.current = T
	const root = useRef<HTMLDivElement>(null)
	const dim = useRef<HTMLDivElement>(null)
	const screen = useRef<HTMLDivElement>(null)
	const picture = useRef<HTMLDivElement>(null)
	const chrome = useRef<HTMLDivElement>(null)
	const [phase, setPhase] = useState<"in" | "open" | "out">("in")
	const phaseNow = useRef(phase)
	phaseNow.current = phase
	const { data, failed } = useIntroData()
	const tvQuad = from && from.tvRect.width > 0 ? (from.tvPoints as Quad4) : null
	// The screen's own size is the picture's at the start: the corners map it onto the TV.
	const [size] = useState({ w: T.width, h: T.height })

	useLayoutEffect(() => {
		const s = screen.current
		if (!s) return
		const rm = reducedMotion()
		dim.current?.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.6 }, { opacity: 1 }], { duration: rm ? 150 : LIFT_MS, fill: "both" })
		let a: Animation | undefined
		if (tvQuad && !rm) {
			s.style.willChange = "transform"
			a = s.animate(morphFrames(tvQuad, rectQuad(Tnow.current), size.w, size.h, vp.h * 0.06), {
				duration: LIFT_MS,
				easing: EASE,
				fill: "both",
			})
		} else {
			a = s.animate(
				[
					{ opacity: 0, transform: `translate(${T.left}px, ${T.top}px) scale(0.96)` },
					{ opacity: 1, transform: `translate(${T.left}px, ${T.top}px)` },
				],
				{ duration: rm ? 120 : 320, easing: "ease-out", fill: "both" },
			)
		}
		done(a).then(() => {
			if (phaseNow.current !== "in") return
			s.style.willChange = ""
			setPhase("open")
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])
	// Landed: the screen follows the window (React's style), not the finished flight.
	useLayoutEffect(() => {
		if (phase === "open") for (const a of screen.current?.getAnimations() ?? []) a.cancel()
	}, [phase])

	const close = useOnce(async () => {
		const was = phaseNow.current
		setPhase("out")
		const s = screen.current
		const fade = (el: HTMLElement | null, ms: number, delay = 0) =>
			el?.animate([{ opacity: Number(getComputedStyle(el).opacity) }, { opacity: 0 }], { duration: ms, delay, fill: "both" })
		fade(chrome.current, 150)
		if (was === "open" && tvQuad && s && !reducedMotion()) {
			fade(picture.current, 220)
			s.style.willChange = "transform"
			// The screen is laid out at the window's picture size now; the way back maps that size.
			const t = Tnow.current
			const back = s.animate(morphFrames(rectQuad(t), tvQuad, t.width, t.height, vp.h * 0.04), {
				duration: 900,
				delay: 180,
				easing: EASE,
				fill: "both",
			})
			fade(dim.current, 500, 550)
			await done(back)
		} else {
			await done(fade(root.current, 220))
		}
		onClose()
	})
	useTheater(close, root)

	const landed = phase !== "in"
	const w = landed ? T.width : size.w
	const h = landed ? T.height : size.h
	return (
		<div ref={root} className="fixed inset-0 z-[1000]" role="dialog" aria-label="The GoodWatch intro">
			{tvQuad ? (
				// The TV left behind: an empty dark screen.
				<div
					className="fixed left-0 top-0 origin-top-left bg-black"
					style={{ width: 300, height: 170, transform: quadTransform(tvQuad, 300, 170) }}
				/>
			) : null}
			<div ref={dim} className="fixed inset-0 bg-black" style={{ opacity: 0 }} />
			<div
				ref={screen}
				className="labtv-glass fixed left-0 top-0 origin-top-left overflow-hidden"
				style={{
					width: w,
					height: h,
					transform: landed ? `translate(${T.left}px, ${T.top}px)` : tvQuad ? quadTransform(tvQuad, w, h) : "none",
					boxShadow: "0 30px 90px rgba(0,0,0,0.7)",
				}}
			>
				<div ref={picture} className="absolute inset-0">
					{failed && landed ? (
						<FilmFailed />
					) : data && landed ? (
						<div className="labtv-fade-in absolute inset-0">
							<Film data={data} />
						</div>
					) : null}
				</div>
			</div>
			{landed ? (
				<div ref={chrome} className="labtv-fade-in">
					<CloseButton onClick={close} />
					<TurnHint box={T} vp={vp} />
				</div>
			) : null}
		</div>
	)
}
