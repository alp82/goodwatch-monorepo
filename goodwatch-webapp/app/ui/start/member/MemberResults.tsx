// A member's search results, in the card's fixed box in place of "this or that": two rows of whole posters (six on
// phones, ten from 640 px, twelve from 768 px, sixteen from 1024 px), as wide as the box's height holds (start.css,
// `.start-member-grid`; from 1024 px they grow with the card). The search's reading shows in the bar. Back gives the
// box back to "this or that"; See all, the main action, opens the whole list on Discover. The posters are the site's
// poster cards with the standard actions, as on Discover: a panel on hover, tiles after the first tap on a touch
// screen (Open and Actions on a phone's three across, under 7.5rem), a click opens the title page.
import { ArrowRightIcon } from "@heroicons/react/20/solid"
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
/** The box's main action: a filled amber button. */
const ACTION =
	"inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-amber-400 px-4 text-sm font-bold text-gray-950 shadow-md shadow-black/30 outline-none hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"

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
				<button
					type="button"
					onClick={onBack}
					className={`${LINK} cursor-pointer text-gray-300 hover:bg-white/10 hover:text-white`}
				>
					Back
				</button>
				{failed ? (
					<button type="button" onClick={onRetry} className={ACTION}>
						Try again
					</button>
				) : (
					<Link to={seeAllHref(query)} prefetch="intent" className={ACTION}>
						See all
						<ArrowRightIcon className="h-4 w-4" aria-hidden />
					</Link>
				)}
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
									<TitlePosterCard card={card} />
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
