// PROTOTYPE - throwaway. Three living room start pages. All share the old living room photo, the TV canvas,
// and the channels; they disagree on how you get around and where the camera sits.
//   room    - The room as it is. The TV in the photo plays the channels; the remote lies in the foreground.
//   lean-in - Bolder. The set powers on, the camera leans in until the TV nearly fills the view, and a live
//             guide strip runs the channels on a schedule. Lean back to see the room again.
//   couch   - The old couch view, head and all. Scrolling pushes the camera past the viewer and each scroll
//             step zaps to the next channel, with the pitch for it beside the TV.
import { AnimatePresence, type MotionValue, motion, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform } from "framer-motion"
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import roomImg from "~/img/start-background.webp"
import headImg from "~/img/start-foreground.webp"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import type { LRData } from "~/server/prototype-start-living-room.server"
import { CHANNELS, renderChannel } from "./channels"
import { Guide, Motes, Remote, Screen, type Zapper, useAutoPowerOn, useRemoteKeys, useZapper } from "./tv"

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

// ---------------------------------------------------------------------------------------------------------
// The room: the photo placed so the TV sits where we want it, at any viewport shape.

const IW = 1456
const IH = 816
const TV = { x: 446, y: 173, w: 534, h: 293 }
const TVC = { x: TV.x + TV.w / 2, y: TV.y + TV.h / 2 }
const pct = (v: number, of: number) => `${(v / of) * 100}%`

interface Frame {
	cw: number
	ch: number
	s: number
	left: number
	top: number
}

function useFrame(ref: React.RefObject<HTMLElement>, focusY: number, maxTvW: number, minTvW = 0) {
	const [f, setF] = useState<Frame | null>(null)
	useIso(() => {
		const el = ref.current
		if (!el) return
		const measure = () => {
			const cw = el.clientWidth
			const ch = el.clientHeight
			let s = Math.max(cw / IW, ch / IH)
			// Grow until the TV is big enough to read, but keep it inside the view's height.
			s = Math.max(s, Math.min((minTvW * cw) / TV.w, (0.52 * ch) / TV.h))
			s = Math.min(s, (maxTvW * cw) / TV.w)
			const W = IW * s
			const H = IH * s
			let left = cw / 2 - TVC.x * s
			let top = focusY * ch - TVC.y * s
			if (W >= cw - 1) left = Math.min(0, Math.max(cw - W, left))
			if (H >= ch - 1) top = Math.min(0, Math.max(ch - H, top))
			setF({ cw, ch, s, left, top })
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [focusY, maxTvW, minTvW])
	return f
}

// Where the stage must move and how much it must grow to put the TV center at (fx, fy) at width tvW.
function zoomTo(f: Frame, fx: number, fy: number, tvFrac: { w: number; h: number }) {
	const baseW = TV.w * f.s
	const target = Math.min(tvFrac.w * f.cw, tvFrac.h * f.ch * (TV.w / TV.h))
	const k = target / baseW
	return { k, x: fx * f.cw - f.left - k * TVC.x * f.s, y: fy * f.ch - f.top - k * TVC.y * f.s }
}

function usePointerParallax() {
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

// The photo, the light the screen throws on the room, and the screen. Everything inside is in image space.
function RoomLayers({ z, data, queries, head }: { z: Zapper; data: LRData; queries: string[]; head?: ReactNode }) {
	const glow = CHANNELS[z.ch].glow
	return (
		<>
			<img src={roomImg} alt="A cozy living room at night, lit by a big TV" className="absolute inset-0 h-full w-full select-none" draggable={false} />
			{/* The room is darker until the set is on. */}
			<motion.div className="absolute inset-0 bg-[#05060a]" initial={{ opacity: 0.55 }} animate={{ opacity: z.on ? 0.12 : 0.55 }} transition={{ duration: 1.6, ease: "easeOut" }} />
			{/* Light from the screen, tinted by what's on. */}
			<motion.div
				className="lr-flicker pointer-events-none absolute inset-0 mix-blend-screen"
				initial={false}
				animate={{
					opacity: z.on ? 0.5 : 0,
					background: `radial-gradient(38% 50% at ${pct(TVC.x, IW)} ${pct(TVC.y, IH)}, ${glow}88 0%, ${glow}33 45%, ${glow}00 100%)`,
				}}
				transition={{ duration: 0.8, ease: "easeOut" }}
			/>
			<motion.div
				className="pointer-events-none absolute inset-0 mix-blend-soft-light"
				initial={false}
				animate={{ opacity: z.on ? 0.6 : 0, background: `radial-gradient(70% 60% at 50% 90%, ${glow}66 0%, ${glow}00 70%)` }}
				transition={{ duration: 0.8 }}
			/>
			{/* A flash across the room on every zap. */}
			<AnimatePresence>
				{z.zapId > 0 && (
					<motion.div
						key={z.zapId}
						className="pointer-events-none absolute inset-0 mix-blend-screen"
						style={{ background: `radial-gradient(30% 40% at ${pct(TVC.x, IW)} ${pct(TVC.y, IH)}, rgba(220,235,255,0.35), transparent 70%)` }}
						initial={{ opacity: 1 }}
						animate={{ opacity: 0 }}
						transition={{ duration: 0.5 }}
					/>
				)}
			</AnimatePresence>
			<div className="absolute" style={{ left: pct(TV.x - 60, IW), top: pct(TV.y, IH), width: pct(TV.w + 120, IW), height: pct(IH - TV.y, IH) }}>
				<Motes count={z.on ? 16 : 0} />
			</div>
			<motion.div
				className="absolute"
				style={{ left: pct(TV.x, IW), top: pct(TV.y, IH), width: pct(TV.w, IW), height: pct(TV.h, IH) }}
				animate={{ boxShadow: z.on ? `0 0 70px 6px ${glow}44, 0 0 16px 1px ${glow}55` : "0 0 0px 0px rgba(0,0,0,0)" }}
				transition={{ duration: 0.8 }}
			>
				<Screen z={z} channels={CHANNELS} render={(ch) => renderChannel(ch, data, queries)} className="h-full w-full" />
			</motion.div>
			{head}
		</>
	)
}

// Everything outside the photo, when the photo doesn't cover the viewport: a blurred copy of the room.
function Backfill() {
	return <img src={roomImg} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl brightness-50" aria-hidden />
}

function Wordmark() {
	return (
		<div className="flex items-center gap-2.5">
			<img src={gwLogo} alt="" className="h-6" />
			<span className="text-sm font-bold uppercase tracking-[0.28em] text-white/85">GoodWatch</span>
		</div>
	)
}

function Cta({ className = "" }: { className?: string }) {
	return (
		<div className={`flex flex-wrap items-center gap-3 ${className}`}>
			<a href="/taste" className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-black shadow-[0_8px_30px_rgba(251,191,36,0.35)] transition hover:bg-amber-300">
				Get my picks
			</a>
			<a href="/discover" className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20">
				Browse everything
			</a>
		</div>
	)
}

// The pitch for the channel that's on, swapped in time with the zap.
function Caption({ z, className = "", align = "left", tight = false }: { z: Zapper; className?: string; align?: "left" | "center"; tight?: boolean }) {
	const c = CHANNELS[z.ch]
	return (
		<div className={className} aria-live="polite">
			<AnimatePresence mode="wait">
				<motion.div
					key={c.id}
					initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
					transition={{ duration: 0.4, ease: [0.2, 0.7, 0.1, 1] }}
					className={align === "center" ? "text-center" : ""}
				>
					<div className="lr-vt text-xl tracking-wider" style={{ color: c.glow }}>
						CH {String(c.num).padStart(2, "0")} · {c.name.toUpperCase()}
					</div>
					<div className="mt-1 text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">{c.pitch}</div>
					<div className={`mt-1.5 max-w-md text-sm text-white/65 sm:text-base ${tight ? "hidden sm:block" : ""}`}>{c.line}</div>
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

function useQueries() {
	return ["a cozy mystery for a rainy sunday", "mind-bending sci-fi that makes you cry", "feel-good comedy to watch with my parents", "slow-burn thriller set in winter"]
}

export const LOCK_SCROLL = "html, body { overflow: hidden !important; }"
const FULL = "fixed inset-x-0 top-16 bottom-16 lg:bottom-0 z-40 overflow-hidden bg-[#07080b] text-white lr-root"

// ---------------------------------------------------------------------------------------------------------
// A · The room

export function RoomVariant({ data }: { data: LRData }) {
	const box = useRef<HTMLDivElement>(null)
	const f = useFrame(box, 0.42, 0.94, 0.46)
	const z = useZapper(CHANNELS.length)
	const [guide, setGuide] = useState(false)
	const [lifted, setLifted] = useState(false)
	const queries = useQueries()
	useAutoPowerOn(z)
	useRemoteKeys(z, CHANNELS.length, (e) => e.key.toLowerCase() === "g" && setGuide((g) => !g))
	const { sx, sy } = usePointerParallax()
	const bgX = useTransform(sx, (v) => v * -10)
	const bgY = useTransform(sy, (v) => v * -6)
	const rmX = useTransform(sx, (v) => v * 16)
	const rmY = useTransform(sy, (v) => v * 8)

	return (
		<div ref={box} className={FULL}>
			<style>{LOCK_SCROLL}</style>
			<Backfill />
			{f && (
				<motion.div className="absolute" style={{ left: f.left, top: f.top, width: IW * f.s, height: IH * f.s, x: bgX, y: bgY }}>
					<RoomLayers z={z} data={data} queries={queries} />
				</motion.div>
			)}
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_55%,rgba(0,0,0,0.65)_100%)]" />

			{/* Top left: who we are and the way in. */}
			<motion.div className="absolute left-4 top-5 sm:left-8 sm:top-8" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.8 }}>
				<Wordmark />
				<h1 className="mt-3 max-w-xs text-3xl font-extrabold leading-[1.05] tracking-tight sm:max-w-sm sm:text-5xl">Pull up a seat.</h1>
				<p className="mt-2 hidden max-w-xs text-white/70 sm:block">Grab the remote and flip through what GoodWatch knows about every movie and show.</p>
				<Cta className="mt-4 hidden sm:flex" />
			</motion.div>

			{/* Bottom left: the pitch for the channel that's on. */}
			<Caption z={z} tight className="absolute bottom-6 left-4 right-[46%] sm:bottom-10 sm:left-8 sm:right-auto" />

			{/* The remote on the armrest. Hover or tap to pick it up. */}
			<motion.div
				className="absolute bottom-0 right-2 origin-bottom sm:right-10"
				style={{ x: rmX, y: rmY, perspective: 900 }}
				initial={{ y: 400 }}
				animate={{ y: 0 }}
				transition={{ delay: 1.1, type: "spring", stiffness: 70, damping: 16 }}
				onHoverStart={() => setLifted(true)}
				onHoverEnd={() => setLifted(false)}
			>
				<motion.div
					animate={
						lifted
							? { rotateX: 6, rotateZ: -4, y: 0, scale: 1 }
							: { rotateX: 30, rotateZ: -14, y: "34%", scale: 0.9 }
					}
					transition={{ type: "spring", stiffness: 160, damping: 20 }}
					style={{ transformStyle: "preserve-3d" }}
					className="origin-bottom scale-[0.72] sm:scale-100"
					onClick={() => setLifted(true)}
				>
					<Remote z={z} channels={CHANNELS} onGuide={() => setGuide(true)} />
				</motion.div>
			</motion.div>

			<Guide open={guide} onClose={() => setGuide(false)} z={z} channels={CHANNELS} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// B · Lean in (bolder)

const PROGRAMME_MS = 12000

export function LeanInVariant({ data }: { data: LRData }) {
	const box = useRef<HTMLDivElement>(null)
	const f = useFrame(box, 0.45, 0.94)
	const z = useZapper(CHANNELS.length)
	const [guide, setGuide] = useState(false)
	const [leaned, setLeaned] = useState(false)
	const [paused, setPaused] = useState(false)
	const [wide, setWide] = useState(true)
	const queries = useQueries()
	useAutoPowerOn(z, 500)
	useRemoteKeys(z, CHANNELS.length, (e) => {
		const k = e.key.toLowerCase()
		if (k === "g") setGuide((g) => !g)
		if (k === "l") setLeaned((l) => !l)
	})
	useEffect(() => {
		const t = setTimeout(() => setLeaned(true), 1900)
		const mq = window.matchMedia("(min-width: 1024px)")
		const set = () => setWide(mq.matches)
		set()
		mq.addEventListener("change", set)
		return () => {
			clearTimeout(t)
			mq.removeEventListener("change", set)
		}
	}, [])

	// Live TV: each channel runs for a while, then the next one starts. Touching anything pauses it.
	const progress = useMotionValue(0)
	useEffect(() => {
		progress.set(0)
		if (!leaned || paused || !z.on) return
		let raf = 0
		let last = performance.now()
		const step = (now: number) => {
			const p = progress.get() + (now - last) / PROGRAMME_MS
			last = now
			if (p >= 1) z.tune(z.ch + 1, "auto")
			else {
				progress.set(p)
				raf = requestAnimationFrame(step)
			}
		}
		raf = requestAnimationFrame(step)
		return () => cancelAnimationFrame(raf)
	}, [z.ch, leaned, paused, z.on])
	const bar = useTransform(progress, (p) => `${p * 100}%`)

	const zoom = f ? zoomTo(f, wide ? 0.44 : 0.5, 0.43, wide ? { w: 0.74, h: 0.72 } : { w: 0.96, h: 0.6 }) : null

	return (
		<div ref={box} className={FULL} onPointerDown={() => setPaused(true)}>
			<style>{LOCK_SCROLL}</style>
			<Backfill />
			{f && zoom && (
				<motion.div
					className="absolute origin-top-left"
					style={{ left: f.left, top: f.top, width: IW * f.s, height: IH * f.s }}
					initial={false}
					animate={leaned ? { x: zoom.x, y: zoom.y, scale: zoom.k } : { x: 0, y: 0, scale: 1 }}
					transition={{ duration: 1.8, ease: [0.65, 0, 0.25, 1] }}
				>
					<RoomLayers z={z} data={data} queries={queries} />
				</motion.div>
			)}
			{/* The room falls away as we lean in. */}
			<motion.div
				className="pointer-events-none absolute inset-0"
				animate={{ background: leaned ? "radial-gradient(60% 70% at 44% 43%, rgba(0,0,0,0) 55%, rgba(3,4,7,0.8) 100%)" : "radial-gradient(60% 70% at 44% 43%, rgba(0,0,0,0) 80%, rgba(3,4,7,0.3) 100%)" }}
				transition={{ duration: 1.8 }}
			/>

			<motion.div className="absolute left-4 top-4 flex items-center gap-4 sm:left-8 sm:top-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}>
				<Wordmark />
				<button
					type="button"
					onClick={() => setLeaned(!leaned)}
					className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white/80 ring-1 ring-white/15 backdrop-blur hover:text-white"
				>
					{leaned ? "Lean back" : "Lean in"}
				</button>
			</motion.div>

			{/* Guide strip: every channel as a programme; the one on air fills up as it runs. */}
			<motion.div
				className="absolute inset-x-0 bottom-0 px-3 pb-3 sm:px-8 sm:pb-6"
				initial={{ y: 140, opacity: 0 }}
				animate={leaned ? { y: 0, opacity: 1 } : { y: 140, opacity: 0 }}
				transition={{ duration: 0.8, delay: leaned ? 1.3 : 0, ease: [0.2, 0.7, 0.1, 1] }}
			>
				<div className="mb-2 flex items-end justify-between gap-4">
					<Caption z={z} className="min-w-0" />
					<Cta className="hidden shrink-0 lg:flex" />
				</div>
				<div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
					{CHANNELS.map((c, i) => {
						const on = z.ch === i
						return (
							<button
								key={c.id}
								type="button"
								onClick={() => {
									setPaused(true)
									z.tune(i)
								}}
								className={`relative min-w-[132px] flex-1 overflow-hidden rounded-lg px-3 py-2 text-left ring-1 transition ${on ? "bg-white/15 ring-white/30" : "bg-black/45 ring-white/10 hover:bg-white/10"} backdrop-blur-md`}
							>
								<div className="lr-vt text-base leading-none" style={{ color: c.glow }}>
									{String(c.num).padStart(2, "0")} {on ? (paused ? "· PAUSED" : "· NOW") : ""}
								</div>
								<div className="mt-1 truncate text-sm font-semibold text-white">{c.name}</div>
								{on && <motion.div className="absolute bottom-0 left-0 h-[3px]" style={{ width: paused ? "100%" : bar, background: c.glow }} />}
							</button>
						)
					})}
				</div>
			</motion.div>

			{/* A remote stands by the set on wide screens. */}
			<motion.div
				className="absolute right-6 top-1/2 hidden -translate-y-1/2 lg:block xl:right-12"
				initial={{ x: 300, opacity: 0 }}
				animate={leaned ? { x: 0, opacity: 1, rotate: 4 } : { x: 300, opacity: 0 }}
				transition={{ type: "spring", stiffness: 80, damping: 18, delay: leaned ? 1.6 : 0 }}
			>
				<div className="origin-right scale-[0.8] xl:scale-90">
					<Remote z={{ ...z, tune: (n, from) => { setPaused(true); z.tune(n, from) } }} channels={CHANNELS} onGuide={() => setGuide(true)} compact />
				</div>
			</motion.div>

			<Guide open={guide} onClose={() => setGuide(false)} z={z} channels={CHANNELS} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// C · The couch: scroll to zap

export function CouchVariant({ data }: { data: LRData }) {
	const track = useRef<HTMLDivElement>(null)
	const box = useRef<HTMLDivElement>(null)
	const f = useFrame(box, 0.46, 0.94)
	const z = useZapper(CHANNELS.length)
	const queries = useQueries()
	const [guide, setGuide] = useState(false)
	useAutoPowerOn(z, 600)
	const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] })
	const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })
	// Sections: 1 intro, one per channel, 1 outro.
	const N = CHANNELS.length + 2
	const intro = useTransform(p, [0, 1 / N], [0, 1], { clamp: true })

	useMotionValueEvent(scrollYProgress, "change", (v) => {
		const i = Math.min(CHANNELS.length - 1, Math.max(0, Math.floor(v * N - 0.5)))
		if (v * N >= 0.5) z.tune(i, "scroll")
		else z.tune(0, "scroll")
	})

	// Channel i is on air while scroll progress x N is in [i + 0.5, i + 1.5); jump to the middle of that.
	const goTo = (i: number) => {
		const el = track.current
		if (!el) return
		const absTop = el.getBoundingClientRect().top + window.scrollY
		const range = el.offsetHeight - window.innerHeight
		window.scrollTo({ top: absTop + ((i + 1) / N) * range, behavior: "smooth" })
	}
	useRemoteKeys({ ...z, tune: (n) => goTo(((n % CHANNELS.length) + CHANNELS.length) % CHANNELS.length) }, CHANNELS.length, (e) => e.key.toLowerCase() === "g" && setGuide((g) => !g))

	const zoom = f ? zoomTo(f, 0.5, 0.42, f.cw < 640 ? { w: 0.98, h: 0.5 } : { w: 0.62, h: 0.56 }) : null
	const stX = useTransform(intro, (t) => (zoom ? zoom.x * t : 0))
	const stY = useTransform(intro, (t) => (zoom ? zoom.y * t : 0))
	const stK = useTransform(intro, (t) => (zoom ? 1 + (zoom.k - 1) * t : 1))
	const headY = useTransform(intro, [0, 1], ["0%", "38%"])
	const headK = useTransform(intro, [0, 1], [1, 1.35])
	const headO = useTransform(intro, [0.55, 1], [1, 0])
	const heroO = useTransform(intro, [0, 0.4], [1, 0])
	const capO = useTransform(intro, [0.6, 1], [0, 1])
	const outro = useTransform(p, [(N - 1.3) / N, (N - 0.6) / N], [0, 1], { clamp: true })
	const remoteY = useTransform(intro, [0.3, 1], [260, 0])

	const head = (
		<motion.img
			src={headImg}
			alt=""
			aria-hidden
			className="pointer-events-none absolute inset-0 h-full w-full origin-bottom select-none"
			style={{ y: headY, scale: headK, opacity: headO }}
			draggable={false}
		/>
	)

	return (
		<div ref={track} className="lr-root relative -mt-8 ml-[calc(50%-50vw)] w-screen" style={{ height: `${N * 100}svh` }}>
			<div ref={box} className="sticky top-16 h-[calc(100svh-8rem)] overflow-hidden bg-[#07080b] text-white lg:h-[calc(100svh-4rem)]">
				<Backfill />
				{f && (
					<motion.div className="absolute origin-top-left" style={{ left: f.left, top: f.top, width: IW * f.s, height: IH * f.s, x: stX, y: stY, scale: stK }}>
						<RoomLayers z={z} data={data} queries={queries} head={head} />
					</motion.div>
				)}
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_55%,rgba(0,0,0,0.6)_100%)]" />

				{/* Opening: the old couch view with the invitation. */}
				<motion.div className="pointer-events-none absolute inset-x-0 top-6 flex flex-col items-center px-4 text-center sm:top-10" style={{ opacity: heroO }}>
					<Wordmark />
					<h1 className="mt-4 text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">Pull up a seat.</h1>
					<p className="mt-3 max-w-md text-white/70">Scroll to flip through what GoodWatch knows about every movie and show.</p>
					<motion.div className="mt-6 text-white/60" animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY }}>
						<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
							<path d="M6 9l6 6 6-6" />
						</svg>
					</motion.div>
				</motion.div>

				{/* Per channel: the pitch under the set. */}
				<motion.div className="absolute inset-x-4 bottom-5 sm:bottom-8" style={{ opacity: capO }}>
					<Caption z={z} align="center" className="mx-auto max-w-xl [&_.max-w-md]:mx-auto" />
				</motion.div>

				{/* Channel rail on the left, the remote on the right. Both jump by scrolling. */}
				<motion.nav className="absolute left-3 top-1/2 hidden -translate-y-1/2 flex-col gap-1.5 sm:flex lg:left-8" style={{ opacity: capO }} aria-label="Channels">
					{CHANNELS.map((c, i) => (
						<button key={c.id} type="button" onClick={() => goTo(i)} className="group flex items-center gap-2 py-1 text-left">
							<span className="lr-vt w-6 text-lg leading-none transition-colors" style={{ color: z.ch === i ? c.glow : "rgba(255,255,255,0.35)" }}>
								{String(c.num).padStart(2, "0")}
							</span>
							<span className={`text-sm transition-all ${z.ch === i ? "font-semibold text-white" : "text-white/40 group-hover:text-white/70"}`}>{c.name}</span>
						</button>
					))}
				</motion.nav>

				<motion.div className="absolute bottom-0 right-4 hidden origin-bottom-right lg:block xl:right-10" style={{ y: remoteY }}>
					<div className="origin-bottom-right translate-y-[38%] rotate-[-10deg] scale-[0.82] transition-transform duration-500 hover:translate-y-[6%] hover:rotate-[-4deg]">
						<Remote z={{ ...z, tune: (n) => goTo(((n % CHANNELS.length) + CHANNELS.length) % CHANNELS.length) }} channels={CHANNELS} onGuide={() => setGuide(true)} />
					</div>
				</motion.div>

				{/* Closing: the camera's settled, time to act. */}
				<motion.div
					className="absolute inset-0 flex flex-col items-center justify-center bg-[#05060a]/75 px-6 text-center backdrop-blur-sm"
					style={{ opacity: outro, pointerEvents: "none" }}
				>
					<Wordmark />
					<h2 className="mt-4 max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Your channel is one step away.</h2>
					<p className="mt-3 max-w-md text-white/70">Score three titles you've seen. GoodWatch tunes every channel to your taste.</p>
					<OutroCta outro={outro} />
				</motion.div>
			</div>
			<Guide open={guide} onClose={() => setGuide(false)} z={{ ...z, tune: (n) => goTo(n) }} channels={CHANNELS} />
		</div>
	)
}

function OutroCta({ outro }: { outro: MotionValue<number> }) {
	const [live, setLive] = useState(false)
	useMotionValueEvent(outro, "change", (v) => setLive(v > 0.6))
	return <Cta className={`mt-6 justify-center ${live ? "pointer-events-auto" : "pointer-events-none"}`} />
}
