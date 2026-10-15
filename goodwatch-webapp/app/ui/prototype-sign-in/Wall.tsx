// PROTOTYPE - throwaway. Variant "wall": a tilted 3D wall of endlessly scrolling poster columns (after react-bits
// 3D Marquee). A spotlight follows the cursor, hovered columns pause, and a hovered poster lifts out with its title.
import { useEffect, useMemo, useRef } from "react"
import { BlurText, GlowCard, STAGE, ScoreBadge, Wordmark } from "./shared"
import { type VariantProps, fill, seededShuffle } from "./types"

const COLS = 9
const PER_COL = 9

export function Wall({ titles, form }: VariantProps) {
	const columns = useMemo(() => {
		const pool = seededShuffle(titles, 11)
		return Array.from({ length: COLS }, (_, c) => fill(pool.slice(c * PER_COL).concat(pool), PER_COL))
	}, [titles])

	// The spotlight is a small radial-gradient tile scaled up 12x and moved with a transform, so following the
	// cursor never repaints anything.
	const spot = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const cur = { x: 0, y: 0 }
		const target = { x: 0, y: 0 }
		let raf = 0
		const loop = () => {
			cur.x += (target.x - cur.x) * 0.12
			cur.y += (target.y - cur.y) * 0.12
			if (spot.current) spot.current.style.transform = `translate(${cur.x - 150}px, ${cur.y - 150}px) scale(12)`
			raf = requestAnimationFrame(loop)
		}
		const onMove = (e: PointerEvent) => {
			const r = spot.current?.parentElement?.getBoundingClientRect()
			if (r) Object.assign(target, { x: e.clientX - r.left, y: e.clientY - r.top })
		}
		const r = spot.current?.parentElement?.getBoundingClientRect()
		if (r) Object.assign(target, cur, { x: r.width / 2, y: r.height / 2 })
		window.addEventListener("pointermove", onMove, { passive: true })
		raf = requestAnimationFrame(loop)
		return () => {
			cancelAnimationFrame(raf)
			window.removeEventListener("pointermove", onMove)
		}
	}, [])

	return (
		<div className={STAGE} style={{ perspective: 1400 }}>
			<style dangerouslySetInnerHTML={{ __html: `
				@keyframes sw-up { from { transform: translateY(0) } to { transform: translateY(-50%) } }
				@keyframes sw-down { from { transform: translateY(-50%) } to { transform: translateY(0) } }
			` }} />
			<div className="absolute left-1/2 top-1/2 flex gap-5" style={{ transform: "translate(-50%, -50%)", transformStyle: "preserve-3d", width: "190vw", height: "260vh" }}>
				<div
					className="flex h-full w-full gap-5"
					style={{ transform: "rotateX(48deg) rotateZ(-24deg)", transformStyle: "preserve-3d" }}
				>
					{columns.map((col, c) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed columns
							key={c}
							className="sw-anim flex flex-1 flex-col gap-5 will-change-transform hover:[animation-play-state:paused]"
							style={{
								animation: `${c % 2 ? "sw-down" : "sw-up"} ${70 + (c % 3) * 18}s linear infinite`,
								marginTop: c % 2 ? "-12%" : 0,
							}}
						>
							{[...col, ...col].map((t, i) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: duplicated loop
									key={`${t.key}-${i}`}
									className="group relative aspect-[2/3] w-full shrink-0 rounded-xl transition-[transform,filter] duration-500 ease-out hover:z-10 hover:[transform:translateZ(60px)_scale(1.06)]"
								>
									<img
										src={t.poster}
										alt={t.title}
										loading="lazy"
										draggable={false}
										className="h-full w-full rounded-xl object-cover shadow-[0_20px_40px_-10px_rgba(0,0,0,.8)] ring-1 ring-white/10 brightness-[.62] saturate-[.85] transition duration-500 group-hover:brightness-110 group-hover:saturate-125"
									/>
									<div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-2 items-end justify-between gap-2 rounded-b-xl bg-gradient-to-t from-black/90 to-transparent p-3 pt-10 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
										<span className="text-sm font-semibold leading-tight text-white">
											{t.title} <span className="font-normal text-white/50">{t.year}</span>
										</span>
										<ScoreBadge score={t.score} />
									</div>
								</div>
							))}
						</div>
					))}
				</div>
			</div>

			{/* Darken toward the edges and under the card; the spotlight follows the cursor. */}
			<div
				ref={spot}
				className="pointer-events-none absolute left-0 top-0 h-[300px] w-[300px] origin-center will-change-transform"
				style={{ background: "radial-gradient(circle closest-side, transparent 0%, rgba(3,7,18,.6) 30%, rgba(3,7,18,.6) 100%)" }}
			/>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(3,7,18,.82)_0%,rgba(3,7,18,.35)_45%,transparent_70%)]" />
			<div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-gray-950 to-transparent" />
			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-gray-950 to-transparent" />

			<div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
				<GlowCard className="pointer-events-auto w-full max-w-md">
					<div className="mb-6 flex flex-col items-center gap-3 text-center">
						<Wordmark />
						<h1 className="text-3xl font-bold text-white sm:text-4xl">
							<BlurText text="Welcome back" />
						</h1>
						<p className="text-sm text-white/50">Your ratings, watchlist, and picks are waiting.</p>
					</div>
					{form}
				</GlowCard>
			</div>
		</div>
	)
}
