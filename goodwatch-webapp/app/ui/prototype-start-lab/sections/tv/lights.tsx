// PROTOTYPE (start page lab): tv c · Lights down. The TV shows a faint G with a soft pulse; pressing it dims the
// room's lamps, the TV powers on with the start page's boot screen (intro/boot.tsx) and its light falls on the room,
// then the screen grows to full window as the camera pushes in. Close reverses it and switches the TV off.
import { useLayoutEffect, useRef, useState } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { Boot } from "~/ui/living-room/intro/boot"
import "~/ui/living-room/intro/boot.css"
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
	RoomCopy,
	TurnHint,
	done,
	filmBox,
	morphFrames,
	pushFrames,
	rectQuad,
	reducedMotion,
	useIntroData,
	useOnce,
	useTheater,
	useViewport,
} from "./kit"

export function PulseHint({ size, onPlay }: { size: { w: number; h: number }; onPlay: () => void }) {
	const g = Math.max(18, Math.round(size.h * 0.3))
	const ring = g * 1.5
	return (
		<button
			type="button"
			onClick={onPlay}
			className="labtv-hint relative flex h-full w-full items-center justify-center overflow-hidden bg-[#050608]"
			aria-label="Watch the intro"
		>
			<span className="labtv-ring" style={{ width: ring, height: ring }} />
			<span className="labtv-ring labtv-ring-2" style={{ width: ring, height: ring }} />
			<GoodWatchG height={g} className="relative opacity-80" />
		</button>
	)
}

export function PulseNear({ tvRect, onPlay }: { tvRect: Rect; onPlay: () => void }) {
	return (
		<NearLabel tvRect={tvRect} onPlay={onPlay} gap={8} className="labtv-label-in">
			<PlayGlyph className="size-3.5 text-amber-400" />
			Watch the intro
		</NearLabel>
	)
}

/** When each part starts, in ms. */
const LAMPS = 100
const POWER = 650
const GROW = 1750
const GROW_MS = 1000

export function LightsTheater({ from, onClose }: { from: IntroFrom | null; onClose: () => void }) {
	const vp = useViewport()
	const T = filmBox({ left: 0, top: 0, width: vp.w, height: vp.h })
	const Tnow = useRef(T)
	Tnow.current = T
	const root = useRef<HTMLDivElement>(null)
	const dim = useRef<HTMLDivElement>(null)
	const room = useRef<HTMLDivElement>(null)
	const lamps = useRef<HTMLDivElement>(null)
	const glow = useRef<HTMLDivElement>(null)
	const shade = useRef<HTMLDivElement>(null)
	const screen = useRef<HTMLDivElement>(null)
	const picture = useRef<HTMLDivElement>(null)
	const chrome = useRef<HTMLDivElement>(null)
	const [phase, setPhase] = useState<"in" | "open" | "out">("in")
	const phaseNow = useRef(phase)
	phaseNow.current = phase
	const [boot, setBoot] = useState(false)
	const { data, failed } = useIntroData()
	const tvQuad = from && from.tvRect.width > 0 ? (from.tvPoints as Quad4) : null
	const [size] = useState({ w: T.width, h: T.height })

	useLayoutEffect(() => {
		const s = screen.current
		const r = room.current
		if (!s) return
		const rm = reducedMotion()
		const timers: ReturnType<typeof setTimeout>[] = []
		if (tvQuad && from && r && !rm) {
			const target = Tnow.current
			r.style.willChange = "transform, opacity"
			r.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: "both" })
			lamps.current?.animate([{ opacity: 0 }, { opacity: 0.74 }], {
				duration: 700,
				delay: LAMPS,
				easing: "ease-in-out",
				fill: "both",
			})
			// The TV's light on the room, flickering up as it powers on.
			glow.current?.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.25 }, { opacity: 0.25, offset: 0.4 }, { opacity: 1 }], {
				duration: 600,
				delay: POWER,
				fill: "both",
			})
			timers.push(setTimeout(() => setBoot(true), POWER))
			s.style.willChange = "transform"
			const grow = s.animate(morphFrames(tvQuad, rectQuad(target), size.w, size.h), {
				duration: GROW_MS,
				delay: GROW,
				easing: EASE,
				fill: "both",
			})
			r.animate(pushFrames(from, target), { duration: GROW_MS, delay: GROW, easing: EASE, fill: "both" })
			dim.current?.animate([{ opacity: 0 }, { opacity: 0.8 }], { duration: 900, delay: LAMPS, fill: "both" })
			shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
				duration: 320,
				delay: GROW + GROW_MS - 330,
				fill: "both",
			})
			done(grow).then(() => {
				if (phaseNow.current !== "in") return
				r.style.visibility = "hidden"
				r.style.willChange = ""
				s.style.willChange = ""
				setPhase("open")
			})
		} else {
			setBoot(true)
			shade.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "both" })
			const a = s.animate(
				[
					{ opacity: 0, transform: `translate(${T.left}px, ${T.top}px) scale(0.96)` },
					{ opacity: 1, transform: `translate(${T.left}px, ${T.top}px)` },
				],
				{ duration: rm ? 120 : 320, easing: "ease-out", fill: "both" },
			)
			done(a).then(() => phaseNow.current === "in" && setPhase("open"))
		}
		return () => timers.forEach(clearTimeout)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])
	useLayoutEffect(() => {
		if (phase === "open") for (const a of screen.current?.getAnimations() ?? []) a.cancel()
	}, [phase])

	const close = useOnce(async () => {
		const was = phaseNow.current
		setPhase("out")
		const s = screen.current
		const r = room.current
		const fade = (el: HTMLElement | null, ms: number, delay = 0) =>
			el?.animate([{ opacity: Number(getComputedStyle(el).opacity) }, { opacity: 0 }], { duration: ms, delay, fill: "both" })
		fade(chrome.current, 150)
		if (was === "open" && tvQuad && from && s && r && !reducedMotion()) {
			const t = Tnow.current
			fade(picture.current, 220)
			for (const a of r.getAnimations()) a.cancel()
			r.style.visibility = "visible"
			r.style.opacity = "1"
			r.style.willChange = "transform, opacity"
			s.style.willChange = "transform"
			const back = s.animate(morphFrames(rectQuad(t), tvQuad, t.width, t.height), {
				duration: 900,
				delay: 180,
				easing: EASE,
				fill: "both",
			})
			r.animate(pushFrames(from, t), { duration: 900, delay: 180, easing: EASE, direction: "reverse", fill: "both" })
			fade(shade.current, 300, 120)
			await done(back)
			// The TV switches off, then the lamps come back up.
			const Q = quadTransform(tvQuad, t.width, t.height)
			const off = s.animate(
				[
					{ transform: Q, opacity: 1 },
					{ transform: `${Q} translate(0px, ${t.height / 2}px) scaleY(0.02) translate(0px, ${-t.height / 2}px)`, opacity: 0.6, offset: 0.7 },
					{ transform: `${Q} translate(0px, ${t.height / 2}px) scale(0, 0.02) translate(0px, ${-t.height / 2}px)`, opacity: 0 },
				],
				{ duration: 260, easing: "ease-in", fill: "both" },
			)
			fade(glow.current, 200)
			fade(lamps.current, 500, 100)
			fade(dim.current, 500, 100)
			await done(off)
			const out = r.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: 380, fill: "both" })
			await done(out)
		} else {
			await done(fade(root.current, 220))
		}
		onClose()
	})
	useTheater(close, root)

	const landed = phase !== "in"
	const w = landed ? T.width : size.w
	const h = landed ? T.height : size.h
	const tv = from ? { left: from.tvRect.left - from.roomRect.left, top: from.tvRect.top - from.roomRect.top } : null
	return (
		<div ref={root} className="fixed inset-0 z-[1000]" role="dialog" aria-label="The GoodWatch intro">
			<div ref={dim} className="fixed inset-0 bg-black" style={{ opacity: 0 }} />
			{tvQuad && from && tv ? (
				<RoomCopy from={from} innerRef={room}>
					<div ref={lamps} className="absolute inset-0 bg-[#02030a]" style={{ opacity: 0 }} />
					<div
						ref={glow}
						className="absolute rounded-full"
						style={{
							left: tv.left - from.tvRect.width * 0.9,
							top: tv.top - from.tvRect.height * 0.9,
							width: from.tvRect.width * 2.8,
							height: from.tvRect.height * 2.8,
							opacity: 0,
							background: "radial-gradient(closest-side, rgba(170,190,255,0.32), rgba(251,191,36,0.12) 55%, transparent)",
						}}
					/>
				</RoomCopy>
			) : null}
			<div ref={shade} className="fixed inset-0 bg-black" style={{ opacity: 0 }} />
			<div
				ref={screen}
				className="fixed left-0 top-0 origin-top-left overflow-hidden bg-black"
				style={{
					width: w,
					height: h,
					transform: landed ? `translate(${T.left}px, ${T.top}px)` : tvQuad ? quadTransform(tvQuad, w, h) : "none",
				}}
			>
				<div ref={picture} className="absolute inset-0" style={{ containerType: "size" }}>
					{failed && landed ? (
						<FilmFailed />
					) : data && landed ? (
						<Film data={data} />
					) : null}
					{boot ? <Boot /> : null}
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
