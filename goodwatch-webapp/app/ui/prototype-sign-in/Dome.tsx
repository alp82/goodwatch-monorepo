// PROTOTYPE - throwaway. Variant "dome": you stand inside a sphere of posters (after react-bits Dome Gallery).
// It drifts on its own, drags with inertia, and a click opens the poster as a card with its score.
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { BlurText, GlowCard, STAGE, ScoreBadge, Wordmark } from "./shared"
import { type SignInTitle, type VariantProps, fill, seededShuffle } from "./types"

const LONS = 22
const LATS = [-36, -18, 0, 18, 36]
const RADIUS = 760

export function Dome({ titles, form }: VariantProps) {
	const tiles = useMemo(() => {
		const pool = fill(seededShuffle(titles, 23), LONS * LATS.length)
		return LATS.flatMap((lat, row) =>
			Array.from({ length: LONS }, (_, i) => ({
				t: pool[row * LONS + i],
				lon: (i + (row % 2) * 0.5) * (360 / LONS),
				lat,
			})),
		)
	}, [titles])

	const sphere = useRef<HTMLDivElement>(null)
	const rot = useRef({ x: -4, y: 0, vx: 0, vy: 0.04 })
	const drag = useRef<{ x: number; y: number; moved: number } | null>(null)
	const [open, setOpen] = useState<SignInTitle | null>(null)

	useEffect(() => {
		let raf = 0
		const tick = () => {
			const r = rot.current
			if (!drag.current) {
				r.y += r.vy
				r.x += r.vx
				r.vy += (0.04 - r.vy) * 0.02
				r.vx *= 0.94
				r.x += (-4 - r.x) * 0.01
			}
			r.x = Math.max(-22, Math.min(22, r.x))
			if (sphere.current) sphere.current.style.transform = `translateZ(${RADIUS * 0.55}px) rotateX(${r.x}deg) rotateY(${r.y}deg)`
			raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [])

	const onDown = (e: React.PointerEvent) => {
		if ((e.target as HTMLElement).closest("[data-no-drag]")) return
		drag.current = { x: e.clientX, y: e.clientY, moved: 0 }
	}
	const onMove = (e: React.PointerEvent) => {
		const d = drag.current
		if (!d) return
		const dx = e.clientX - d.x
		const dy = e.clientY - d.y
		d.x = e.clientX
		d.y = e.clientY
		d.moved += Math.abs(dx) + Math.abs(dy)
		const r = rot.current
		r.y -= dx * 0.12
		r.x += dy * 0.12
		r.vy = -dx * 0.12
		r.vx = dy * 0.12
	}
	const onUp = () => {
		setTimeout(() => (drag.current = null), 0)
	}
	const pick = (t: SignInTitle) => {
		if ((drag.current?.moved ?? 0) > 6) return
		setOpen(t)
	}

	return (
		<div
			className={`${STAGE} cursor-grab touch-none select-none active:cursor-grabbing`}
			onPointerDown={onDown}
			onPointerMove={onMove}
			onPointerUp={onUp}
			onPointerLeave={onUp}
		>
			<div className="absolute inset-0" style={{ perspective: 620 }}>
				<div ref={sphere} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transformStyle: "preserve-3d" }}>
					{tiles.map(({ t, lon, lat }, i) => (
						<button
							type="button"
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
							key={i}
							onClick={() => pick(t)}
							className="group absolute -left-[78px] -top-[117px] h-[234px] w-[156px] cursor-pointer [backface-visibility:hidden]"
							style={{ transform: `rotateY(${lon}deg) rotateX(${lat}deg) translateZ(${-RADIUS}px)` }}
						>
							<img
								src={t.poster}
								alt={t.title}
								loading="lazy"
								draggable={false}
								className="h-full w-full rounded-2xl object-cover ring-1 ring-white/10 brightness-75 transition duration-300 group-hover:brightness-110 group-hover:ring-2 group-hover:ring-amber-400/80"
							/>
						</button>
					))}
				</div>
			</div>

			{/* Fade the dome into the dark on every side, strongest behind the form. */}
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_75%_at_60%_50%,transparent_35%,rgba(3,7,18,.95)_100%)]" />
			<div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-gray-950/95 via-gray-950/50 to-transparent lg:w-3/4" />

			<div className="pointer-events-none absolute inset-0 mx-auto flex max-w-7xl items-center px-4 sm:px-8">
				<div data-no-drag className="pointer-events-auto w-full max-w-md cursor-auto">
					<div className="mb-8">
						<Wordmark />
						<h1 className="mt-4 text-4xl font-bold leading-tight text-white sm:text-5xl">
							<BlurText text="Step back inside." />
						</h1>
						<p className="mt-3 max-w-sm text-white/55">
							<BlurText text="Drag the dome around. Click a poster to see its score." delay={0.4} />
						</p>
					</div>
					<GlowCard>{form}</GlowCard>
				</div>
			</div>

			<AnimatePresence>
				{open && (
					<motion.div
						data-no-drag
						className="absolute inset-0 z-20 flex cursor-auto items-center justify-center bg-gray-950/60 p-4 backdrop-blur-md"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => setOpen(null)}
					>
						<motion.div
							className="flex max-w-xl flex-col items-center gap-5 sm:flex-row sm:items-end"
							initial={{ scale: 0.6, rotateY: -25, opacity: 0 }}
							animate={{ scale: 1, rotateY: 0, opacity: 1 }}
							exit={{ scale: 0.85, opacity: 0 }}
							transition={{ type: "spring", stiffness: 180, damping: 20 }}
							style={{ transformPerspective: 900 }}
						>
							<img src={open.poster} alt={open.title} className="w-56 rounded-2xl shadow-2xl shadow-black ring-1 ring-white/15" />
							<div className="text-center sm:text-left">
								<div className="text-xs uppercase tracking-widest text-white/40">{open.type === "show" ? "Show" : "Movie"} · {open.year}</div>
								<div className="mt-1 text-3xl font-bold text-white">{open.title}</div>
								<div className="mt-3 flex items-center justify-center gap-2 text-sm text-white/60 sm:justify-start">
									<ScoreBadge score={open.score} /> GoodWatch score
								</div>
								<div className="mt-4 text-sm text-amber-400">Sign in to add it to your watchlist.</div>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
