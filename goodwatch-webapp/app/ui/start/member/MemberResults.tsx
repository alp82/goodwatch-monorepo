// A member's search results, in the card's fixed box in place of "this or that": two rows of whole posters (six on
// phones, ten from 640 px, twelve from 768 px, sixteen from 1024 px), as wide as the box's height holds (start.css,
// `.start-member-grid`). The search's reading shows in the bar. Back gives the box back to "this or that".
import { Link } from "@remix-run/react"
import { motion, useReducedMotion } from "framer-motion"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { countText } from "../moods/mood-counts"
import {
	type ResultsScope,
	START_CARDS,
	seeAllHref,
} from "../search/start-search"
import {
	type StartQuery,
	type StartResults,
	querySignature,
} from "../stage/start-query"

/** Which widths show a slot, by its place: two rows at every width. */
const slotShown = (i: number) =>
	i >= 12
		? "hidden lg:block"
		: i >= 10
			? "hidden md:block"
			: i >= 6
				? "hidden sm:block"
				: ""

const LINK =
	"inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-sm font-semibold outline-none focus-visible:outline-2 focus-visible:outline-amber-300"

export function MemberResults({
	query,
	results,
	scope,
	onBack,
	onRetry,
}: {
	query: Pick<StartQuery, "text" | "picks">
	results: StartResults
	/** The results' services scope (start-search.ts, `resultsScope`), the same as the mood picker's counts. */
	scope: ResultsScope
	onBack: () => void
	onRetry: () => void
}) {
	const reduce = useReducedMotion()
	const own = results.signature === querySignature(query)
	const ready = own && results.status === "ready"
	const failed = own && results.status === "error"
	const cards = ready ? results.cards.slice(0, START_CARDS) : []
	const line = failed
		? (results.error ?? "Couldn't load the results.")
		: ready
			? cards.length
				? results.total !== null
					? countText(results.total, scope)
					: "Results"
				: "Nothing matches this search."
			: "Searching…"
	return (
		<div className="start-member-box flex h-full flex-col pt-3">
			<div className="flex h-10 min-w-0 items-center gap-2">
				<h2
					className="min-w-0 flex-1 truncate text-sm text-gray-300"
					aria-live="polite"
				>
					{line}
				</h2>
				{failed ? (
					<button
						type="button"
						onClick={onRetry}
						className={`${LINK} cursor-pointer text-amber-400 hover:bg-amber-400/10 hover:text-amber-300`}
					>
						Try again
					</button>
				) : (
					<Link
						to={seeAllHref(query)}
						prefetch="intent"
						className={`${LINK} text-amber-400 hover:bg-amber-400/10 hover:text-amber-300`}
					>
						See all
					</Link>
				)}
				<button
					type="button"
					onClick={onBack}
					className={`${LINK} cursor-pointer text-gray-300 hover:bg-white/10 hover:text-white`}
				>
					Back
				</button>
			</div>
			<ul className="start-member-grid mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3 md:grid-cols-6 lg:grid-cols-8">
				{Array.from({ length: START_CARDS }, (_, i) => {
					const card = cards[i]
					return (
						<li
							// Slots keep their place; a card fills its slot when it arrives.
							key={card ? card.key : `slot${i}`}
							className={`min-w-0 ${slotShown(i)}`}
						>
							{card ? (
								<motion.div
									initial={reduce ? false : { opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{
										duration: 0.3,
										delay: Math.min(i, 11) * 0.03,
										ease: "easeOut",
									}}
								>
									<TitlePosterCard card={card} actions={false} />
								</motion.div>
							) : (
								<div
									className={`aspect-[2/3] rounded-lg border-2 border-gray-800 bg-gray-900 ${ready || failed ? "" : "animate-pulse"}`}
								/>
							)}
						</li>
					)
				})}
			</ul>
		</div>
	)
}
