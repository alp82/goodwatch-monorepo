// Variant 1 (round 14 placeholder until a builder designs it): round 13's look, the match card with its foot row and
// the panels under it.
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { MatchCard, Meet } from "./parts"
import type { TwinsProps } from "./types"

export default function TwinsV1({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	return (
		<motion.div ref={topRef} layout={still ? false : "position"} className="relative flex flex-col gap-4">
			<MatchCard shell={shell} compare={compare}>
				<button
					type="button"
					aria-expanded={open}
					aria-controls={sectionId}
					onClick={toggle}
					className="group flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-b-[23px] px-5 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white sm:px-6"
					data-compare-row
				>
					<span className="min-w-0 flex-1">
						<span className="block text-sm font-bold text-gray-100 group-hover:text-white sm:text-base">{label}</span>
						<span className="block text-xs text-gray-500">Overlap, splits, and picks for each other</span>
					</span>
					<ChevronDownIcon className={`size-5 shrink-0 text-gray-400 transition-transform duration-200 group-hover:text-white ${open ? "rotate-180" : ""}`} aria-hidden />
				</button>
			</MatchCard>
			<AnimatePresence initial={false} mode="popLayout">
				{open && (
					<motion.section
						key="meet"
						id={sectionId}
						aria-label={label}
						className="flex flex-col gap-4"
						initial={{ opacity: 0, y: still ? 0 : -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: still ? 0 : -10 }}
						transition={{ duration: still ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
					>
						<Meet handle={shell.handle} c={compare} />
					</motion.section>
				)}
			</AnimatePresence>
		</motion.div>
	)
}
