// PROTOTYPE - throwaway. Variant "spotlight": a dense poster mosaic in dim monochrome. A soft spotlight follows the
// cursor and reveals full color (after react-bits Spotlight / Pixel Transition), tiles keep flipping over to new
// titles, and the form sits on the right with a large headline across the mosaic.
//
// Flip modes (one variant each):
// - random: one random tile anywhere every 1.1 s.
// - trail: a poster flips once when it enters the lit circle, and again only after leaving and re-entering.
// - ripple: every 1.6 s a ring of flips spreads outward from the spotlight, each tile turning away from the center.
// - focus: only tiles inside the spotlight flip, about three per second, so the lit area keeps reshuffling.
//
// Performance: the color reveal is a round window that moves with a transform while the color copy inside it moves
// the opposite way, so it stays lined up with the grey mosaic. The window's soft edge is a fixed mask. Each tile is
// painted into one mosaic layer; only a flipping tile gets its own layers while its CSS animation runs.
import { useSearchParams } from "@remix-run/react"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import gEmblem from "~/img/goodwatch-logo-white.svg?url"
import { GoodWatchG, GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { motion } from "framer-motion"
import { BlurText, FILL, GlowCard, STAGE } from "./shared"
import { type SignInTitle, type VariantProps, seededShuffle } from "./types"

const COLS = 14
const ROWS = 6
const N = COLS * ROWS
const R = 280

export type FlipMode = "random" | "trail" | "ripple" | "focus"
type Dir = "l" | "r" | "u" | "d"
type Tile = { t: SignInTitle; prev?: SignInTitle; flips: number; dir: Dir }

// Flip styles, switchable with ?flip=. "dir" is the direction the spotlight is moving. Every style animates only
// transform and opacity, and each tile settles back into one flat image when its animation ends.
export const FLIPS: Record<string, string> = {
	deal: "Deal (new poster lands from where the light came)",
	fade: "Fade (soft cross-fade, slight zoom)",
	push: "Push (old slides out, new slides in)",
	nod: "Nod (small tilt while it swaps)",
	turn: "Turn (calm half-turn card flip)",
}
const VEC: Record<Dir, [number, number]> = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }
const FLIP_CSS = (["r", "l", "u", "d"] as Dir[])
	.map((d) => {
		const [x, y] = VEC[d]
		const axis = x ? "Y" : "X"
		const sign = x ? x : -y
		return `
@keyframes sw-deal-${d} { from { opacity: 0; transform: translate(${-x * 14}%, ${-y * 14}%) scale(1.12) } to { opacity: 1; transform: none } }
@keyframes sw-push-out-${d} { to { transform: translate(${x * 100}%, ${y * 100}%) } }
@keyframes sw-push-in-${d} { from { transform: translate(${-x * 100}%, ${-y * 100}%) } to { transform: none } }
@keyframes sw-nod-${d} { 0% { transform: none } 45% { transform: rotate${axis}(${sign * 28}deg) scale(.96) } 100% { transform: none } }
@keyframes sw-turn-${d} { from { transform: rotate${axis}(0deg) } to { transform: rotate${axis}(${sign * 180}deg) } }`
	})
	.join("") +
	`
@keyframes sw-fade { from { opacity: 0; transform: scale(1.06) } to { opacity: 1; transform: none } }
@keyframes sw-nod-swap { 0%, 40% { opacity: 0 } 60%, 100% { opacity: 1 } }`

/** Direction a tile turns for a movement of (dx, dy): it flips over the edge the motion is heading toward. */
const dirOf = (dx: number, dy: number): Dir => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : dy > 0 ? "d" : "u")

const TileView = memo(function TileView({ tile, color, fx, still }: { tile: Tile; color: boolean; fx: string; still?: boolean }) {
	return (
		<div className={`relative aspect-[2/3] ${fx === "push" ? "overflow-hidden" : ""}`} style={{ perspective: 700 }}>
			<FlipCard key={tile.flips} tile={tile} color={color} fx={still ? "none" : fx} />
		</div>
	)
})

/** Animates from the previous poster to the current one, then settles into a single flat image so it stops being a layer. */
function FlipCard({ tile, color, fx }: { tile: Tile; color: boolean; fx: string }) {
	const [settled, setSettled] = useState(!tile.prev)
	const img = `absolute inset-0 h-full w-full rounded-lg object-cover ${color ? "" : "grayscale brightness-[.3] contrast-125"}`
	const now = <img src={tile.t.poster} alt={color ? "" : tile.t.title} draggable={false} className={img} />
	if (settled || !tile.prev || fx === "none") return now
	const done = () => setSettled(true)
	const old = tile.prev.poster
	const d = tile.dir
	const ease = "cubic-bezier(.25,.8,.25,1)"
	switch (fx) {
		case "deal":
			return (
				<>
					<img src={old} alt="" draggable={false} className={img} />
					<img src={tile.t.poster} alt="" draggable={false} className={img} style={{ animation: `sw-deal-${d} .75s ${ease} both` }} onAnimationEnd={done} />
				</>
			)
		case "push":
			return (
				<>
					<img src={old} alt="" draggable={false} className={img} style={{ animation: `sw-push-out-${d} .9s cubic-bezier(.65,0,.35,1) both` }} />
					<img src={tile.t.poster} alt="" draggable={false} className={img} style={{ animation: `sw-push-in-${d} .9s cubic-bezier(.65,0,.35,1) both` }} onAnimationEnd={done} />
				</>
			)
		case "nod":
			return (
				<div className="absolute inset-0" style={{ animation: `sw-nod-${d} .9s ease-in-out both` }} onAnimationEnd={(e) => e.target === e.currentTarget && done()}>
					<img src={old} alt="" draggable={false} className={img} />
					<img src={tile.t.poster} alt="" draggable={false} className={img} style={{ animation: "sw-nod-swap .9s linear both" }} />
				</div>
			)
		case "turn":
			return (
				<div className="absolute inset-0 [transform-style:preserve-3d]" style={{ animation: `sw-turn-${d} 1s cubic-bezier(.45,0,.2,1) both` }} onAnimationEnd={done}>
					<img src={old} alt="" draggable={false} className={`${img} [backface-visibility:hidden]`} />
					<img
						src={tile.t.poster}
						alt=""
						draggable={false}
						className={`${img} [backface-visibility:hidden]`}
						style={{ transform: d === "r" || d === "l" ? "rotateY(180deg)" : "rotateX(180deg)" }}
					/>
				</div>
			)
		default:
			return (
				<>
					<img src={old} alt="" draggable={false} className={img} />
					<img src={tile.t.poster} alt="" draggable={false} className={img} style={{ animation: `sw-fade .9s ${ease} both` }} onAnimationEnd={done} />
				</>
			)
	}
}

const Mosaic = memo(function Mosaic({
	tiles,
	color,
	fx,
	still,
	gridRef,
}: { tiles: Tile[]; color: boolean; fx: string; still?: boolean; gridRef?: React.Ref<HTMLDivElement> }) {
	return (
		<div className="absolute inset-0 flex items-center">
			<div ref={gridRef} className="grid h-full w-[118%] -translate-x-[8%] -rotate-3 scale-110 gap-2" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
				{tiles.map((tile, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid slots
					<TileView key={i} tile={tile} color={color} fx={fx} still={still} />
				))}
			</div>
		</div>
	)
})

export type Layout = "classic" | "center" | "split" | "emblem" | "card" | "reveal" | "emblem-here" | "title-card" | "poster"

export function Spotlight({ titles, form, mode = "random", layout = "classic" }: VariantProps & { mode?: FlipMode; layout?: Layout }) {
	const pool = useMemo(() => seededShuffle(titles, 51), [titles])
	const fx = useSearchParams()[0].get("flip") ?? "deal"
	const [tiles, setTiles] = useState<Tile[]>(() => Array.from({ length: N }, (_, i) => ({ t: pool[i % pool.length], flips: 0, dir: "r" })))
	const stage = useRef<HTMLDivElement>(null)
	const lens = useRef<HTMLDivElement>(null)
	const inner = useRef<HTMLDivElement>(null)
	const glow = useRef<HTMLDivElement>(null)
	const grid = useRef<HTMLDivElement>(null)
	const next = useRef(N)

	// Flips collected during a frame are applied in one state update.
	const queue = useRef<Map<number, Dir>>(new Map())
	const flush = () => {
		if (!queue.current.size) return
		const batch = queue.current
		queue.current = new Map()
		setTiles((ts) => {
			const copy = [...ts]
			for (const [i, dir] of batch) copy[i] = { t: pool[next.current++ % pool.length], prev: ts[i].t, flips: ts[i].flips + 1, dir }
			return copy
		})
	}

	// Warm the browser cache so a tile never flips to a poster that is still loading.
	useEffect(() => {
		const id = setTimeout(() => {
			for (const t of pool) new Image().src = t.poster
		}, 800)
		return () => clearTimeout(id)
	}, [pool])

	useEffect(() => {
		if (mode !== "random") return
		const id = setInterval(() => {
			queue.current.set(Math.floor(Math.random() * N), "r")
			flush()
		}, 1100)
		return () => clearInterval(id)
	}, [mode, pool])

	// Ease the spotlight toward the cursor; wander on its own when the cursor is idle or absent.
	useEffect(() => {
		const target = { x: 0.3, y: 0.5, last: 0, px: 0, py: 0 }
		const cur = { x: 0.3, y: 0.5 }
		let raf = 0
		let lastNow = performance.now()
		// Tile centers in stage pixels, measured once and again on resize.
		let centers: { x: number; y: number }[] = []
		const measure = () => {
			const sr = stage.current?.getBoundingClientRect()
			if (!sr || !grid.current) return
			centers = [...grid.current.children].map((el) => {
				const r = el.getBoundingClientRect()
				return { x: r.left + r.width / 2 - sr.left, y: r.top + r.height / 2 - sr.top }
			})
		}
		const ro = new ResizeObserver(measure)
		if (stage.current) ro.observe(stage.current)
		const lastFlip = new Float64Array(N)
		const prev = { x: 0, y: 0 }
		const vel = { x: 1, y: 0 }
		const inside = new Uint8Array(N)
		const ENTER = 150
		const EXIT = 200
		let primed = false
		let lastAny = 0
		let lastRipple = 0
		let ripples: { at: number; i: number; dir: Dir }[] = []
		const onMove = (e: PointerEvent) => {
			const r = stage.current?.getBoundingClientRect()
			if (r) Object.assign(target, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, px: e.clientX - r.left, py: e.clientY - r.top, last: performance.now() })
		}
		const loop = (now: number) => {
			let tx = target.x
			let ty = target.y
			const wandering = now - target.last > 2500
			if (wandering) {
				tx = 0.32 + Math.sin(now / 2600) * 0.22
				ty = 0.5 + Math.sin(now / 1700) * 0.28
			}
			// Close most of the gap within ~100 ms when following the cursor; drift slowly when wandering.
			const k = 1 - (1 - (wandering ? 0.05 : 0.3)) ** ((now - lastNow) / 16.7)
			lastNow = now
			cur.x += (tx - cur.x) * k
			cur.y += (ty - cur.y) * k
			const w = stage.current?.clientWidth ?? 0
			const h = stage.current?.clientHeight ?? 0
			const box = inner.current?.firstElementChild as HTMLElement | null
			if (box && (box.offsetWidth !== w || box.offsetHeight !== h)) Object.assign(box.style, { width: `${w}px`, height: `${h}px` })
			const cx = cur.x * w
			const cy = cur.y * h
			const x = cx - R
			const y = cy - R
			// Smoothed direction of the spotlight's motion, used for which way a poster turns or slides.
			const vx = cx - prev.x
			const vy = cy - prev.y
			prev.x = cx
			prev.y = cy
			vel.x = vel.x * 0.85 + vx * 0.15
			vel.y = vel.y * 0.85 + vy * 0.15
			if (mode === "trail" && centers.length) {
				// A poster flips once when it enters the lit circle and not again until it has left it. Leaving needs a
				// larger distance than entering, so a poster on the edge doesn't flicker in and out.
				for (let i = 0; i < centers.length; i++) {
					const d = Math.hypot(centers[i].x - cx, centers[i].y - cy)
					if (!inside[i] && d < ENTER) {
						inside[i] = 1
						if (primed) queue.current.set(i, dirOf(vel.x, vel.y))
					} else if (inside[i] && d > EXIT) inside[i] = 0
				}
				primed = true
			} else if (mode === "focus" && now - lastAny > 330) {
				const inside = centers.map((c, i) => i).filter((i) => Math.hypot(centers[i].x - cx, centers[i].y - cy) < R * 0.75 && now - lastFlip[i] > 1500)
				if (inside.length) {
					const i = inside[Math.floor(Math.random() * inside.length)]
					lastFlip[i] = lastAny = now
					queue.current.set(i, dirOf(centers[i].x - cx, centers[i].y - cy))
				}
			} else if (mode === "ripple") {
				if (now - lastRipple > 1600) {
					lastRipple = now
					for (let i = 0; i < centers.length; i++) {
						const dx = centers[i].x - cx
						const dy = centers[i].y - cy
						const d = Math.hypot(dx, dy)
						if (d < R * 1.3) ripples.push({ at: now + d * 2.2, i, dir: dirOf(dx, dy) })
					}
				}
				const due = ripples.filter((r) => r.at <= now)
				if (due.length) {
					ripples = ripples.filter((r) => r.at > now)
					for (const r of due) queue.current.set(r.i, r.dir)
				}
			}
			flush()
			if (lens.current) lens.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
			if (inner.current) inner.current.style.transform = `translate3d(${-x}px, ${-y}px, 0)`
			if (glow.current) glow.current.style.transform = `translate3d(${x - R / 2}px, ${y - R / 2}px, 0)`
			raf = requestAnimationFrame(loop)
		}
		window.addEventListener("pointermove", onMove, { passive: true })
		raf = requestAnimationFrame(loop)
		return () => {
			cancelAnimationFrame(raf)
			ro.disconnect()
			window.removeEventListener("pointermove", onMove)
		}
	}, [mode, pool])

	return (
		<div ref={stage} className={STAGE}>
			<style dangerouslySetInnerHTML={{ __html: FLIP_CSS }} />
			{/* In trail mode every flip happens under the spotlight, where the color copy covers the grey one, so the grey
			    copy swaps instantly and only the color copy animates. */}
			<Mosaic tiles={tiles} color={false} fx={fx} still={mode === "trail"} gridRef={grid} />
			{layout === "reveal" && <RevealHeadline lit={false} />}
			<div
				ref={lens}
				className="pointer-events-none absolute left-0 top-0 overflow-hidden rounded-full will-change-transform"
				style={{
					width: R * 2,
					height: R * 2,
					maskImage: "radial-gradient(closest-side, #000 40%, transparent 100%)",
					WebkitMaskImage: "radial-gradient(closest-side, #000 40%, transparent 100%)",
				}}
			>
				<div ref={inner} className="absolute left-0 top-0 will-change-transform" style={{ width: "100%", height: "100%" }}>
					<div className="absolute left-0 top-0">
						<Mosaic tiles={tiles} color fx={fx} />
						{layout === "reveal" && <RevealHeadline lit />}
					</div>
				</div>
			</div>
			<div
				ref={glow}
				className="pointer-events-none absolute left-0 top-0 opacity-25 will-change-transform"
				style={{ width: R * 3, height: R * 3, background: "radial-gradient(closest-side, rgba(251,191,36,.8), transparent)" }}
			/>
			<Foreground layout={layout} form={form} tiles={tiles} fx={fx} />
		</div>
	)
}

const HEADLINE = "Somewhere in here is your next favorite."

/** What sits over the mosaic: everything except the mosaic, the spotlight, and its glow. */
function Foreground({ layout, form, tiles, fx }: { layout: Layout; form: React.ReactNode; tiles: Tile[]; fx: string }) {
	switch (layout) {
		case "reveal":
			return (
				<>
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-gray-950 via-gray-950/30 to-transparent" />
					<div className={`${FILL} pointer-events-none mx-auto flex max-w-7xl items-center justify-end px-4 sm:px-8`}>
						<GlowCard className="pointer-events-auto w-full max-w-md shrink-0">
							<div className="mb-6">
								<GoodWatchWordmark fontSize={40} />
								<div className="mt-4 text-2xl font-bold text-white">Sign in</div>
							</div>
							{form}
						</GlowCard>
					</div>
				</>
			)
		case "emblem-here":
			return (
				<>
					{/* The G is the "here": a giant G cut out of the mosaic shows its posters in color. Its mask never changes
					    and the copy inside never animates, so it costs nothing per frame. */}
					<div
						className="pointer-events-none absolute inset-0 hidden lg:block"
						style={{
							maskImage: `url(${gEmblem})`,
							WebkitMaskImage: `url(${gEmblem})`,
							maskRepeat: "no-repeat",
							WebkitMaskRepeat: "no-repeat",
							maskSize: "auto 84%",
							WebkitMaskSize: "auto 84%",
							maskPosition: "16% 50%",
							WebkitMaskPosition: "16% 50%",
						}}
					>
						<Mosaic tiles={tiles} color fx={fx} still />
					</div>
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-gray-950 via-gray-950/20 to-transparent" />
					<div className={`${FILL} pointer-events-none mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 sm:px-8`}>
						<h1 className="hidden font-black leading-[.95] tracking-tight text-white [text-shadow:0_4px_30px_rgba(0,0,0,.9)] lg:block">
							<span className="block text-5xl xl:text-6xl">
								<BlurText text="Somewhere in" />
							</span>
							<motion.span
								className="block pl-[22%] text-[9rem] leading-[.8] text-amber-400 xl:text-[11rem]"
								initial={{ opacity: 0, scale: 0.85 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
							>
								here
							</motion.span>
							<span className="mt-3 block text-5xl xl:text-6xl">
								<BlurText text="is your next favorite." delay={0.6} />
							</span>
						</h1>
						<GlowCard className="pointer-events-auto w-full max-w-md shrink-0">
							<div className="mb-6">
								<GoodWatchWordmark fontSize={38} />
								<div className="mt-4 text-2xl font-bold text-white">Sign in</div>
							</div>
							{form}
						</GlowCard>
					</div>
				</>
			)
		case "title-card":
			return (
				<>
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-gray-950/80 via-transparent to-gray-950/80" />
					{/* Letterbox bars slide in like the start of a film. */}
					<motion.div
						className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-black"
						initial={{ y: "-100%" }}
						animate={{ y: 0 }}
						transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
					/>
					<motion.div
						className="absolute inset-x-0 bottom-0 z-10 flex h-24 items-center justify-between gap-6 bg-black px-8 text-[11px] uppercase tracking-[.2em] text-white/40"
						initial={{ y: "100%" }}
						animate={{ y: 0 }}
						transition={{ duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
					>
						<span className="hidden lg:block">Scores from IMDb · Rotten Tomatoes · Metacritic</span>
						<span className="flex items-center gap-3 normal-case tracking-normal text-white/60">
							<span className="text-sm italic">A</span>
							<GoodWatchWordmark fontSize={30} />
							<span className="text-sm italic">picture</span>
						</span>
						<span className="hidden lg:block">On every service · Picked for your taste</span>
					</motion.div>
					<div className={`${FILL} pointer-events-none mx-auto flex max-w-7xl items-center justify-between gap-10 px-4 pb-32 pt-20 sm:px-8`}>
						<div className="hidden max-w-xl lg:block">
							<motion.div
								className="mb-5 text-xs font-semibold uppercase tracking-[.45em] text-amber-400"
								initial={{ opacity: 0, letterSpacing: "0.9em" }}
								animate={{ opacity: 1, letterSpacing: "0.45em" }}
								transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
							>
								GoodWatch presents
							</motion.div>
							<h1 className="text-6xl font-black leading-[1.02] tracking-tight text-white [text-shadow:0_4px_30px_rgba(0,0,0,.9)] xl:text-7xl">
								<BlurText text={HEADLINE} delay={0.4} />
							</h1>
							<div className="mt-6 h-px w-24 bg-amber-400/70" />
							<p className="mt-4 text-white/55">Sign in to pick up where you left off.</p>
						</div>
						<GlowCard className="pointer-events-auto w-full max-w-md shrink-0">
							<div className="mb-6 text-2xl font-bold text-white">Sign in</div>
							{form}
						</GlowCard>
					</div>
				</>
			)
		case "poster":
			return (
				<>
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-gray-950 via-gray-950/30 to-transparent" />
					<div className={`${FILL} pointer-events-none mx-auto flex max-w-7xl items-center justify-between gap-12 px-4 sm:px-8`}>
						{/* The headline as its own movie poster on the wall: the one title that is always in color. */}
						<motion.div
							className="relative hidden aspect-[2/3] h-[min(80svh,640px)] -rotate-2 overflow-hidden rounded-2xl shadow-[0_40px_90px_-20px_rgba(0,0,0,.95)] ring-1 ring-white/15 lg:block"
							style={{ background: "radial-gradient(120% 80% at 30% 8%, #b45309 0%, #7c2d12 32%, #312e81 72%, #030712 100%)" }}
							initial={{ opacity: 0, y: 40, rotate: -6 }}
							animate={{ opacity: 1, y: 0, rotate: -2 }}
							transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
						>
							<div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.025)_0px,rgba(255,255,255,.025)_1px,transparent_1px,transparent_3px)]" />
							<div className="relative flex h-full flex-col justify-between p-8 text-center">
								<div className="text-[11px] font-semibold uppercase tracking-[.4em] text-amber-200/80">GoodWatch presents</div>
								<h1 className="text-5xl font-black uppercase leading-[.88] tracking-tight text-white xl:text-6xl">
									Somewhere
									<br />
									in here
									<br />
									is your
									<br />
									next
									<br />
									<span className="text-amber-300">favorite.</span>
								</h1>
								<div className="flex flex-col items-center gap-4">
									<GoodWatchWordmark fontSize={34} />
									<p className="text-[9px] font-semibold uppercase leading-snug tracking-wide text-white/45">
										Starring your ratings · your watchlist · your taste
										<br />
										Scores by IMDb · Rotten Tomatoes · Metacritic · Streaming info for every service
										<br />
										<span className="text-white/70">Now showing on GoodWatch</span>
									</p>
								</div>
							</div>
						</motion.div>
						<GlowCard className="pointer-events-auto w-full max-w-md shrink-0">
							<div className="mb-6 text-2xl font-bold text-white">Sign in</div>
							{form}
						</GlowCard>
					</div>
				</>
			)
		case "center":
			return (
				<>
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_38%_70%_at_center,rgba(3,7,18,.9),rgba(3,7,18,.35)_70%,transparent)]" />
					<div className={`${FILL} pointer-events-none flex flex-col items-center justify-center gap-5 px-4`}>
						<motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>
							<GoodWatchWordmark fontSize="clamp(40px, 5.2vw, 72px)" />
						</motion.div>
						<p className="-mt-2 hidden text-center text-lg text-white/60 [@media(min-height:860px)]:block">
							<BlurText text={HEADLINE} delay={0.3} />
						</p>
						<GlowCard className="pointer-events-auto w-full max-w-md">
							<div className="mb-6 text-center text-3xl font-bold text-white">Sign in</div>
							{form}
						</GlowCard>
					</div>
				</>
			)
		case "split":
			return (
				<>
					<div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gray-950 lg:w-[46%]" />
					<div className="pointer-events-none absolute inset-y-0 left-[46%] hidden w-48 bg-gradient-to-r from-gray-950 to-transparent lg:block" />
					<div className={`${FILL} flex w-full items-center justify-center px-6 lg:w-[46%] lg:px-12`}>
						<div className="w-full max-w-md">
							<div className="relative mb-8">
								<div
									className="sw-anim pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full will-change-[opacity]"
									style={{ background: "radial-gradient(closest-side, rgba(245,158,11,.45), rgba(219,39,119,.15) 60%, transparent)", animation: "sw-breathe 5s ease-in-out infinite" }}
								/>
								<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="relative">
									<GoodWatchG height={64} color="#fbbf24" />
								</motion.div>
								<div className="relative mt-4">
									<GoodWatchWordmark fontSize={40} />
								</div>
								<h1 className="relative mt-5 text-5xl font-black tracking-tight text-white">
									<BlurText text="Sign in" delay={0.2} />
								</h1>
								<p className="relative mt-2 text-white/55">{HEADLINE}</p>
							</div>
							{form}
						</div>
					</div>
				</>
			)
		case "emblem":
			return (
				<>
					{/* A giant G cut out of the mosaic: inside it the posters show in full color. The mask never changes, and the
					    copy inside it never animates, so the G costs nothing per frame. */}
					<div
						className="pointer-events-none absolute inset-0 hidden lg:block"
						style={{
							maskImage: `url(${gEmblem})`,
							WebkitMaskImage: `url(${gEmblem})`,
							maskRepeat: "no-repeat",
							WebkitMaskRepeat: "no-repeat",
							maskSize: "auto 82%",
							WebkitMaskSize: "auto 82%",
							maskPosition: "12% 50%",
							WebkitMaskPosition: "12% 50%",
						}}
					>
						<Mosaic tiles={tiles} color fx={fx} still />
						<div className="absolute inset-0 bg-amber-500/10" />
					</div>
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-gray-950 via-gray-950/30 to-transparent" />
					<div className={`${FILL} pointer-events-none mx-auto flex max-w-7xl items-center justify-end px-4 sm:px-8`}>
						<GlowCard className="pointer-events-auto w-full max-w-md shrink-0">
							<div className="mb-7">
								<GoodWatchWordmark fontSize={38} />
								<div className="mt-5 text-3xl font-bold text-white">Sign in</div>
								<p className="mt-1 text-sm text-white/50">{HEADLINE}</p>
							</div>
							{form}
						</GlowCard>
					</div>
				</>
			)
		case "card":
			return (
				<>
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_75%_at_center,rgba(3,7,18,.85),transparent)]" />
					<div className={`${FILL} pointer-events-none flex items-center justify-center px-4`}>
						<GlowCard className="pointer-events-auto w-full max-w-lg" thick halo>
							<div className="mb-6 flex flex-col items-center gap-3 border-b border-white/10 pb-6 text-center">
								<GoodWatchWordmark fontSize="clamp(34px, 4vw, 48px)" />
								<div className="text-3xl font-bold text-white">Sign in</div>
								<p className="-mt-2 text-sm text-white/50">{HEADLINE}</p>
							</div>
							{form}
						</GlowCard>
					</div>
				</>
			)
		default:
			return (
				<>
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-gray-950 via-gray-950/40 to-transparent" />
					<div className={`${FILL} pointer-events-none mx-auto flex max-w-7xl items-center justify-between gap-10 px-4 sm:px-8`}>
						<h1 className="hidden max-w-xl text-6xl font-black leading-[1.02] tracking-tight text-white drop-shadow-[0_4px_30px_rgba(0,0,0,.9)] lg:block xl:text-7xl">
							<BlurText text={HEADLINE} />
						</h1>
						<GlowCard className="pointer-events-auto w-full max-w-md shrink-0">
							<div className="mb-7 flex justify-center">
								<GoodWatchWordmark fontSize={40} />
							</div>
							{form}
						</GlowCard>
					</div>
				</>
			)
	}
}

/**
 * The "reveal" headline, drawn twice at the same spot: outlined under the spotlight's window and filled inside it, so
 * the moving spotlight lights up the words it passes, the way it lights up the posters.
 */
function RevealHeadline({ lit }: { lit: boolean }) {
	return (
		<h1
			aria-hidden={lit}
			className="pointer-events-none absolute left-[max(1rem,calc((100%-80rem)/2+2rem))] top-1/2 hidden max-w-xl -translate-y-1/2 text-6xl font-black leading-[1.02] tracking-tight lg:block xl:text-7xl"
			style={lit ? { color: "#fff" } : { color: "transparent", WebkitTextStroke: "1.5px rgba(255,255,255,.45)" }}
		>
			Somewhere in here is your next <span style={lit ? { color: "#fbbf24" } : undefined}>favorite.</span>
		</h1>
	)
}
