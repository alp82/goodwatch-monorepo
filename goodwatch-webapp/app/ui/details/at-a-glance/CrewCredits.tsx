// At a glance's Made by, opened: the crew as credits you can read. Every department with its people and their jobs,
// key jobs first, nothing behind chips; a long department shows six and "+N more" opens it in place. The title page's
// document brings only each department's first six: opening one asks for the whole list.
import { Link } from "@remix-run/react"
import { useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { useSectionNear } from "~/ui/details/below-fold"
import { CAPTION } from "~/ui/details/page-ui"
import { type PeopleRow, usePeople } from "~/ui/details/people/usePeople"
import { personPath } from "~/utils/helpers"
import { CREW_PAGE_SIZE, DEPARTMENT_SHOWS } from "./rows"

type Media = MovieResult | ShowResult

/** Department-sized boxes while the crew loads. */
const PLACEHOLDERS = ["a", "b", "c", "d", "e", "f"]

/** The crew as readable credits: every department, its people and their jobs. */
export function CrewCredits({ media }: { media: Media }) {
	const near = useSectionNear()
	const crew = usePeople({
		mediaType: media.mediaType,
		tmdbId: media.details.tmdb_id,
		kind: "crew",
		pageSize: CREW_PAGE_SIZE,
		// The document brings the list; a late one is asked for once the section is near.
		enabled: near,
	})
	const [open, setOpen] = useState<string[]>([])
	if (!crew.ready)
		return (
			<div
				className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
				aria-busy="true"
			>
				{PLACEHOLDERS.map((key) => (
					<div
						key={key}
						className="h-28 animate-pulse rounded-lg bg-white/[0.03]"
					/>
				))}
			</div>
		)
	const byDept = new Map<string, PeopleRow[]>()
	for (const r of crew.rows)
		byDept.set(r.group, [...(byDept.get(r.group) ?? []), r])
	const depts = crew.groups
		.map((g) => ({
			// g.count: everyone in the department, also while only its first people are in.
			...g,
			rows: (byDept.get(g.key) ?? []).sort(
				(a, b) => Number(b.key ?? false) - Number(a.key ?? false),
			),
		}))
		.filter((g) => g.rows.length)
	return (
		<div data-feedback-area="cast">
			<div className="columns-1 gap-x-10 sm:columns-2 lg:columns-3">
				{depts.map((d) => {
					const all = open.includes(d.key)
					const shown = all ? d.rows : d.rows.slice(0, DEPARTMENT_SHOWS)
					return (
						<section
							key={d.key}
							aria-label={d.label}
							className="mb-7 break-inside-avoid"
						>
							<h4 className={`${CAPTION} mb-2`}>
								{d.label === "Crew" ? "Other crew" : d.label}
								<span className="normal-case tracking-normal text-gray-600">
									{" "}
									· {d.count}
								</span>
							</h4>
							<ul className="flex flex-col gap-1.5">
								{shown.map((p) => (
									<li key={p.id} className="min-w-0 text-[14px] leading-snug">
										<Link
											to={personPath(p.id, p.name)}
											prefetch="intent"
											data-person-id={p.id}
											className={`font-medium hover:text-amber-300 ${p.key ? "text-white" : "text-gray-200"}`}
										>
											{p.name}
										</Link>
										<span className="text-gray-500"> {p.roles.join(", ")}</span>
									</li>
								))}
							</ul>
							{d.count > DEPARTMENT_SHOWS && (
								<button
									type="button"
									aria-expanded={all}
									onClick={() => {
										// Opening a department asks for the people of it that aren't in yet.
										if (!all && crew.partial) crew.loadAll()
										else if (!all && d.rows.length < d.count) crew.loadMore()
										setOpen((o) =>
											all ? o.filter((x) => x !== d.key) : [...o, d.key],
										)
									}}
									className="mt-1.5 cursor-pointer text-[13px] font-semibold text-amber-300/90 hover:text-amber-300"
								>
									{all ? "Fewer" : `+${d.count - DEPARTMENT_SHOWS} more`}
								</button>
							)}
						</section>
					)
				})}
			</div>
			{crew.hasMore && (
				<button
					type="button"
					onClick={crew.loadMore}
					disabled={crew.loadingMore}
					className="cursor-pointer text-[14px] font-semibold text-amber-300/90 hover:text-amber-300 disabled:cursor-default disabled:text-gray-500"
				>
					{crew.loadingMore
						? "Loading more of the crew"
						: `More of the crew (${crew.total} in all)`}
				</button>
			)}
		</div>
	)
}
