import { AnimatePresence, motion } from "framer-motion"
import React, { type ReactNode } from "react"

interface AppearParams {
	isVisible: boolean
	children: ReactNode
}

export default function Appear({ isVisible, children }: AppearParams) {
	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					initial={{ opacity: 0, height: 0, y: -20 }}
					animate={{ opacity: 1, height: "auto", y: 0 }}
					exit={{ opacity: 0, height: 0, y: -20 }}
					style={{ overflow: "hidden" }}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	)
}
