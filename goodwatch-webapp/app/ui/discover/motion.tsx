// Discover's motion between browsing and searching: the explanation's text nudges 10 px into place in 200 ms on a curve
// that overshoots a hair and settles on time. With reduced motion (MotionConfig reducedMotion="user"), only the opacity
// fades.
import { type Variants, useReducedMotion } from "framer-motion"

/** Overshoots a hair and settles, so it reads as a spring but ends on time. */
const EASE_SPRING: [number, number, number, number] = [0.3, 1.35, 0.55, 1]
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
