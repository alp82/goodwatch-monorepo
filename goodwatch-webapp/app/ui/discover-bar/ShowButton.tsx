// The panel closes onto the matches already counted; candidate-set totals are labelled approximate.
import { motion } from "framer-motion"
import { ShowTitlesButton } from "~/ui/filter-bar/ShowTitlesButton"
import { primaryButtonClass } from "~/ui/button/PrimaryButton"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import { countWords } from "./chips"

export function ShowButton({
	searching,
	counts,
	onClick,
	className = "",
}: {
	searching: boolean
	counts: FilterBarCounts | null
	onClick: () => void
	className?: string
}) {
	if (!searching)
		return <ShowTitlesButton counts={counts} onClick={onClick} className={className} />
	const { n, words, about } = countWords(counts?.total, true, counts?.searchEstimate)
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
				"Show matches"
			) : n === 0 ? (
				"No titles match"
			) : about ? (
				`Show about ${n.toLocaleString("en")} matches`
			) : (
				<>
					Show <RollingNumber value={n} /> {words}
				</>
			)}
		</motion.button>
	)
}
