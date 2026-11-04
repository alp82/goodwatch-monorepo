// The title page's At a glance: one card of rows (glance-rows.tsx) that each already say their answer. Pressing a
// row anywhere unfolds its detail right under it; another press folds it. Which rows are open is the page's to keep
// (TitlePage.tsx keeps them per history entry, so Back from a sub-page finds them open).
import { ChevronDownIcon } from "@heroicons/react/24/outline"
import { Suspense, lazy } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { useGlanceRows } from "./glance-rows"

// Every row is closed at first: a row's content loads when one opens (or comes back open on Back).
const GlanceDetail = lazy(reloadOnStaleChunk(() => import("./GlanceDetail")))

export { glanceRowLabels } from "./rows"

type Media = MovieResult | ShowResult

export function AtAGlance({
	media,
	country,
	questions,
	open,
	onToggle,
}: {
	media: Media
	country: string
	questions: TitleQuestion[]
	/** The ids of the open rows. */
	open: string[]
	onToggle: (id: string) => void
}) {
	const rows = useGlanceRows({ media, country, questions })
	if (!rows.length) return null
	return (
		<div
			data-feedback-area="details"
			className="rounded-2xl bg-white/[0.025] ring-1 ring-white/10"
		>
			<ul className="divide-y divide-white/[0.06]">
				{rows.map((row) => {
					const isOpen = open.includes(row.id)
					return (
						<li
							key={row.id}
							id={row.id}
							className="scroll-mt-44 lg:scroll-mt-32"
						>
							<button
								type="button"
								aria-expanded={isOpen}
								onClick={() => onToggle(row.id)}
								className={`group flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-300 ${isOpen ? "bg-white/[0.03]" : ""}`}
							>
								<span className="w-24 shrink-0 pt-px text-[13px] text-gray-400 sm:w-28">
									{row.label}
								</span>
								<span className="min-w-0 flex-1 text-[15px] leading-snug text-gray-300">
									{row.value}
									{row.teaser}
								</span>
								<ChevronDownIcon
									aria-hidden="true"
									className={`mt-0.5 h-4 w-4 shrink-0 text-gray-500 transition-transform group-hover:text-amber-300 motion-reduce:transition-none ${isOpen ? "rotate-180 text-amber-300" : ""}`}
								/>
							</button>
							{isOpen && (
								<div className="min-w-0 border-t border-white/[0.06] px-4 pt-5 pb-7 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-100">
									<Suspense
										fallback={<div aria-busy="true" className="h-40" />}
									>
										<GlanceDetail
											id={row.id}
											media={media}
											country={country}
											questions={questions}
										/>
									</Suspense>
								</div>
							)}
						</li>
					)
				})}
			</ul>
		</div>
	)
}
