// The title page's At a glance: one card of rows (glance-rows.tsx) that each already say their answer. Pressing a
// row anywhere unfolds its detail right under it; another press folds it. Which rows are open is the page's to keep
// (TitlePage.tsx keeps them per history entry, so Back from a sub-page finds them open). Every row's detail is in the
// server's HTML, a closed one hidden: the page's loader puts the people the rows show into the document
// (people-prefetch.server.ts), and opening a row only shows what is already there.
import { ChevronDownIcon } from "@heroicons/react/24/outline"
import { memo } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import GlanceDetailContent from "./GlanceDetail"
import { useGlanceRows } from "./glance-rows"

export { glanceRowLabels } from "./rows"

// A press re-renders the rows, not the details: their props stay the same while the page is open.
const GlanceDetail = memo(GlanceDetailContent)

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
							{/* The row's head is one element: one hover, one outline and one press target over the label,
							    the value and the teaser. The button's ::after covers the whole head; a teaser with links of its
							    own sits on top of it and lets presses through, except on its links (Starring's faces). */}
							<div
								className={`group relative px-4 py-3 hover:bg-white/[0.03] has-[>button:focus-visible]:outline-2 has-[>button:focus-visible]:-outline-offset-2 has-[>button:focus-visible]:outline-amber-300 ${isOpen ? "bg-white/[0.03]" : ""}`}
							>
								<button
									type="button"
									aria-expanded={isOpen}
									aria-controls={`${row.id}-detail`}
									onClick={() => onToggle(row.id)}
									className="flex w-full cursor-pointer items-start gap-3 text-left outline-none after:absolute after:inset-0 after:content-['']"
								>
									<span className="w-24 shrink-0 pt-px text-[13px] text-gray-400 sm:w-28">
										{row.label}
									</span>
									<span className="min-w-0 flex-1 text-[15px] leading-snug text-gray-300">
										{row.value}
										{!row.teaserHasLinks && row.teaser}
									</span>
									<ChevronDownIcon
										aria-hidden="true"
										className={`mt-0.5 h-4 w-4 shrink-0 text-gray-500 transition-transform group-hover:text-amber-300 motion-reduce:transition-none ${isOpen ? "rotate-180 text-amber-300" : ""}`}
									/>
								</button>
								{row.teaserHasLinks && !isOpen && (
									<div className="pointer-events-none relative pr-7 pl-[6.75rem] text-[15px] sm:pl-[7.75rem] [&_a]:pointer-events-auto">
										{row.teaser}
									</div>
								)}
							</div>
							{/* A closed row's detail stays in the document, hidden; it fades in as it opens. */}
							<div
								id={`${row.id}-detail`}
								hidden={!isOpen}
								className="min-w-0 border-t border-white/[0.06] px-4 pt-5 pb-7 motion-safe:animate-fade-in [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-100"
							>
								<GlanceDetail
									id={row.id}
									media={media}
									country={country}
									questions={questions}
								/>
							</div>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
