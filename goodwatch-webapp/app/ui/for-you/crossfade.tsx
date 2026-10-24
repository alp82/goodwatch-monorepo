// The crossfade between titles in the detail, and the one dim every drawer and the pop-out card share.
// - Crossfade: the content as stacked layers in one grid cell. On a step the old layer and the new one are in the same
//   frames: the old fades out drifting 6 px away (from wherever the finger left it), the new fades in from 6 px the
//   other side, so there is never an empty frame. Opacity and transform only. The current layer follows the swipe
//   (cx / co); a leaving layer keeps its last offset.
// - DIM: the backdrop behind the title card, the title drawer and the recipe and print drawers (opacity only, no blur).
import {
	AnimatePresence,
	type MotionValue,
	motion,
	useIsPresent,
	useMotionValue,
} from "framer-motion"
import { useEffect, useLayoutEffect } from "react"

export const EASE_OUT = [0.22, 1, 0.36, 1] as const
export const DIM = "bg-black/70"
export const DIM_IN = { duration: 0.24, ease: EASE_OUT } as const
export const DIM_OUT = { duration: 0.2, ease: [0.4, 0, 0.6, 1] } as const
/** The drawers' motion (the recipe and print drawers, and the title drawer), so all three move alike. */
export const SHEET_IN = { type: "spring", stiffness: 330, damping: 34 } as const
export const SHEET_OUT = { duration: 0.28, ease: [0.4, 0, 0.9, 0.6] } as const

const DRIFT = 6
const FADE = { duration: 0.26, ease: EASE_OUT } as const

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect

const steps = {
	enter: (d: number) => ({ opacity: 0, x: d * DRIFT, scale: 0.996 }),
	in: { opacity: 1, x: 0, scale: 1 },
	exit: (d: number) => ({ opacity: 0, x: -d * DRIFT, scale: 0.996 }),
}

/** Crossfades its children whenever `k` changes; `dir` is the step's direction (1 next, -1 previous). */
export function Crossfade({
	k,
	dir,
	cx,
	co,
	className = "",
	children,
}: {
	k: string
	dir: -1 | 1
	cx: MotionValue<number>
	co: MotionValue<number>
	className?: string
	children: React.ReactNode
}) {
	return (
		<div
			className={`grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] ${className}`}
		>
			<AnimatePresence initial={false} custom={dir}>
				<Layer key={k} dir={dir} cx={cx} co={co}>
					{children}
				</Layer>
			</AnimatePresence>
		</div>
	)
}

function Layer({
	dir,
	cx,
	co,
	children,
}: {
	dir: -1 | 1
	cx: MotionValue<number>
	co: MotionValue<number>
	children: React.ReactNode
}) {
	const present = useIsPresent()
	const lx = useMotionValue(cx.get())
	const lo = useMotionValue(co.get())
	// Layout effect: copy the swipe before the page resets cx / co for the new layer.
	useIso(() => {
		if (!present) return
		lx.set(cx.get())
		lo.set(co.get())
		const a = cx.on("change", (v) => lx.set(v))
		const b = co.on("change", (v) => lo.set(v))
		return () => {
			a()
			b()
		}
	}, [present, cx, co, lx, lo])
	return (
		<motion.div
			custom={dir}
			variants={steps}
			initial="enter"
			animate="in"
			exit="exit"
			transition={FADE}
			className="flex min-h-0 min-w-0 flex-col"
			style={{
				gridArea: "1 / 1",
				pointerEvents: present ? undefined : "none",
				zIndex: present ? 1 : 0,
			}}
			aria-hidden={present ? undefined : true}
		>
			<motion.div
				style={{ x: lx, opacity: lo }}
				className="flex min-h-0 flex-1 flex-col"
			>
				{children}
			</motion.div>
		</motion.div>
	)
}
