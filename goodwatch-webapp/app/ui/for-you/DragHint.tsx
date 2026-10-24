// The wordless drag hint on the big print: a ghost fingertip lands on one handle, drags it outward and lets it go
// back, twice, then fades (transform and opacity only). It plays once per change of `play` and never loops.
import { motion } from "framer-motion"
import { useEffect, useState } from "react"

type Run = { key: number; x: number; y: number; dx: number; dy: number }

/** Plays once per change of `play` (> 0) over the print inside `host`. */
export function DragHint({
	host,
	play,
}: { host: React.RefObject<HTMLElement>; play: number }) {
	const [run, setRun] = useState<Run | null>(null)
	useEffect(() => {
		if (!play) return
		const box = host.current
		if (!box) return
		const t = window.setTimeout(() => {
			const hb = box.getBoundingClientRect()
			const cx = hb.left + hb.width / 2
			const cy = hb.top + hb.height / 2
			// A handle at its usual ring, preferring one on the right (where a thumb would grab).
			const usual = [
				...box.querySelectorAll<HTMLElement>(
					'[data-print-handle][aria-valuenow="0"]',
				),
			]
			const all = usual.length
				? usual
				: [...box.querySelectorAll<HTMLElement>("[data-print-handle]")]
			let best: { x: number; y: number } | null = null
			for (const h of all) {
				const b = h.getBoundingClientRect()
				const p = { x: b.left + b.width / 2, y: b.top + b.height / 2 }
				if (!best || p.x > best.x) best = p
			}
			if (!best) return
			const vx = best.x - cx
			const vy = best.y - cy
			const len = Math.hypot(vx, vy) || 1
			const reach = Math.min(64, hb.width * 0.17)
			setRun({
				key: play,
				x: best.x - hb.left,
				y: best.y - hb.top,
				dx: (vx / len) * reach,
				dy: (vy / len) * reach,
			})
		}, 450)
		return () => window.clearTimeout(t)
	}, [play, host])
	if (!run) return null
	const { dx, dy } = run
	return (
		<motion.span
			key={run.key}
			aria-hidden="true"
			data-drag-hint=""
			className="pointer-events-none absolute z-20 size-10 rounded-full bg-white/40"
			style={{
				left: run.x - 20,
				top: run.y - 20,
				boxShadow:
					"0 0 0 2px rgba(255,255,255,.75), 0 0 0 8px rgba(255,255,255,.12), 0 8px 18px rgba(0,0,0,.45)",
			}}
			initial={{ opacity: 0, scale: 1.3, x: 0, y: 0 }}
			animate={{
				opacity: [0, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 0],
				scale: [1.3, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 1.2],
				x: [0, 0, dx, 0, 0, dx, 0, 0],
				y: [0, 0, dy, 0, 0, dy, 0, 0],
			}}
			transition={{
				duration: 3.4,
				ease: "easeInOut",
				times: [0, 0.1, 0.32, 0.46, 0.54, 0.76, 0.9, 1],
			}}
			onAnimationComplete={() => setRun(null)}
		/>
	)
}
