// The live "Show N titles" button that closes a filter sheet. Its own module, so pages that only need the button
// don't load the Filters sheet.
import { motion } from "framer-motion"
import { RollingNumber, TAP } from "./motion"
import type { FilterBarCounts } from "./types"

/** "Show N titles", counting as the state changes; it closes the sheet. */
export function ShowTitlesButton({
	counts,
	onClick,
	className = "",
}: {
	counts: FilterBarCounts | null
	onClick: () => void
	className?: string
}) {
	const n = counts?.total ?? null
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onClick}
			className={`flex h-12 items-center justify-center gap-1.5 rounded-xl px-6 font-bold text-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white ${
				n === 0
					? "bg-gray-800"
					: "bg-linear-to-b from-amber-500 to-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_10px_30px_-10px_rgba(217,119,6,.7)]"
			} ${className}`}
		>
			{n === null ? (
				"Show titles"
			) : n === 0 ? (
				"No titles match"
			) : (
				<>
					Show <RollingNumber value={n} /> {n === 1 ? "title" : "titles"}
				</>
			)}
		</motion.button>
	)
}
