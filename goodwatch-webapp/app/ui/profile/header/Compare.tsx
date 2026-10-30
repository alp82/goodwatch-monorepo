// How a signed-in visitor sees their match with the profile in the header: the percent and the tier in one chip next
// to the handle. It leads to the comparison at the top of the Taste tab (../compare-link.ts): on the Taste tab it opens
// the comparison in place and scrolls to it; from another tab it goes there with #compare, which opens it on arrival.
// Guests and the owner never see it.
import { Link, useLocation } from "@remix-run/react"
import type { MouseEvent } from "react"
import { tastePath } from "~/domain/member-paths"
import type { HeaderMatch } from "~/server/profile/header.server"
import { COMPARE_ID, requestCompare } from "../compare-link"

const plainClick = (event: MouseEvent) =>
	event.button === 0 &&
	!event.metaKey &&
	!event.ctrlKey &&
	!event.shiftKey &&
	!event.altKey

/** "84% · Like-minded" in a chip with a soft amber-to-violet wash and two linked rings. Phones show the percent only;
 * the link still names the tier. */
export function MatchChip({
	handle,
	match,
}: { handle: string; match: HeaderMatch }) {
	const { pathname } = useLocation()
	const taste = tastePath(handle)
	const here = pathname.replace(/\/$/, "").toLowerCase() === taste.toLowerCase()
	return (
		<Link
			to={`${taste}#${COMPARE_ID}`}
			prefetch="intent"
			onClick={(event) => {
				if (!here || !plainClick(event)) return
				event.preventDefault()
				requestCompare()
			}}
			aria-label={`${match.percent}% match with you, ${match.tier}`}
			className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-gray-950 bg-linear-to-r from-amber-400/20 to-violet-400/15 pr-2 pl-1.5 text-xs font-bold whitespace-nowrap text-amber-200 ring-1 ring-amber-300/35 transition-colors hover:from-amber-400/30 hover:to-violet-400/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-7 sm:pr-3"
			data-header-match="chip"
		>
			<svg aria-hidden="true" viewBox="0 0 24 16" className="h-4 w-6 shrink-0">
				<circle
					cx={8}
					cy={8}
					r={6}
					fill="none"
					stroke="#fcd34d"
					strokeWidth={1.6}
				/>
				<circle
					cx={16}
					cy={8}
					r={6}
					fill="none"
					stroke="#c4b5fd"
					strokeWidth={1.6}
				/>
			</svg>
			<b className="font-black text-amber-100 tabular-nums">{match.percent}%</b>
			<span aria-hidden className="text-amber-200/50 max-sm:hidden">
				·
			</span>
			<span className="max-sm:hidden">{match.tier}</span>
		</Link>
	)
}
