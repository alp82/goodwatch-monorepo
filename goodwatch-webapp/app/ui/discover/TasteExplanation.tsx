// The explanation at the top right of Discover: with For you on, what the person's taste leans to as small chips in
// the fingerprint's colors; without enough liked titles, a nudge to rate a few more. Guests with taste also get the
// sign-up prompt to keep it.
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import type { ForYouStatus } from "~/server/discover-results.server"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { ReasonChips } from "~/ui/title-card/ReasonChips"

/** Where "Rate titles" goes: the taste quiz, picking up where the person left off. */
export const RATE_TITLES_PATH = "/taste/quiz?resume=1"

export function TasteExplanation({
	status,
	on,
	leanings,
	ratings,
	guest,
	className = "",
}: {
	status: ForYouStatus
	on: boolean
	leanings: string[]
	ratings: number
	guest: boolean
	className?: string
}) {
	const view =
		status === "needsTaste" ? "rate" : on && leanings.length ? "taste" : null
	return (
		<div className={`lg:min-h-7 ${className}`}>
			<AnimatePresence mode="popLayout" initial={false}>
				{view && (
					<motion.div
						key={view}
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
						className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-gray-400 sm:text-sm"
					>
						<FingerPrintIcon
							className="h-4 w-4 shrink-0 text-amber-500"
							aria-hidden
						/>
						{view === "taste" ? (
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
			{guest && status !== "signUp" && (
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
