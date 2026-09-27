import { AnimatePresence, motion } from "framer-motion"

// The bar's motion: a quick spring for things that move, a press scale for controls, and a short tween for the
// hidden meter so it settles with the counts instead of trailing them.
export const SPRING = {
	type: "spring",
	stiffness: 520,
	damping: 34,
	mass: 0.7,
} as const
export const TAP = { scale: 0.94 }
export const METER_TRANSITION = {
	duration: 0.24,
	ease: [0.22, 1, 0.36, 1],
} as const

// Surfaces shared by the controls, popovers, and menus.
export const SHELL =
	"rounded-2xl bg-white/[0.04] ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
export const MENU =
	"rounded-2xl bg-gray-900/95 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.06)] text-gray-200"

/** A number whose digits roll when it changes. Tabular, so its width doesn't jump. */
export function RollingNumber({
	value,
	className = "",
}: {
	value: number
	className?: string
}) {
	return (
		<span
			className={`relative inline-flex overflow-hidden tabular-nums ${className}`}
		>
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.span
					key={value}
					initial={{ y: "70%", opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					exit={{ y: "-70%", opacity: 0 }}
					transition={SPRING}
				>
					{value.toLocaleString("en")}
				</motion.span>
			</AnimatePresence>
		</span>
	)
}

/** A switch track with its knob. Amber by default; pass `onClass` for another lit color. */
export function Knob({
	on,
	size = "md",
	onClass = "bg-amber-500 shadow-[0_0_14px_rgba(245,158,11,.55)]",
}: {
	on: boolean
	size?: "md" | "lg"
	onClass?: string
}) {
	const s =
		size === "lg"
			? {
					track: "h-7 w-12",
					knob: "h-5 w-5 top-1",
					right: "right-1",
					left: "left-1",
				}
			: {
					track: "h-5 w-9",
					knob: "h-4 w-4 top-0.5",
					right: "right-0.5",
					left: "left-0.5",
				}
	return (
		<span
			aria-hidden
			className={`relative inline-block shrink-0 rounded-full transition-colors duration-200 ${s.track} ${on ? onClass : "bg-white/15"}`}
		>
			<motion.span
				layout
				transition={SPRING}
				className={`absolute rounded-full shadow ${s.knob} ${on ? `${s.right} bg-white` : `${s.left} bg-gray-300`}`}
			/>
		</span>
	)
}
