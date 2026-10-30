// OPTION seen=chip: one chip row per Watch tab. The to-watch chips, a thin divider, then Seen with an eye and its count.
// The row is the same on every view of the tab, Seen included, so it never jumps. It wraps on a phone and never scrolls
// sideways. The chip look is ChipRow's (ui/navigation/AreaTabs.tsx).
import { EyeIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { NavChoice } from "~/ui/navigation/areas"
import type { WatchViews } from "./watch-views"

const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
const count = (n: number) => n.toLocaleString("en-US")

function Chip({ choice, icon }: { choice: NavChoice; icon?: boolean }) {
	const on = choice.here
	return (
		<Link
			to={choice.href}
			replace
			preventScrollReset
			prefetch="intent"
			aria-current={on ? "page" : undefined}
			data-view={choice.key}
			className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold ring-1 ${
				on
					? "bg-amber-400/15 text-amber-100 ring-amber-400/50"
					: "bg-white/[0.04] text-gray-300 ring-white/10 hover:bg-white/[0.08]"
			}`}
		>
			{icon && (
				<EyeIcon
					className={`size-4 ${on ? "text-amber-300" : "text-gray-400"}`}
					aria-hidden
				/>
			)}
			{choice.label}
			{choice.count != null && (
				<span
					className={`text-xs tabular-nums ${on ? "text-amber-200/80" : "text-gray-500"}`}
				>
					{count(choice.count)}
				</span>
			)}
		</Link>
	)
}

export function WatchChips({ views }: { views: WatchViews }) {
	return (
		<nav
			aria-label={views.label}
			data-watch-chips
			className={`${WRAP} mb-4 flex flex-wrap items-center gap-1.5`}
		>
			{views.toWatch.map((choice) => (
				<Chip key={choice.key} choice={choice} />
			))}
			{/* The divider and Seen wrap together. A phone's row wraps, where a divider would start a line: the eye alone
			sets Seen apart there. */}
			<span className="flex items-center gap-1.5">
				<span
					aria-hidden
					className="mx-1 hidden h-5 w-px bg-white/15 sm:block"
				/>
				<Chip choice={views.seen} icon />
			</span>
		</nav>
	)
}
