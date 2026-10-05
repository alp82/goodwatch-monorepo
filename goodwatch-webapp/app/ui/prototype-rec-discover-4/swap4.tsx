// PROTOTYPE - throwaway. #179 round 4: the motion language of each variant. A variant is one `Feel`: how a piece of
// text swaps (heading, explanation line, tooltip, count line) and how the search plate morphs. Every swap is keyed
// and runs 120-240 ms. `dir` is +1 going into a
// search (or to another query) and -1 going back to browsing, for the variants with a direction.
import { AnimatePresence, type Transition, type Variants, animate, motion, useMotionValue, useTransform } from "framer-motion"
import { type ReactNode, createContext, useContext, useEffect, useRef } from "react"

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1] // expo-ish ease-out: fast start, soft landing
export const EASE_IN: [number, number, number, number] = [0.4, 0, 1, 1]
// A tween that overshoots a hair and settles, so it reads as a spring but ends on time (springs have long tails).
export const EASE_SPRING: [number, number, number, number] = [0.3, 1.35, 0.55, 1]

export type Feel = {
	swap: Variants // enter / center / leave, each may be a function of dir
	clip?: boolean // clip the swap cell (rolling text)
	plate: Transition // the field plate morph
}

const LEAVE = { duration: 0.12, ease: EASE_IN }

export const FEELS = {
	// Cross-fade with a slight scale. Every duration below is the whole animation; nothing trails.
	fade: {
		swap: {
			enter: { opacity: 0, scale: 0.96 },
			center: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE_OUT } },
			leave: { opacity: 0, scale: 1.02, transition: LEAVE },
		},
		plate: { duration: 0.22, ease: EASE_OUT },
	},
	// A short vertical nudge on a spring-like curve.
	nudge: {
		swap: {
			enter: { opacity: 0, y: 10 },
			center: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_SPRING } },
			leave: { opacity: 0, y: -8, transition: LEAVE },
		},
		plate: { duration: 0.24, ease: EASE_SPRING },
	},
	// Blur resolves into focus.
	focus: {
		swap: {
			enter: { opacity: 0, filter: "blur(6px)" },
			center: { opacity: 1, filter: "blur(0px)", transition: { duration: 0.18, ease: EASE_OUT } },
			leave: { opacity: 0, filter: "blur(4px)", transition: LEAVE },
		},
		plate: { duration: 0.2, ease: EASE_OUT },
	},
	// Sideways, in the direction of travel: forward into a search, back out of it.
	slide: {
		swap: {
			enter: (dir: number) => ({ opacity: 0, x: 22 * dir }),
			center: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE_OUT } },
			leave: (dir: number) => ({ opacity: 0, x: -22 * dir, transition: LEAVE }),
		},
		plate: { duration: 0.22, ease: EASE_OUT },
	},
	// An odometer: old text rolls up and out, new text rolls up and in.
	roll: {
		swap: {
			enter: (dir: number) => ({ y: dir > 0 ? "105%" : "-105%" }),
			center: { y: "0%", transition: { duration: 0.24, ease: EASE_OUT } },
			leave: (dir: number) => ({ y: dir > 0 ? "-105%" : "105%", transition: { duration: 0.24, ease: EASE_OUT } }),
		},
		clip: true,
		plate: { duration: 0.24, ease: EASE_SPRING },
	},
} satisfies Record<string, Feel>

const Ctx = createContext<{ feel: Feel; dir: number }>({ feel: FEELS.fade, dir: 1 })

export function FeelProvider({ feel, dir, children }: { feel: Feel; dir: number; children: ReactNode }) {
	return <Ctx.Provider value={{ feel, dir }}>{children}</Ctx.Provider>
}

export const useFeel = () => useContext(Ctx)

// Swaps its children when `k` changes, in the variant's feel. The leaving copy pops out of flow (absolute), so the
// slot takes the new size at once and nothing next to it has to move twice.
export function Swap({ k, children, className = "", block = false, origin = "0% 50%" }: { k: string; children: ReactNode; className?: string; block?: boolean; origin?: string }) {
	const { feel, dir } = useFeel()
	const Cell = block ? motion.div : motion.span
	const Outer = block ? "div" : "span"
	return (
		<Outer className={`relative ${block ? "block" : "inline-block"} ${feel.clip ? "overflow-hidden" : ""} ${className}`}>
			<AnimatePresence initial={false} mode="popLayout" custom={dir}>
				<Cell key={k} custom={dir} variants={feel.swap} initial="enter" animate="center" exit="leave" style={{ transformOrigin: origin }} className={block ? "block min-w-0" : "inline-block min-w-0 max-w-full whitespace-nowrap"}>
					{children}
				</Cell>
			</AnimatePresence>
		</Outer>
	)
}

// A number that counts from its last value to the new one in 220 ms (the `roll` variant's count line).
export function Tick({ value, className = "" }: { value: number; className?: string }) {
	const mv = useMotionValue(value)
	const text = useTransform(mv, (v) => Math.round(v).toLocaleString("en"))
	const first = useRef(true)
	useEffect(() => {
		if (first.current) {
			first.current = false
			return
		}
		const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
		if (reduce) return void mv.set(value)
		const c = animate(mv, value, { duration: 0.22, ease: EASE_OUT })
		return () => c.stop()
	}, [value, mv])
	return <motion.span className={`tabular-nums ${className}`}>{text}</motion.span>
}
