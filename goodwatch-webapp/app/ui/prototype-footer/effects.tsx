// PROTOTYPE - throwaway. Small motion pieces in the spirit of React Bits, for the round 2 footers (F, G, H).
// Everything moves with transform and opacity only, and holds still under prefers-reduced-motion.
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react"

export function useReducedMotion() {
	const [reduced, setReduced] = useState(false)
	useEffect(() => {
		const q = window.matchMedia("(prefers-reduced-motion: reduce)")
		setReduced(q.matches)
		const on = () => setReduced(q.matches)
		q.addEventListener("change", on)
		return () => q.removeEventListener("change", on)
	}, [])
	return reduced
}

/** True once the element has scrolled into view (stays true). */
export function useInView<T extends Element>(margin = "0px 0px -15% 0px") {
	const ref = useRef<T>(null)
	const [seen, setSeen] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const io = new IntersectionObserver(
			([e]) => {
				if (e.isIntersecting) {
					setSeen(true)
					io.disconnect()
				}
			},
			{ rootMargin: margin },
		)
		io.observe(el)
		return () => io.disconnect()
	}, [margin])
	return [ref, seen] as const
}

/** Fades and lifts its child into place when `show` turns true, after `delay` ms. */
export function Reveal({
	show,
	delay = 0,
	children,
	className = "",
	y = 14,
}: { show: boolean; delay?: number; children: ReactNode; className?: string; y?: number }) {
	return (
		<div
			className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${className}`}
			style={{
				opacity: show ? 1 : 0,
				transform: show ? "none" : `translate3d(0, ${y}px, 0)`,
				transitionDelay: `${delay}ms`,
			}}
		>
			{children}
		</div>
	)
}

/**
 * A soft glow that follows the pointer inside the box (React Bits "Spotlight").
 * The glow is one blurred circle moved with transform, so moving it costs no repaint.
 */
export function Spotlight({
	children,
	className = "",
	color = "rgba(251,191,36,0.10)",
	size = 420,
}: { children: ReactNode; className?: string; color?: string; size?: number }) {
	const box = useRef<HTMLDivElement>(null)
	const glow = useRef<HTMLDivElement>(null)
	const onMove = (e: React.PointerEvent) => {
		const r = box.current?.getBoundingClientRect()
		if (!r || !glow.current) return
		glow.current.style.transform = `translate3d(${e.clientX - r.left - size / 2}px, ${e.clientY - r.top - size / 2}px, 0)`
		glow.current.style.opacity = "1"
	}
	return (
		<div
			ref={box}
			onPointerMove={onMove}
			onPointerLeave={() => glow.current && (glow.current.style.opacity = "0")}
			className={`relative overflow-hidden ${className}`}
		>
			<div
				ref={glow}
				aria-hidden
				className="pointer-events-none absolute top-0 left-0 rounded-full opacity-0 transition-opacity duration-500 will-change-transform"
				style={{ width: size, height: size, background: `radial-gradient(circle, ${color} 0%, transparent 65%)` }}
			/>
			{children}
		</div>
	)
}

/** Tilts toward the pointer in 3D and slides a glare across (React Bits "Tilted card" + "Glare hover"). */
export function TiltCard({ children, className = "", max = 8 }: { children: ReactNode; className?: string; max?: number }) {
	const card = useRef<HTMLDivElement>(null)
	const glare = useRef<HTMLDivElement>(null)
	const reduced = useReducedMotion()
	const onMove = (e: React.PointerEvent) => {
		if (reduced || e.pointerType !== "mouse") return
		const el = card.current
		if (!el) return
		const r = el.getBoundingClientRect()
		const x = (e.clientX - r.left) / r.width - 0.5
		const y = (e.clientY - r.top) / r.height - 0.5
		el.style.transform = `perspective(900px) rotateX(${-y * max}deg) rotateY(${x * max}deg) translateZ(0)`
		if (glare.current) {
			glare.current.style.transform = `translate3d(${x * 60}%, ${y * 60}%, 0)`
			glare.current.style.opacity = "1"
		}
	}
	const reset = () => {
		if (card.current) card.current.style.transform = "perspective(900px) rotateX(0) rotateY(0)"
		if (glare.current) glare.current.style.opacity = "0"
	}
	return (
		<div
			ref={card}
			onPointerMove={onMove}
			onPointerLeave={reset}
			className={`relative transition-transform duration-300 ease-out will-change-transform ${className}`}
		>
			{children}
			<div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
				<div
					ref={glare}
					className="absolute -inset-1/2 opacity-0 transition-opacity duration-300"
					style={{ background: "radial-gradient(circle at center, rgba(255,255,255,0.10), transparent 45%)" }}
				/>
			</div>
		</div>
	)
}

/** Pulls toward the pointer a little (React Bits "Magnet"). */
export function Magnet({ children, strength = 0.25, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
	const el = useRef<HTMLDivElement>(null)
	const reduced = useReducedMotion()
	return (
		<div
			ref={el}
			className={`inline-block transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform ${className}`}
			onPointerMove={(e) => {
				if (reduced || e.pointerType !== "mouse" || !el.current) return
				const r = el.current.getBoundingClientRect()
				const x = (e.clientX - r.left - r.width / 2) * strength
				const y = (e.clientY - r.top - r.height / 2) * strength
				el.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
			}}
			onPointerLeave={() => el.current && (el.current.style.transform = "translate3d(0,0,0)")}
		>
			{children}
		</div>
	)
}

/** A light sweep that crosses its parent every few seconds (React Bits "Shiny" on a surface). Parent needs overflow-hidden + relative. */
export function Sheen({ every = 4.5 }: { every?: number }) {
	return (
		<span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] motion-reduce:hidden">
			<span
				className="absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent"
				style={{ animation: `proto-sheen ${every}s ease-in-out infinite` }}
			/>
		</span>
	)
}

/**
 * A light that runs around the border (React Bits "Star border"). A big conic gradient spins behind
 * the content, and the content's own background masks all but a 1px rim.
 */
export function OrbitBorder({
	children,
	className = "",
	inner = "",
	speed = 6,
	color = "#5865F2",
}: { children: ReactNode; className?: string; inner?: string; speed?: number; color?: string }) {
	return (
		<div className={`relative overflow-hidden p-px ${className}`}>
			<div
				aria-hidden
				className="absolute top-1/2 left-1/2 aspect-square w-[200%] motion-reduce:hidden"
				style={{
					background: `conic-gradient(from 0deg, transparent 0deg, ${color} 40deg, transparent 90deg, transparent 180deg, #fbbf24 220deg, transparent 270deg)`,
					animation: `proto-spin ${speed}s linear infinite`,
				}}
			/>
			<div className="absolute inset-0 rounded-[inherit] bg-white/[0.08]" aria-hidden />
			<div className={`relative rounded-[inherit] ${inner}`}>{children}</div>
		</div>
	)
}

/** Counts up to `to` once shown (React Bits "Count up"). */
export function CountUp({ to, show, suffix = "" }: { to: number; show: boolean; suffix?: string }) {
	const [n, setN] = useState(0)
	useEffect(() => {
		if (!show) return
		const start = performance.now()
		let raf = 0
		const tick = (t: number) => {
			const p = Math.min(1, (t - start) / 1400)
			setN(Math.round(to * (1 - (1 - p) ** 3)))
			if (p < 1) raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [show, to])
	return (
		<span className="tabular-nums">
			{n}
			{suffix}
		</span>
	)
}

const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789@_"
/** Scrambles, then settles on the text on hover (React Bits "Decrypted text"). */
export function Decrypt({ text, active }: { text: string; active: boolean }) {
	const [out, setOut] = useState(text)
	useEffect(() => {
		if (!active) {
			setOut(text)
			return
		}
		let frame = 0
		const id = window.setInterval(() => {
			frame++
			setOut(
				text
					.split("")
					.map((c, i) => (i < frame / 2 ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
					.join(""),
			)
			if (frame / 2 >= text.length) window.clearInterval(id)
		}, 30)
		return () => window.clearInterval(id)
	}, [active, text])
	return <span className="font-mono">{out}</span>
}

/** An endless slow strip of content (React Bits "Scroll velocity", without the scroll coupling). */
export function Marquee({ children, seconds = 40, className = "" }: { children: ReactNode; seconds?: number; className?: string }) {
	const style: CSSProperties = { animation: `proto-marquee ${seconds}s linear infinite` }
	return (
		<div className={`flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)] ${className}`}>
			<div className="flex shrink-0 items-center motion-reduce:[animation:none!important]" style={style}>
				{children}
				{children}
			</div>
		</div>
	)
}

/** The keyframes the pieces use. Render once per footer. */
export function EffectStyles() {
	return (
		<style>{`
@keyframes proto-sheen { 0%, 60% { transform: translateX(0) skewX(-20deg) } 100% { transform: translateX(480%) skewX(-20deg) } }
@keyframes proto-spin { from { transform: translate(-50%, -50%) rotate(0deg) } to { transform: translate(-50%, -50%) rotate(360deg) } }
@keyframes proto-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes proto-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes proto-pop { 0% { transform: scale(0.6); opacity: 0 } 60% { transform: scale(1.1); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
`}</style>
	)
}
