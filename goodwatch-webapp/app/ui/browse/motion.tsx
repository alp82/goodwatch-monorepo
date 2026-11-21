// Motion helpers every Browse page shares: transform and opacity only, 60 fps,
// and nothing moves for a viewer who asked for reduced motion.
import { motion, useReducedMotion } from "framer-motion"
import { type ReactNode, useEffect, useRef } from "react"

/** The site's ease-out and a soft spring for things that land. */
export const EASE = [0.22, 1, 0.36, 1] as const
export const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 } as const
export const QUICK = { duration: 0.18, ease: EASE } as const
export const GLIDE = { duration: 0.42, ease: EASE } as const

/** The same curves for CSS: ease-out for things that arrive or react, ease-in-out for things that move across. */
export const EASE_CSS = "cubic-bezier(0.22, 1, 0.36, 1)"
export const EASE_IN_OUT_CSS = "cubic-bezier(0.65, 0, 0.35, 1)"
/**
 * Tailwind classes for state changes (one set of timings everywhere). QUICK_T for hover, press, select, and
 * light (160 ms); GLIDE_T for emphasis that shifts across a set, like dimming far cards (320 ms); MOVE_T for things that
 * travel, like a knob or a highlight sliding to a new place (380 ms, ease-in-out). Colors and filter are allowed for
 * small elements and for dimming; layout properties never animate. Tailwind 4 writes translate-*, rotate-* and scale-*
 * as their own CSS properties (not `transform`), so each list names them too (without them they jump).
 */
export const QUICK_T =
	"transition-[transform,translate,rotate,scale,opacity,background-color,border-color,color,box-shadow,filter] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
export const GLIDE_T =
	"transition-[transform,translate,rotate,scale,opacity,background-color,border-color,color,box-shadow,filter] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
export const MOVE_T =
	"transition-[transform,translate,rotate,scale,opacity] duration-[380ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"

/** Classes for a card that lifts a little on hover and press (transform only). */
export const LIFT =
	"transition-transform duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
/** Classes for the keyboard focus ring on a link or button. */
export const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

/**
 * Fades and rises into place the first time it scrolls into view. The server's HTML is fully visible (nothing is hidden
 * without JavaScript); after hydration, parts still below the fold wait for their entrance.
 */
export function Reveal({
	children,
	delay = 0,
	className = "",
	as: Tag = "div",
}: {
	children: ReactNode
	delay?: number
	className?: string
	as?: "div" | "section" | "li"
}) {
	const ref = useRef<HTMLElement>(null)
	useEffect(() => {
		const el = ref.current
		if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return
		el.style.opacity = "0"
		const io = new IntersectionObserver(
			(entries) => {
				if (!entries.some((e) => e.isIntersecting)) return
				io.disconnect()
				el.style.opacity = ""
				el.animate(
					[
						{ opacity: 0, transform: "translateY(14px)" },
						{ opacity: 1, transform: "none" },
					],
					{
						duration: 420,
						delay: delay * 1000,
						easing: "cubic-bezier(0.22, 1, 0.36, 1)",
						fill: "backwards",
					},
				)
			},
			{ rootMargin: "0px 0px -8% 0px" },
		)
		io.observe(el)
		return () => {
			io.disconnect()
			el.style.opacity = ""
		}
	}, [delay])
	const Any = Tag as "div"
	return (
		<Any ref={ref as never} className={className}>
			{children}
		</Any>
	)
}

/**
 * A list whose items glide to their new places when their order changes (give every child a stable `key` and wrap each
 * in `<FlipItem>`).
 */
export function FlipItem({
	id,
	children,
	className = "",
}: {
	id: string | number
	children: ReactNode
	className?: string
}) {
	const reduce = useReducedMotion()
	return (
		<motion.div
			layout={reduce ? false : "position"}
			layoutId={undefined}
			key={id}
			transition={SPRING}
			className={className}
		>
			{children}
		</motion.div>
	)
}

export { motion, useReducedMotion }
