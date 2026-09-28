// Discover's motion between browsing and searching: text swaps nudge 10 px into place in 200 ms on a curve that
// overshoots a hair and settles on time. With reduced motion (MotionConfig reducedMotion="user"), only the opacity fades.
import {
	AnimatePresence,
	type Variants,
	motion,
	useReducedMotion,
} from "framer-motion"
import type { ReactNode } from "react"

/** Overshoots a hair and settles, so it reads as a spring but ends on time. */
export const EASE_SPRING: [number, number, number, number] = [
	0.3, 1.35, 0.55, 1,
]
/** Fast start, soft landing. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]
const EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1]

const NUDGE: Variants = {
	enter: { opacity: 0, y: 10 },
	center: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.2, ease: EASE_SPRING },
	},
	leave: { opacity: 0, y: -8, transition: { duration: 0.12, ease: EASE_IN } },
}
const FADE: Variants = {
	enter: { opacity: 0 },
	center: { opacity: 1, transition: { duration: 0.15 } },
	leave: { opacity: 0, transition: { duration: 0.1 } },
}

/** The nudge's variants, or a plain fade with reduced motion. */
export function useNudge(): Variants {
	return useReducedMotion() ? FADE : NUDGE
}

/**
 * Swaps its children when `k` changes: the new text nudges up into place while the old one leaves. The leaving copy
 * pops out of flow, so the slot takes the new size at once and nothing next to it moves twice.
 */
export function Swap({
	k,
	children,
	className = "",
	block = false,
	origin = "0% 50%",
}: {
	k: string
	children: ReactNode
	className?: string
	block?: boolean
	origin?: string
}) {
	const variants = useNudge()
	const Cell = block ? motion.div : motion.span
	const Outer = block ? "div" : "span"
	return (
		<Outer
			className={`relative ${block ? "block" : "inline-block"} ${className}`}
		>
			<AnimatePresence initial={false} mode="popLayout">
				<Cell
					key={k}
					variants={variants}
					initial="enter"
					animate="center"
					exit="leave"
					style={{ transformOrigin: origin }}
					className={
						block
							? "block min-w-0"
							: "inline-block min-w-0 max-w-full whitespace-nowrap"
					}
				>
					{children}
				</Cell>
			</AnimatePresence>
		</Outer>
	)
}
