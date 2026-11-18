// The live "Show N titles" button that closes a filter sheet. Its own module, so pages that only need the button
// don't load the Filters sheet.
import { motion } from "framer-motion"
import { primaryButtonClass } from "~/ui/button/PrimaryButton"
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
			className={`flex h-12 items-center justify-center gap-1.5 px-6 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white ${
				n === 0 ? "rounded-full bg-gray-800 font-bold text-white" : primaryButtonClass()
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
