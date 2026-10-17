// The footer's small motions. They move with transform and opacity only, and hold still under reduced motion.
import { type ReactNode, useEffect, useRef, useState } from "react"

export function usePrefersReducedMotion() {
	const [reduced, setReduced] = useState(false)
	useEffect(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)")
		setReduced(query.matches)
		const onChange = () => setReduced(query.matches)
		query.addEventListener("change", onChange)
		return () => query.removeEventListener("change", onChange)
	}, [])
	return reduced
}

/**
 * Whether the footer has come into view (`revealed`) and whether it is on screen now (`onScreen`).
 * Without JavaScript, and when it is already on screen at hydration, the footer is shown at once:
 * only a footer that is still below the window waits for its entrance.
 */
export function useFooterView<T extends Element>() {
	const ref = useRef<T>(null)
	const [revealed, setRevealed] = useState<"server" | "waiting" | "shown">(
		"server",
	)
	const [onScreen, setOnScreen] = useState(false)
	useEffect(() => {
		const element = ref.current
		if (!element) return
		const top = element.getBoundingClientRect().top
		setRevealed(top < window.innerHeight ? "shown" : "waiting")
		const observer = new IntersectionObserver(
			([entry]) => {
				setOnScreen(entry.isIntersecting)
				if (entry.isIntersecting) setRevealed("shown")
			},
			{ rootMargin: "0px 0px -10% 0px" },
		)
		observer.observe(element)
		return () => observer.disconnect()
	}, [])
	return { ref, hidden: revealed === "waiting", onScreen }
}

/** Fades and lifts its content into place when `hidden` turns false, after `delay` ms. */
export function Reveal({
	hidden,
	delay = 0,
	className = "",
	children,
}: {
	hidden: boolean
	delay?: number
	className?: string
	children: ReactNode
}) {
	return (
		<div
			className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${className}`}
			style={{
				opacity: hidden ? 0 : 1,
				transform: hidden ? "translate3d(0, 14px, 0)" : "none",
				transitionDelay: hidden ? "0ms" : `${delay}ms`,
			}}
		>
			{children}
		</div>
	)
}

/** Pulls its content a little toward a mouse pointer. */
export function Magnet({
	children,
	strength = 0.18,
	className = "",
}: { children: ReactNode; strength?: number; className?: string }) {
	const element = useRef<HTMLDivElement>(null)
	const reduced = usePrefersReducedMotion()
	return (
		<div
			ref={element}
			className={`transition-transform duration-300 ease-out-back ${className}`}
			onPointerMove={(event) => {
				if (reduced || event.pointerType !== "mouse" || !element.current) return
				const box = element.current.getBoundingClientRect()
				const x = (event.clientX - box.left - box.width / 2) * strength
				const y = (event.clientY - box.top - box.height / 2) * strength
				element.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
			}}
			onPointerLeave={() => {
				if (element.current) element.current.style.transform = ""
			}}
		>
			{children}
		</div>
	)
}

/** A light sweep that crosses its parent every few seconds. The parent needs `relative` and `overflow-hidden`. */
export function Sheen() {
	return (
		<span
			aria-hidden
			className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
		>
			<span className="footer-sheen absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
		</span>
	)
}

const GLYPHS = "abcdefghijklmnopqrstuvwxyz0123456789_"

/** Scrambles the text, then settles it letter by letter, while `active`. Deterministic, so it never differs from the server. */
export function ScrambleText({
	text,
	active,
}: { text: string; active: boolean }) {
	const [shown, setShown] = useState(text)
	const reduced = usePrefersReducedMotion()
	useEffect(() => {
		if (!active || reduced) {
			setShown(text)
			return
		}
		let frame = 0
		const timer = window.setInterval(() => {
			frame++
			const settled = Math.floor(frame / 2)
			setShown(
				Array.from(text, (char, i) =>
					i < settled || char === "@"
						? char
						: GLYPHS[(i * 7 + frame * 13) % GLYPHS.length],
				).join(""),
			)
			if (settled >= text.length) window.clearInterval(timer)
		}, 30)
		return () => window.clearInterval(timer)
	}, [active, reduced, text])
	return <span className="font-mono">{shown}</span>
}
