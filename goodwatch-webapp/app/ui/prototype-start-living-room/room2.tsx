// PROTOTYPE - throwaway. Round 2 of the living room start page (#178): round 1's "room" variant with the
// new remote, over a choice of rooms. The original photo plus six rooms generated for this round; in each,
// the TV screen was a flat chroma-key rectangle, measured to the pixel and painted black.
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import original from "~/img/start-background.webp"
import cabin from "~/img/prototype-living-room/cabin.webp"
import greenhouse from "~/img/prototype-living-room/greenhouse.webp"
import japandi from "~/img/prototype-living-room/japandi.webp"
import loft from "~/img/prototype-living-room/loft.webp"
import midcentury from "~/img/prototype-living-room/midcentury.webp"
import seventies from "~/img/prototype-living-room/seventies.webp"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import type { LRData } from "~/server/prototype-start-living-room.server"
import { CHANNELS2, LR2_CSS, Remote2, renderChannel2, useRemote2 } from "./remote2"
import { Guide, Motes, Screen, useAutoPowerOn, useRemoteKeys, useZapper } from "./tv"

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

export interface Room {
	name: string
	src: string
	w: number
	h: number
	tv: { x: number; y: number; w: number; h: number }
	alt: string
}

export const ROOMS: Record<string, Room> = {
	original: { name: "Original photo", src: original, w: 1456, h: 816, tv: { x: 446, y: 173, w: 534, h: 293 }, alt: "A cozy living room at night, lit by a big TV" },
	midcentury: { name: "Mid-century, rainy city", src: midcentury, w: 1672, h: 941, tv: { x: 594, y: 135, w: 484, h: 269 }, alt: "A mid-century living room with a walnut sideboard, an arc lamp, and rain on the window" },
	cabin: { name: "Cabin, fireplace and snow", src: cabin, w: 1672, h: 941, tv: { x: 613, y: 159, w: 495, h: 278 }, alt: "A timber cabin living room with a stone fireplace and snow outside" },
	loft: { name: "Brick loft, skyline", src: loft, w: 1672, h: 941, tv: { x: 560, y: 126, w: 541, h: 290 }, alt: "A brick loft at night with a city skyline through factory windows" },
	japandi: { name: "Japandi, paper lantern", src: japandi, w: 1672, h: 941, tv: { x: 559, y: 146, w: 570, h: 308 }, alt: "A calm Japandi living room with oak slats and a paper lantern" },
	seventies: { name: "Seventies den", src: seventies, w: 1672, h: 941, tv: { x: 585, y: 136, w: 502, h: 278 }, alt: "A 1970s den with wood paneling, a shag rug, and a lava lamp" },
	greenhouse: { name: "Plant-filled, rainy night", src: greenhouse, w: 1672, h: 941, tv: { x: 604, y: 133, w: 517, h: 282 }, alt: "A plant-filled apartment with a dark green wall and a rainy city night" },
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`

function useFrame(ref: React.RefObject<HTMLElement>, room: Room, focusY: number, minTvW: number) {
	const [f, setF] = useState<{ s: number; left: number; top: number } | null>(null)
	useIso(() => {
		const el = ref.current
		if (!el) return
		const measure = () => {
			const cw = el.clientWidth
			const ch = el.clientHeight
			const cx = room.tv.x + room.tv.w / 2
			const cy = room.tv.y + room.tv.h / 2
			let s = Math.max(cw / room.w, ch / room.h)
			s = Math.max(s, Math.min((minTvW * cw) / room.tv.w, (0.52 * ch) / room.tv.h))
			s = Math.min(s, (0.94 * cw) / room.tv.w)
			const W = room.w * s
			const H = room.h * s
			let left = cw / 2 - cx * s
			let top = focusY * ch - cy * s
			if (W >= cw - 1) left = Math.min(0, Math.max(cw - W, left))
			if (H >= ch - 1) top = Math.min(0, Math.max(ch - H, top))
			setF({ s, left, top })
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [room, focusY, minTvW])
	return f
}

function useParallax() {
	const x = useMotionValue(0)
	const y = useMotionValue(0)
	const sx = useSpring(x, { stiffness: 60, damping: 20 })
	const sy = useSpring(y, { stiffness: 60, damping: 20 })
	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		const on = (e: PointerEvent) => {
			if (e.pointerType !== "mouse") return
			x.set((e.clientX / window.innerWidth) * 2 - 1)
			y.set((e.clientY / window.innerHeight) * 2 - 1)
		}
		window.addEventListener("pointermove", on)
		return () => window.removeEventListener("pointermove", on)
	}, [])
	return { sx, sy }
}

const QUERIES = ["a cozy mystery for a rainy sunday", "mind-bending sci-fi that makes you cry", "feel-good comedy to watch with my parents", "slow-burn thriller set in winter"]

export function Room2({ data, room }: { data: LRData; room: Room }) {
	const box = useRef<HTMLDivElement>(null)
	const f = useFrame(box, room, 0.42, 0.46)
	const z = useZapper(CHANNELS2.length)
	const [guide, setGuide] = useState(false)
	const r = useRemote2(z, () => setGuide(true))
	const [held, setHeld] = useState(false)
	const [hover, setHover] = useState(false)
	const lifted = held || hover
	const [narrow, setNarrow] = useState(false)
	useEffect(() => {
		const mq = window.matchMedia("(max-width: 639px)")
		const set = () => setNarrow(mq.matches)
		set()
		mq.addEventListener("change", set)
		return () => mq.removeEventListener("change", set)
	}, [])
	useAutoPowerOn(z)
	useRemoteKeys(z, CHANNELS2.length, (e) => e.key.toLowerCase() === "g" && setGuide((g) => !g))
	const { sx, sy } = useParallax()
	const bgX = useTransform(sx, (v) => v * -10)
	const bgY = useTransform(sy, (v) => v * -6)
	const rmX = useTransform(sx, (v) => v * 14)
	const rmY = useTransform(sy, (v) => v * 8)
	const glow = CHANNELS2[z.ch].glow
	const tv = room.tv
	const cx = pct(tv.x + tv.w / 2, room.w)
	const cy = pct(tv.y + tv.h / 2, room.h)

	// Using the remote picks it up; clicking the room puts it down.
	useEffect(() => {
		if (r.pulse) setHeld(true)
	}, [r.pulse])

	return (
		<div
			ref={box}
			className="lr-root fixed inset-x-0 bottom-16 top-16 z-40 overflow-clip bg-[#07080b] text-white lg:bottom-0"
			onPointerDown={(e) => {
				if (!(e.target as HTMLElement).closest(".lr2-remote")) setHeld(false)
			}}
		>
			<style>{`html, body { overflow: hidden !important; } ${LR2_CSS}`}</style>
			<img src={room.src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl brightness-50" />

			{f && (
				<motion.div className="absolute" style={{ left: f.left, top: f.top, width: room.w * f.s, height: room.h * f.s, x: bgX, y: bgY }}>
					<AnimatePresence initial={false}>
						<motion.img
							key={room.src}
							src={room.src}
							alt={room.alt}
							className="absolute inset-0 h-full w-full select-none"
							draggable={false}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.8 }}
						/>
					</AnimatePresence>
					<motion.div className="absolute inset-0 bg-[#05060a]" initial={{ opacity: 0.6 }} animate={{ opacity: z.on ? 0.16 : 0.6 }} transition={{ duration: 1.6, ease: "easeOut" }} />
					<motion.div
						className="lr-flicker pointer-events-none absolute inset-0 mix-blend-screen"
						initial={false}
						animate={{ opacity: z.on ? 0.5 : 0, background: `radial-gradient(36% 48% at ${cx} ${cy}, ${glow}88 0%, ${glow}33 45%, ${glow}00 100%)` }}
						transition={{ duration: 0.8, ease: "easeOut" }}
					/>
					<motion.div
						className="pointer-events-none absolute inset-0 mix-blend-soft-light"
						initial={false}
						animate={{ opacity: z.on ? 0.6 : 0, background: `radial-gradient(70% 60% at 50% 92%, ${glow}66 0%, ${glow}00 70%)` }}
						transition={{ duration: 0.8 }}
					/>
					<AnimatePresence>
						{z.zapId > 0 && (
							<motion.div
								key={z.zapId}
								className="pointer-events-none absolute inset-0 mix-blend-screen"
								style={{ background: `radial-gradient(30% 40% at ${cx} ${cy}, rgba(220,235,255,0.35), transparent 70%)` }}
								initial={{ opacity: 1 }}
								animate={{ opacity: 0 }}
								transition={{ duration: 0.5 }}
							/>
						)}
					</AnimatePresence>
					<div className="absolute" style={{ left: pct(tv.x - 60, room.w), top: pct(tv.y, room.h), width: pct(tv.w + 120, room.w), height: pct(room.h - tv.y, room.h) }}>
						<Motes count={z.on ? 16 : 0} />
					</div>
					<motion.div
						className="absolute"
						style={{ left: pct(tv.x, room.w), top: pct(tv.y, room.h), width: pct(tv.w, room.w), height: pct(tv.h, room.h) }}
						animate={{ boxShadow: z.on ? `0 0 70px 6px ${glow}44, 0 0 16px 1px ${glow}55` : "0 0 0px 0px rgba(0,0,0,0)" }}
						transition={{ duration: 0.8 }}
					>
						<Screen z={z} channels={CHANNELS2} render={(ch) => renderChannel2(ch, data, QUERIES, r)} className="h-full w-full" />
					</motion.div>
				</motion.div>
			)}
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_55%,rgba(0,0,0,0.6)_100%)]" />

			<motion.div className="absolute left-4 top-5 sm:left-8 sm:top-8" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.8 }}>
				<div className="flex items-center gap-2.5">
					<img src={gwLogo} alt="" className="h-6" />
					<span className="text-sm font-bold uppercase tracking-[0.28em] text-white/85">GoodWatch</span>
				</div>
				<h1 className="mt-3 max-w-xs text-3xl font-extrabold leading-[1.05] tracking-tight [text-shadow:0_2px_20px_rgba(0,0,0,0.6)] sm:max-w-sm sm:text-5xl">Pull up a seat.</h1>
				<p className="mt-2 hidden max-w-xs text-white/75 [text-shadow:0_1px_10px_rgba(0,0,0,0.8)] sm:block">Pick up the remote. Zap through channels, pick a mood, or tune what you're in for.</p>
			</motion.div>

			<Caption ch={z.ch} className="absolute bottom-6 left-4 right-[46%] sm:bottom-10 sm:left-8 sm:right-auto sm:max-w-[40%]" />

			{/* The remote rests on the armrest; hover, focus, or use it to pick it up. */}
			<motion.div
				className="lr2-hold absolute bottom-0 right-1 origin-bottom-right sm:right-8 xl:right-14"
				style={{ x: rmX, y: rmY, perspective: 1000 }}
				initial={{ y: 500 }}
				animate={{ y: 0 }}
				transition={{ delay: 1.1, type: "spring", stiffness: 70, damping: 16 }}
				onHoverStart={() => setHover(true)}
				onHoverEnd={() => setHover(false)}
				onFocus={() => setHeld(true)}
			>
				<motion.div
					className="lr2-scale origin-bottom-right"
					animate={lifted ? { rotateX: 4, rotateZ: -2, y: "2%" } : { rotateX: 24, rotateZ: -8, y: narrow ? "52%" : "22%" }}
					transition={{ type: "spring", stiffness: 150, damping: 20 }}
					style={{ transformStyle: "preserve-3d" }}
					onClick={() => setHeld(true)}
				>
					<Remote2 z={z} r={r} onGuide={() => setGuide(true)} />
				</motion.div>
			</motion.div>

			<Guide open={guide} onClose={() => setGuide(false)} z={z} channels={CHANNELS2} />
			<style>{`
				.lr2-scale { scale: 0.9; }
				@media (max-height: 820px) { .lr2-scale { scale: 0.82; } }
				@media (max-width: 639px) { .lr2-scale { scale: 0.74; } }
			`}</style>
		</div>
	)
}

function Caption({ ch, className }: { ch: number; className: string }) {
	const c = CHANNELS2[ch]
	return (
		<div className={className} aria-live="polite">
			<AnimatePresence mode="wait">
				<motion.div
					key={c.id}
					initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
					transition={{ duration: 0.4, ease: [0.2, 0.7, 0.1, 1] }}
					className="[text-shadow:0_2px_16px_rgba(0,0,0,0.85)]"
				>
					<div className="lr-vt text-xl tracking-wider" style={{ color: c.glow }}>
						CH {String(c.num).padStart(2, "0")} · {c.name.toUpperCase()}
					</div>
					<div className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">{c.pitch}</div>
					<div className="mt-1.5 hidden max-w-md text-sm text-white/75 sm:block sm:text-base">{c.line}</div>
				</motion.div>
			</AnimatePresence>
		</div>
	)
}
