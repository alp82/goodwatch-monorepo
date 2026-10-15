// PROTOTYPE - throwaway. Small pieces the /sign-in variants share: animated headline and the glowing glass card.
import { useSearchParams } from "@remix-run/react"
import { motion } from "framer-motion"
import { useEffect, useRef } from "react"

// The stage is at least one screen tall and grows with its content, so a short window never cuts off the form.
export const STAGE = "relative w-full overflow-hidden bg-gray-950 min-h-[max(calc(100svh-4rem),680px)]"
/** In-flow foreground wrapper that fills the stage: content sets the height when it is taller than the screen. */
export const FILL = "relative min-h-[max(calc(100svh-4rem),680px)] py-10"

/** Words fade in from a blur, one after another (after react-bits BlurText). */
export function BlurText({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
	return (
		<span className={className}>
			{text.split(" ").map((word, i) => (
				<motion.span
					// biome-ignore lint/suspicious/noArrayIndexKey: static words
					key={i}
					className="inline-block"
					initial={{ opacity: 0, filter: "blur(12px)", y: 14 }}
					animate={{ opacity: 1, filter: "blur(0px)", y: 0, transitionEnd: { filter: "none", transform: "none" } }}
					transition={{ duration: 0.7, delay: delay + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
				>
					{word}&nbsp;
				</motion.span>
			))}
		</span>
	)
}

// Border light styles for the card, switchable with ?border=. Every one animates only transform or opacity, so the
// browser moves already-drawn layers instead of repainting the card each frame.
export const BORDERS: Record<string, string> = {
	aurora: "Aurora (slow color wheel)",
	sweep: "Sweep (two lights circling)",
	comet: "Comet (one light with a tail)",
	breathe: "Breathe (glow fades in and out)",
	beam: "Beam (lights up near the cursor)",
	hairline: "Hairline (static, no motion)",
}

// Square just big enough to cover the card's corners while it rotates.
const ROTATOR = "sw-anim pointer-events-none absolute left-1/2 top-1/2 aspect-square h-[125%] will-change-transform"

function BorderFx({ kind, card }: { kind: string; card: React.RefObject<HTMLDivElement> }) {
	const blob = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (kind !== "beam") return
		const onMove = (e: PointerEvent) => {
			const r = card.current?.getBoundingClientRect()
			if (r && blob.current) blob.current.style.transform = `translate(${e.clientX - r.left - 200}px, ${e.clientY - r.top - 200}px)`
		}
		window.addEventListener("pointermove", onMove, { passive: true })
		return () => window.removeEventListener("pointermove", onMove)
	}, [kind, card])

	switch (kind) {
		case "comet":
			return (
				<div
					className={ROTATOR}
					style={{
						animation: "sw-rot 4.5s linear infinite",
						background: "conic-gradient(from 0deg, transparent 0deg 250deg, rgba(251,191,36,.15) 290deg, rgba(251,191,36,.9) 350deg, #fff 359deg, transparent 360deg)",
					}}
				/>
			)
		default:
			return (
				<div
					className={`${ROTATOR} opacity-80`}
					style={{
						animation: "sw-rot 14s linear infinite",
						background: "conic-gradient(from 0deg, #f59e0b, #db2777, #7c3aed, #0d9488, #f59e0b)",
					}}
				/>
			)
		case "breathe":
			return (
				<>
					<div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(251,191,36,.9),rgba(255,255,255,.08)_40%,rgba(255,255,255,.06)_60%,rgba(249,115,22,.7))]" />
					<div className="sw-anim pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,#fde68a,transparent_45%,transparent_55%,#fb923c)] will-change-[opacity]" style={{ animation: "sw-breathe 3.6s ease-in-out infinite" }} />
				</>
			)
		case "beam":
			return (
				<>
					<div className="pointer-events-none absolute inset-0 bg-white/10" />
					<div
						ref={blob}
						className="pointer-events-none absolute left-0 top-0 h-[400px] w-[400px] will-change-transform"
						style={{ background: "radial-gradient(circle, rgba(253,230,138,1) 0%, rgba(251,191,36,.5) 25%, transparent 60%)", transform: "translate(-999px,-999px)" }}
					/>
				</>
			)
		case "hairline":
			return <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,.06)_30%,rgba(255,255,255,.04)_80%,rgba(251,191,36,.25))]" />
		case "sweep":
			return (
				<div
					className={ROTATOR}
					style={{
						animation: "sw-rot 7s linear infinite",
						background:
							"conic-gradient(from 0deg, rgba(255,255,255,.08) 0deg, rgba(251,191,36,.9) 40deg, rgba(255,255,255,.08) 90deg, rgba(255,255,255,.08) 220deg, rgba(249,115,22,.6) 260deg, rgba(255,255,255,.08) 300deg)",
					}}
				/>
			)
	}
}

/** Card with an animated light on its border (after react-bits StarBorder). No backdrop blur: it would re-blur the moving
 * posters every frame. `thick` widens the border; `halo` adds a soft rotating aurora glow outside the card, built from
 * a rotating gradient under a fixed fade-out mask, so it stays a composited layer. */
export function GlowCard({ children, className = "", thick = false, halo = false }: { children: React.ReactNode; className?: string; thick?: boolean; halo?: boolean }) {
	const [params] = useSearchParams()
	const kind = params.get("border") ?? "aurora"
	const card = useRef<HTMLDivElement>(null)
	const border = thick ? "3px" : "1.5px"
	return (
		<motion.div
			initial={{ opacity: 0, y: 24 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
			className={`relative ${className}`}
		>
			{halo && (
				<div
					className="pointer-events-none absolute -inset-16 overflow-hidden opacity-45"
					style={{
						maskImage: "radial-gradient(closest-side, #000 55%, transparent 100%)",
						WebkitMaskImage: "radial-gradient(closest-side, #000 55%, transparent 100%)",
					}}
				>
					<div
						className="sw-anim absolute left-1/2 top-1/2 aspect-square h-[140%] will-change-transform"
						style={{ animation: "sw-rot 14s linear infinite", background: "conic-gradient(from 0deg, #f59e0b, #db2777, #7c3aed, #0d9488, #f59e0b)" }}
					/>
				</div>
			)}
			<div ref={card} className="relative isolate overflow-hidden rounded-3xl" style={{ padding: border }}>
				<BorderFx kind={kind} card={card} />
				<div className="relative bg-gray-950 px-7 py-8 shadow-2xl shadow-black/60 sm:px-9" style={{ borderRadius: `calc(1.5rem - ${border})` }}>
					{children}
				</div>
			</div>
		</motion.div>
	)
}

export function Wordmark() {
	return (
		<div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white/70">
			<img src="/apple-touch-icon.png" alt="" className="h-6 w-6 rounded-md" />
			GoodWatch
		</div>
	)
}

export function ScoreBadge({ score }: { score: number }) {
	const hue = Math.max(0, Math.min(120, (score - 40) * 2.4))
	return (
		<span
			className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold text-white tabular-nums"
			style={{ background: `hsl(${hue} 70% 32%)` }}
		>
			{score}
		</span>
	)
}

export const SHARED_CSS = `
@keyframes sw-rot { from { transform: translate(-50%, -50%) rotate(0deg) } to { transform: translate(-50%, -50%) rotate(360deg) } }
@keyframes sw-breathe { 0%, 100% { opacity: 0 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: reduce) { .sw-anim { animation: none !important; } }
`
