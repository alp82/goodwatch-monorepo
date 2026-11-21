// The page under the head. When the head folds or unfolds,
// everything under it glides to its new place (a transform, not a height that animates).
import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"
import { EASE } from "~/ui/browse/index"

export function Body({ children, className = "" }: { children: ReactNode; className?: string }) {
	const reduce = useReducedMotion()
	return (
		<motion.div
			layout={reduce ? false : "position"}
			transition={{ duration: 0.46, ease: EASE }}
			className={className}
		>
			{children}
		</motion.div>
	)
}
