// The sort select in the docked strip: the filter bar's sort control (ui/filter-bar/controls.tsx) at the strip's
// height, with Watch next's six sorts. Its menu renders in a portal, because the strip pins under the site header.
// Best match needs taste: without it the item says why, and guests see the sign-up prompt under the list.
import type { WatchNextSort } from "~/domain/watch-next"
import type { WatchNext } from "~/server/watch-next.server"
import { SortControl } from "~/ui/filter-bar/controls"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import { sortOptionsFor } from "./labels"

export function SortMenu({
	sort,
	bestMatch,
	onPick,
}: {
	sort: WatchNextSort
	bestMatch: WatchNext["bestMatch"]
	onPick: (sort: WatchNextSort) => void
}) {
	const guestPrompt =
		bestMatch.prompt === "signUpToLearn" || bestMatch.prompt === "signUpToKeep"
	return (
		<SortControl
			size="sm"
			align="right"
			portal
			menuClassName="w-[22rem]"
			options={sortOptionsFor(bestMatch)}
			value={sort}
			onChange={onPick}
			footer={
				guestPrompt && (
					<div className="px-2 pt-2 pb-1">
						<SignUpPrompt
							feature="bestMatch"
							stage={bestMatch.prompt === "signUpToKeep" ? "keep" : "learn"}
							size="chip"
						/>
					</div>
				)
			}
		/>
	)
}
