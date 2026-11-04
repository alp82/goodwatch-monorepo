// A show's status beside the age rating in the title page's header: the age box's size and ground (AgeRating.tsx), a
// dot in the status's colour and one word (show-status.ts). A running show (Returning, In production) has a green dot
// that pulses (a ring that grows and fades: transform and opacity only, none with reduced motion); Planned and Pilot
// are amber, Ended muted, Canceled red.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { type ShowStatusTone, showStatusOf } from "./show-status"

const DOT: Record<ShowStatusTone, string> = {
	live: "bg-emerald-400",
	soon: "bg-amber-300",
	over: "bg-gray-400",
	cut: "bg-rose-400",
}
const WORD: Record<ShowStatusTone, string> = {
	live: "text-emerald-200",
	soon: "text-amber-200",
	over: "text-gray-300",
	cut: "text-rose-200",
}

export function ShowStatus({ media }: { media: MovieResult | ShowResult }) {
	const status = showStatusOf(media)
	if (!status) return null
	return (
		<span
			title={status.says}
			className={`inline-flex items-center gap-1.5 rounded-sm bg-gray-700/50 px-1.5 py-0.5 text-[80%] font-medium ${WORD[status.tone]}`}
		>
			<span
				aria-hidden="true"
				className="relative -top-[0.07em] flex size-1.5 shrink-0"
			>
				{status.tone === "live" && (
					<span
						className={`absolute inset-0 animate-ping rounded-full opacity-75 [animation-duration:2s] motion-reduce:hidden ${DOT[status.tone]}`}
					/>
				)}
				<span
					className={`relative size-1.5 rounded-full ${DOT[status.tone]}`}
				/>
			</span>
			{status.word}
		</span>
	)
}
