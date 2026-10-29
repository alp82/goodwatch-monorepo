// Parts the start page's guest card shares between its states (SpotlightCard.tsx, TapThreePanel.tsx) and the ledge
// (ledge/StartLedge.tsx): the headings, the die of Surprise me, See all, and the poster that is a loved toggle.
import { HeartIcon, InformationCircleIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { TitleCard } from "~/server/title-cards.server"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { titlePath } from "~/utils/helpers"

/** The card's heading per step. */
export const TAP_THREE = "Tap three you loved"
export const FOR_YOU = "For you"

/** A die showing five, for Surprise me. */
export function DieIcon({ className = "" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 20 20"
			className={className}
			aria-hidden="true"
			fill="none"
		>
			<rect
				x="2.5"
				y="2.5"
				width="15"
				height="15"
				rx="3.5"
				stroke="currentColor"
				strokeWidth="1.7"
			/>
			{[
				[6.6, 6.6],
				[13.4, 6.6],
				[10, 10],
				[6.6, 13.4],
				[13.4, 13.4],
			].map(([cx, cy]) => (
				<circle
					key={`${cx}-${cy}`}
					cx={cx}
					cy={cy}
					r="1.35"
					fill="currentColor"
				/>
			))}
		</svg>
	)
}

/** See all: Discover with the search's text and the picks. */
export function SeeAll({
	href,
	className = "",
}: { href: string; className?: string }) {
	return (
		<Link
			to={href}
			prefetch="intent"
			className={`inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300 sm:px-3 ${className}`}
		>
			See all<span aria-hidden>&nbsp;→</span>
		</Link>
	)
}

/**
 * A real poster card that is itself the "loved it" toggle: a tap rings it, pops a heart and lifts it; a second tap
 * undoes. The small info button opens the title page (shown on hover with a pointer, always on touch).
 */
export function LovedToggle({
	card,
	on,
	full,
	onToggle,
	priority,
}: {
	card: TitleCard
	on: boolean
	/** Three are loved: the others can't be tapped. */
	full: boolean
	onToggle: () => void
	priority?: boolean
}) {
	const off = full && !on
	return (
		<div
			className="loved-toggle relative w-full"
			{...(on ? { "data-on": "" } : {})}
			{...(off ? { "data-off": "" } : {})}
		>
			<div className="loved-lift">
				<TitlePosterCard
					card={card}
					actions={false}
					posterPriority={priority ? "high" : undefined}
				/>
				<button
					type="button"
					className="loved-tap"
					aria-pressed={on}
					disabled={off}
					aria-label={`Loved ${card.title}`}
					onClick={onToggle}
				/>
				<span className="loved-ring" aria-hidden />
				<span className="loved-badge" aria-hidden>
					<HeartIcon className="h-4 w-4" />
				</span>
				<Link
					to={titlePath(card.media_type, card.tmdb_id, card.title)}
					prefetch="none"
					aria-label={`Open ${card.title}`}
					className="loved-info absolute top-1 left-1 z-[31] flex h-7 w-7 items-center justify-center rounded-full bg-gray-950/80 text-gray-100 ring-1 ring-white/25 outline-none hover:bg-gray-900 hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400 sm:h-8 sm:w-8"
				>
					<InformationCircleIcon className="h-5 w-5" aria-hidden />
				</Link>
			</div>
		</div>
	)
}
