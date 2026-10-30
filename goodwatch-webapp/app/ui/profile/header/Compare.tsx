// How a signed-in visitor sees their match with the profile in the header: the percent and the tier in one chip that
// links to the comparison at the top of the Taste tab. Guests and the owner never see it.
// PROTOTYPE OPTIONS (member nav, round 12): where the header puts the chip (nav-options.ts `chip`, Layouts.tsx).
import { Link } from "@remix-run/react"
import { tastePath } from "~/domain/member-paths"
import type { HeaderMatch } from "~/server/profile/header.server"

/**
 * "84% · Like-minded" in a chip with a soft amber-to-violet wash and two linked rings. `short` leaves out the tier
 * where the chip has little room: on phones, or everywhere (the badge on the orbit); the link still names it. `small`
 * keeps the phone height on every width.
 */
export function MatchChip({
	handle,
	match,
	short = "never",
	small = false,
	className = "",
}: {
	handle: string
	match: HeaderMatch
	short?: "never" | "phone" | "always"
	small?: boolean
	className?: string
}) {
	const tier =
		short === "always" ? "hidden" : short === "phone" ? "max-sm:hidden" : ""
	return (
		<Link
			to={`${tastePath(handle)}#compare`}
			prefetch="intent"
			aria-label={`${match.percent}% match with you, ${match.tier}`}
			className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-gray-950 bg-linear-to-r from-amber-400/20 to-violet-400/15 pl-1.5 text-xs font-bold whitespace-nowrap text-amber-200 ring-1 ring-amber-300/35 transition-colors hover:from-amber-400/30 hover:to-violet-400/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${small ? "" : "sm:h-7"} ${short === "always" ? "pr-2" : "pr-2 sm:pr-3"} ${className}`}
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
			<b className="font-black text-amber-100 tabular-nums">
				{match.percent}%
			</b>
			<span aria-hidden className={`text-amber-200/50 ${tier}`}>
				·
			</span>
			<span className={tier}>{match.tier}</span>
		</Link>
	)
}
