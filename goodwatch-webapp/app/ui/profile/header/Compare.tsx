// How a signed-in visitor sees their match with the profile in the header. Its home is the orbit's open pill
// (Pills.tsx), with a small percent tag on the orbit while it is closed; a profile without a fingerprint (no orbit to
// open) keeps the chip next to the handle. Every form leads to the comparison at the top of the Taste tab
// (../compare-link.ts): on the Taste tab it opens the comparison in place and scrolls to it; from another tab it goes
// there with #compare, which opens it on arrival. Guests and the owner never see it.
import { Link, useLocation } from "@remix-run/react"
import type { MouseEvent, ReactNode } from "react"
import { tastePath } from "~/domain/member-paths"
import { type MatchTier, matchTier } from "~/domain/profile-taste"
import type { HeaderMatch } from "~/server/profile/header.server"
import { COMPARE_ID, requestCompare } from "../compare-link"
import { matchColor, matchStrength } from "../match"

const plainClick = (event: MouseEvent) =>
	event.button === 0 &&
	!event.metaKey &&
	!event.ctrlKey &&
	!event.shiftKey &&
	!event.altKey

/** The match as the header shows it: the percent, its tier, color and strength. */
export interface MatchView {
	percent: number
	tier: MatchTier
	color: string
	/** 0..1 */
	strength: number
}

export function matchView(match: HeaderMatch | null): MatchView | null {
	if (!match) return null
	const percent = match.percent
	return {
		percent,
		tier: matchTier(percent),
		color: matchColor(percent),
		strength: matchStrength(percent),
	}
}

/** A link to the comparison on the Taste tab, opening it in place when already there. */
export function MatchLink({
	handle,
	view,
	className,
	style,
	children,
	tabIndex,
}: {
	handle: string
	view: MatchView
	className: string
	style?: React.CSSProperties
	children: ReactNode
	tabIndex?: number
}) {
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
			aria-label={`${view.percent}% match with you, ${view.tier}. Compare your tastes`}
			className={className}
			style={style}
			tabIndex={tabIndex}
			data-header-match="pill"
		>
			{children}
		</Link>
	)
}

/** "84% · Like-minded" in a chip with a soft amber-to-violet wash and two linked rings. Phones show the percent only;
 * the link still names the tier. For a profile without an orbit to open. */
export function MatchChip({
	handle,
	match,
}: { handle: string; match: HeaderMatch }) {
	const view = matchView(match)
	if (!view) return null
	return (
		<MatchLink
			handle={handle}
			view={view}
			className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-gray-950 bg-linear-to-r from-amber-400/20 to-violet-400/15 pr-2 pl-1.5 text-xs font-bold whitespace-nowrap text-amber-200 ring-1 ring-amber-300/35 transition-colors hover:from-amber-400/30 hover:to-violet-400/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-7 sm:pr-3"
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
			<b className="font-black text-amber-100 tabular-nums">{view.percent}%</b>
			<span aria-hidden className="text-amber-200/50 max-sm:hidden">
				·
			</span>
			<span className="max-sm:hidden">{view.tier}</span>
		</MatchLink>
	)
}

/** The closed hint: a small percent tag on the orbit's lower edge, in the match color. It hides while the pill is open,
 * where the badge takes over. Decorative: the orbit key's label names the match. */
export function OrbitMatchTag({
	view,
	open,
}: { view: MatchView; open: boolean }) {
	return (
		<span
			aria-hidden
			className={`pointer-events-none absolute -bottom-1 left-1/2 z-10 inline-flex h-5 -translate-x-1/2 items-center gap-1 rounded-full bg-gray-950 px-1.5 text-[11px] leading-none font-black whitespace-nowrap tabular-nums ring-1 transition-[opacity,transform] duration-300 ease-out sm:-bottom-0.5 sm:h-6 sm:px-2 sm:text-xs ${open ? "translate-y-1 opacity-0" : "opacity-100"}`}
			style={{
				color: view.color,
				boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${view.color} 55%, transparent)`,
			}}
			data-orbit-match
		>
			<span
				className="size-1.5 rounded-full"
				style={{ background: view.color }}
			/>
			{view.percent}%
		</span>
	)
}
