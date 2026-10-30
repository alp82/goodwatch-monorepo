// OPTION upnext=split: All shows' status filter, first in the list's controls, in the look of the list's own kind
// filter (ui/my-library/MyLibraryPage.tsx). Each status is a page of its own, so each choice is a link.
import { Link } from "@remix-run/react"
import type { NavChoice } from "~/ui/navigation/areas"

const count = (n: number) => n.toLocaleString("en-US")

export function StatusFilter({ statuses }: { statuses: NavChoice[] }) {
	return (
		<nav
			aria-label="Show status"
			className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 [scrollbar-width:none]"
			data-status-filter
		>
			{statuses.map((choice) => (
				<Link
					key={choice.key}
					to={choice.href}
					replace
					preventScrollReset
					prefetch="intent"
					aria-current={choice.here ? "page" : undefined}
					data-status={choice.key}
					className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${choice.here ? "bg-white text-black" : "text-gray-300 hover:bg-white/10"}`}
				>
					{choice.label}
					{choice.count != null && (
						<span
							className={`text-xs tabular-nums ${choice.here ? "text-black/60" : "text-gray-400"}`}
						>
							{count(choice.count)}
						</span>
					)}
				</Link>
			))}
		</nav>
	)
}
