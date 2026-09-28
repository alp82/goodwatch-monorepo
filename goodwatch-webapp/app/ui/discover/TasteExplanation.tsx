// The explanation at the top right of Discover. Browsing with For you on: what the person's taste leans to, as small
// chips in the fingerprint's colors; without enough liked titles, a nudge to rate a few more. Searching: "Read as" and
// how the search read the query, as chips, in the same slot. Guests with taste also get the sign-up prompt to keep it.
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { SEARCH_MAX_MOVE } from "~/domain/for-you"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { ForYouStatus } from "~/server/discover-results.server"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { ReasonChips } from "~/ui/title-card/ReasonChips"
import { ReadAsChips, readAsChips } from "./ReadAsChips"
import { useNudge } from "./motion"

/** Where "Rate titles" goes: the taste quiz, picking up where the person left off. */
export const RATE_TITLES_PATH = "/taste/quiz?resume=1"

/** The search's side of the explanation. */
export interface SearchExplanation {
	/** The query, which keys the swap. */
	q: string
	/** The reading's chips; null until the reading arrives, empty when the basic search served. */
	reading: ReadingChip[] | null
	/** For you is moving results (at most SEARCH_MAX_MOVE places). */
	forYou: boolean
}

export function TasteExplanation({
	status,
	on,
	leanings,
	ratings,
	guest,
	search = null,
	className = "",
}: {
	status: ForYouStatus
	on: boolean
	leanings: string[]
	ratings: number
	guest: boolean
	/** Set while searching: "Read as" replaces the taste. */
	search?: SearchExplanation | null
	className?: string
}) {
	const view = search
		? `read:${search.q}:${search.reading ? "chips" : "pending"}`
		: status === "needsTaste"
			? "rate"
			: on && leanings.length
				? "taste"
				: null
	const nudge = useNudge()
	return (
		<div className={`lg:min-h-7 ${className}`}>
			<AnimatePresence mode="popLayout" initial={false}>
				{view && (
					<motion.div
						key={view}
						variants={nudge}
						initial="enter"
						animate="center"
						exit="leave"
						className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-gray-400 sm:text-sm"
						aria-live={search ? "polite" : undefined}
					>
						<FingerPrintIcon
							className="h-4 w-4 shrink-0 text-amber-500"
							aria-hidden
						/>
						{search ? (
							<SearchLine search={search} />
						) : view === "taste" ? (
							<>
								<span>Your taste leans to</span>
								<ReasonChips reasons={leanings} />
								<span className="text-gray-500">
									from {ratings.toLocaleString("en")} ratings
								</span>
							</>
						) : (
							<>
								<span>Rate a few more titles you love</span>
								<Link
									to={RATE_TITLES_PATH}
									className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/25"
								>
									Rate titles
								</Link>
							</>
						)}
					</motion.div>
				)}
			</AnimatePresence>
			{guest && !search && status !== "signUp" && (
				<SignUpPrompt
					feature="forYou"
					stage="keep"
					size="inline"
					className="mt-1 !min-h-0 text-xs sm:text-sm"
				/>
			)}
		</div>
	)
}

function SearchLine({ search }: { search: SearchExplanation }) {
	if (!search.reading)
		return (
			<span className="animate-pulse motion-reduce:animate-none">
				Reading your search…
			</span>
		)
	if (!readAsChips(search.reading).length)
		return <span>Matched by titles and descriptions</span>
	return (
		<>
			<span>Read as</span>
			<ReadAsChips reading={search.reading} />
			{search.forYou && (
				<span className="text-gray-500">
					taste moves results {SEARCH_MAX_MOVE} places at most
				</span>
			)}
		</>
	)
}
