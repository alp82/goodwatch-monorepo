// PROTOTYPE - throwaway. Variant "orbit": a ring of posters circles behind the form like a carousel cylinder (after
// react-bits Circular Gallery), over a slow aurora. Drag or scroll to spin it; it eases back to its own pace.
// The poster closest to the front is named under the card.
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { BlurText, GlowCard, STAGE, ScoreBadge } from "./shared"
import { type VariantProps, fill, seededShuffle } from "./types"

const COUNT = 26
const RADIUS = 860

export function Orbit({ titles, form }: VariantProps) {
	const ring = useMemo(() => fill(seededShuffle(titles, 77), COUNT), [titles])
	const ringEl = useRef<HTMLDivElement>(null)
	const state = useRef({ a: 0, v: 0.05, drag: null as number | null })
	const [frontIdx, setFrontIdx] = useState(0)

	useEffect(() => {
		let raf = 0
		const loop = () => {
			const s = state.current
			if (s.drag === null) {
				s.v += (0.05 - s.v) * 0.03
				s.a += s.v
			}
			if (ringEl.current) ringEl.current.style.transform = `translateZ(${-RADIUS}px) rotateX(-6deg) rotateY(${-s.a}deg)`
			const step = 360 / COUNT
			const idx = (((Math.round(s.a / step) % COUNT) + COUNT) % COUNT)
			setFrontIdx((p) => (p === idx ? p : idx))
			raf = requestAnimationFrame(loop)
		}
		raf = requestAnimationFrame(loop)
		return () => cancelAnimationFrame(raf)
	}, [])

	const onDown = (e: React.PointerEvent) => {
		if ((e.target as HTMLElement).closest("[data-no-drag]")) return
		state.current.drag = e.clientX
	}
	const onMove = (e: React.PointerEvent) => {
		const s = state.current
		if (s.drag === null) return
		const dx = e.clientX - s.drag
		s.drag = e.clientX
		s.a -= dx * 0.08
		s.v = -dx * 0.08
	}
	const onUp = () => {
		state.current.drag = null
	}
	const onWheel = (e: React.WheelEvent) => {
		state.current.v += (e.deltaY + e.deltaX) * 0.004
	}

	const front = ring[frontIdx]

	return (
		<div
			className={`${STAGE} cursor-grab touch-pan-y select-none active:cursor-grabbing`}
			onPointerDown={onDown}
			onPointerMove={onMove}
			onPointerUp={onUp}
			onPointerLeave={onUp}
			onWheel={onWheel}
		>
			<style dangerouslySetInnerHTML={{ __html: `
				@keyframes sw-aurora { 0%,100% { transform: translate(-10%, -5%) rotate(0deg) scale(1) } 50% { transform: translate(10%, 6%) rotate(25deg) scale(1.15) } }
			` }} />
			<div className="pointer-events-none absolute inset-0 opacity-60">
				<div className="sw-anim absolute left-[10%] top-[5%] h-[55%] w-[45%] will-change-transform" style={{ background: "radial-gradient(closest-side, rgba(217,119,6,.55), transparent)", animation: "sw-aurora 18s ease-in-out infinite" }} />
				<div className="sw-anim absolute right-[8%] top-[20%] h-[50%] w-[40%] will-change-transform" style={{ background: "radial-gradient(closest-side, rgba(134,25,143,.5), transparent)", animation: "sw-aurora 23s ease-in-out infinite reverse" }} />
				<div className="sw-anim absolute bottom-0 left-[35%] h-[45%] w-[40%] will-change-transform" style={{ background: "radial-gradient(closest-side, rgba(4,120,87,.4), transparent)", animation: "sw-aurora 27s ease-in-out infinite" }} />
			</div>

			<div className="absolute inset-0" style={{ perspective: 1000 }}>
				<div ref={ringEl} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transformStyle: "preserve-3d" }}>
					{ring.map((t, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed ring slots
							key={i}
							className="absolute -left-[105px] -top-[158px] h-[316px] w-[210px]"
							style={{ transform: `rotateY(${(i * 360) / COUNT}deg) translateZ(${RADIUS}px)` }}
						>
							<img
								src={t.poster}
								alt={t.title}
								draggable={false}
								className={`h-full w-full rounded-2xl object-cover ring-1 ring-white/15 transition-opacity duration-700 ${
									i === frontIdx ? "opacity-100" : "opacity-55"
								}`}
							/>
						</div>
					))}
				</div>
			</div>

			<div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-gray-950 to-transparent" />
			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-gray-950 to-transparent" />
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_32%_60%_at_center,rgba(3,7,18,.75),transparent)]" />

			<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 p-4">
				<h1 className="text-center text-3xl font-bold text-white drop-shadow-[0_4px_20px_rgba(0,0,0,.8)] sm:text-4xl">
					<BlurText text="Welcome back to GoodWatch" />
				</h1>
				<div data-no-drag className="pointer-events-auto w-full max-w-md cursor-auto">
					<GlowCard>{form}</GlowCard>
				</div>
				<div className="h-6">
					<AnimatePresence mode="wait">
						<motion.div
							key={front.key}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6 }}
							transition={{ duration: 0.3 }}
							className="flex items-center gap-2 text-sm text-white/60"
						>
							Now passing: <span className="font-semibold text-white">{front.title}</span> {front.year} <ScoreBadge score={front.score} />
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		</div>
	)
}
