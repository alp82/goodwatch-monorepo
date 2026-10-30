// OPTION upnext=sections: under Next episodes on /watch, one short poster row per show status (Not started, Watching,
// On hold, Dropped), each with its count and "See all" to its list page. A status with no show is left out. The rows
// scroll sideways on a phone.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { MyShows } from "~/server/my-shows.server"
import { DISPLAY, Poster, WRAP } from "~/ui/my-pages/bits"
import type { NavChoice } from "~/ui/navigation/areas"
import { titleToDashed } from "~/utils/helpers"
import { canonicalMediaTitle } from "~/utils/media-presentation"

/** The posters a row shows; "See all" has the rest. */
const SHOWN = 10

type Card = MyShows["start"][number] | MyShows["continue"][number]

const showHref = (show: Card) =>
	`/show/${show.id}-${titleToDashed(canonicalMediaTitle(show))}`

const count = (n: number) => n.toLocaleString("en-US")

function Section({ view, shows }: { view: NavChoice; shows: Card[] }) {
	const total = view.count ?? shows.length
	if (!total) return null
	return (
		<section
			aria-labelledby={`status-${view.key}`}
			data-status-section={view.key}
		>
			<div className="mb-3 flex items-baseline gap-2">
				<h2
					id={`status-${view.key}`}
					className={`${DISPLAY} text-xl text-white md:text-2xl`}
				>
					{view.label}
				</h2>
				<span className="text-sm tabular-nums text-gray-500">
					{count(total)}
				</span>
				<Link
					to={view.href}
					prefetch="intent"
					className="ml-auto flex min-h-9 items-center gap-0.5 text-sm font-semibold text-gray-300 hover:text-white"
				>
					See all
					<ChevronRightIcon className="size-4 text-gray-500" aria-hidden />
				</Link>
			</div>
			<ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
				{shows.slice(0, SHOWN).map((show) => (
					<li key={show.id} className="w-[92px] shrink-0 sm:w-[104px]">
						<Link
							to={showHref(show)}
							prefetch="intent"
							className="group block"
							title={show.title}
						>
							<Poster
								path={show.poster_path}
								size="w185"
								className="aspect-[2/3] w-full rounded-lg ring-1 ring-white/10 transition-opacity group-hover:opacity-80"
							/>
							<span className="mt-1.5 block truncate text-xs text-gray-400 group-hover:text-gray-200">
								{show.title}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

/** `views`: Up next's views (upNextViews), Next episodes first; `data`: the page's shows. */
export function StatusSections({
	views,
	data,
}: { views: NavChoice[]; data: MyShows }) {
	const rows: Record<string, Card[]> = {
		"not-started": data.start,
		watching: [...data.continue, ...data.pickUp, ...data.waiting],
		"on-hold": data.onHold,
		dropped: data.dropped,
	}
	const sections = views.filter((view) => view.key in rows)
	return (
		<div
			className={`${WRAP} -mt-12 flex flex-col gap-8 border-t border-white/5 pt-8 pb-24`}
			data-status-sections
		>
			{sections.map((view) => (
				<Section key={view.key} view={view} shows={rows[view.key]} />
			))}
		</div>
	)
}
