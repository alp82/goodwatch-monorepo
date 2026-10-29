// PROTOTYPE (Discover lab, round 9): the footer's Show button. Without a search it's the real ShowTitlesButton. With a
// search it says matches, as titles d and g do: the search ranks at most 100 titles, so 100 reads "Show top 100
// matches" and fewer (filters can leave fewer) "Show N matches".
import { motion } from "framer-motion"
import type { FilterBarCounts } from "~/ui/filter-bar"
import { ShowTitlesButton } from "~/ui/filter-bar"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"

const SEARCH_CAP = 100

export function ShowButton({
	q,
	counts,
	onClick,
	className = "",
}: {
	q: string | null
	counts: FilterBarCounts | null
	onClick: () => void
	className?: string
}) {
	if (!q) return <ShowTitlesButton counts={counts} onClick={onClick} className={className} />
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
				"Show matches"
			) : n === 0 ? (
				"No titles match"
			) : n >= SEARCH_CAP ? (
				`Show top ${SEARCH_CAP} matches`
			) : (
				<>
					Show <RollingNumber value={n} /> {n === 1 ? "match" : "matches"}
				</>
			)}
		</motion.button>
	)
}
