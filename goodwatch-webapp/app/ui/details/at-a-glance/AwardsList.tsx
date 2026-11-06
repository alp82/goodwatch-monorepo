// A title's reported award results: the "N awards" link at the end of the title page's meta row, and At a glance's
// opened Awards row, every result by body (rules in domain/title-award-list.ts). A title without rows shows neither;
// without a win, no link.
import { TrophyIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import {
	type BodyGroup,
	type TitleAwardResult,
	awardsLinkLabel,
	byBody,
	categoryLabel,
	foldsNominations,
	nominationsLabel,
	yearSpan,
} from "~/domain/title-award-list"

/** The title's reported wins as a quiet link to At a glance's Awards row; nothing without a win. */
export function AwardsLink({
	wins,
	onOpen,
}: { wins: number; onOpen: () => void }) {
	const label = awardsLinkLabel(wins)
	if (!label) return null
	return (
		// biome-ignore lint/a11y/useValidAnchor: a real link to the row, also before the page's scripts run
		<a
			href="#glance-awards"
			onClick={(e) => {
				if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
					return
				e.preventDefault()
				onOpen()
			}}
			className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm font-semibold text-amber-300/90 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 max-sm:text-[13px] sm:text-[14px] lg:text-[15px]"
		>
			<TrophyIcon aria-hidden="true" className="size-4 shrink-0" />
			{label}
		</a>
	)
}

// A long list repeats the trophy in every win: one drawing in the list, each win points at it (an icon's path is
// about 400 bytes of HTML).
const TROPHY = "award-result-trophy"

const Result = ({ won }: { won: boolean }) =>
	won ? (
		<span className="inline-flex items-center gap-1 text-[13px] font-semibold text-amber-200">
			<svg aria-hidden="true" className="size-3.5 text-amber-300">
				<use href={`#${TROPHY}`} />
			</svg>
			Won
		</span>
	) : (
		<span className="text-[13px] text-gray-500">Nominated</span>
	)

/** The opened Awards row: by body, wins first in each. */
export function AwardsList({ results }: { results: TitleAwardResult[] }) {
	return (
		<div className="flex max-w-[46rem] flex-col gap-6">
			<svg aria-hidden="true" className="absolute size-0">
				<defs>
					<TrophyIcon id={TROPHY} />
				</defs>
			</svg>
			{byBody(results).map((g) => (
				<BodyResults key={g.award} group={g} />
			))}
		</div>
	)
}

/** One body's results; a body with many folds its nominations into one line that opens them. */
function BodyResults({ group: g }: { group: BodyGroup }) {
	const [open, setOpen] = useState(false)
	const folded = !open && foldsNominations(g)
	const shown = folded ? g.results.filter((r) => r.won) : g.results
	return (
		<div>
			<h4 className="flex items-baseline gap-2 text-[15px] font-semibold text-white">
				{g.award}
				<span className="text-[13px] font-normal text-gray-500 tabular-nums">
					{yearSpan(g.from, g.to)}
				</span>
			</h4>
			{/* The rows' layout is the list's, so a long list doesn't repeat it in every row. */}
			<ul className="mt-1.5 divide-y divide-white/[0.05] text-[15px] leading-snug [&>li]:grid [&>li]:grid-cols-[minmax(0,1fr)_3rem_5.5rem] [&>li]:items-baseline [&>li]:gap-3 [&>li]:py-1.5">
				{shown.map((r) => (
					<li key={`${r.category}-${r.year}-${r.won}`}>
						<span className={r.won ? "text-gray-100" : "text-gray-400"}>
							{categoryLabel(r.category)}
						</span>
						<span className="text-[13px] text-gray-500 tabular-nums">
							{r.year}
						</span>
						<Result won={r.won} />
					</li>
				))}
				{folded && (
					<li>
						<button
							type="button"
							onClick={() => setOpen(true)}
							className="col-span-full cursor-pointer justify-self-start rounded-sm text-[15px] font-semibold text-amber-300/90 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
						>
							{nominationsLabel(g.nominations)}
						</button>
					</li>
				)}
			</ul>
		</div>
	)
}
