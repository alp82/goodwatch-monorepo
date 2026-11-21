// PROTOTYPE - throwaway (prototype/explore-r5). The round 4 control: Movies | Shows as the real segmented pill. Movies and shows together
// has no option of its own yet (it is reachable by address, `/all/...`); on such a page both are lit.
import { Link } from "@remix-run/react"
import { SELECTED_SOLID } from "~/ui/selection/selected"
import type { SlotVariant } from "../../contract"
import type { KindProps } from "./slot"

function View({ address, kinds }: KindProps) {
	const both = address.kind === "all"
	return (
		<nav
			aria-label={both ? "Movies and shows together" : "Movies or shows"}
			className="flex max-w-full gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10"
		>
			{kinds
				.filter((k) => k.kind !== "all")
				.map((k) => {
					const on = both || k.on
					return (
						<Link
							key={k.kind}
							to={k.href}
							prefetch="intent"
							// Both together: each word is current, and the group says so.
							aria-current={both ? "true" : k.on ? "page" : undefined}
							className={`flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? `${SELECTED_SOLID} ring-2 ring-amber-400 ring-inset` : "text-gray-300 hover:bg-white/10 hover:text-white"}`}
						>
							{k.label}
						</Link>
					)
				})}
		</nav>
	)
}

export const variant: SlotVariant<never, KindProps> = {
	id: "r4",
	name: "Round 4",
	what: "Movies | Shows as the segmented pill. Both together is only reachable by address; then both are lit.",
	View,
}
