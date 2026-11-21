// The people and the award winners of a place, as hand-offs to the
// real /person and /awards pages.
import { Link } from "@remix-run/react"
import { TrophyIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import { RowArrows, useStepRow } from "~/ui/row-arrows"
import type { AwardWin, Person } from "~/domain/browse/types"
import { poster } from "./base"

const initials = (name: string) =>
	name
		.split(/\s+/)
		.map((w) => w[0])
		.slice(0, 2)
		.join("")

/**
 * A row of faces. Each is one link to the person's page. Every row strip has Prev and Next (the shared
 * `~/ui/row-arrows`); `head` gets the arrows to place next to its heading.
 */
export function PeopleStrip({
	people,
	head,
}: {
	people: Person[]
	head?: (arrows: ReactNode) => ReactNode
}) {
	const row = useStepRow<HTMLUListElement>([people.length])
	if (!people.length) return null
	const strip = (
		<ul
			ref={row.ref}
			onScroll={row.measure}
			className="-mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:gap-5 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:scroll-px-0 lg:px-0"
		>
			{people.map((p) => (
				<li key={`${p.role}-${p.id}`} className="shrink-0 snap-start">
					<Link
						to={p.to}
						prefetch="intent"
						className="group flex w-24 flex-col items-center gap-2 rounded-xl text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:w-28"
					>
						<span className="relative block h-20 w-20 overflow-hidden rounded-full bg-gray-800 ring-1 ring-white/15 transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:ring-white/40 motion-reduce:transition-none sm:h-24 sm:w-24">
							{p.photo ? (
								<img
									src={poster(p.photo, "w185")}
									alt=""
									loading="lazy"
									className="h-full w-full object-cover"
								/>
							) : (
								<span className="grid h-full w-full place-items-center text-xl font-bold text-gray-500">
									{initials(p.name)}
								</span>
							)}
						</span>
						<span className="block">
							<span className="block text-sm leading-tight font-semibold text-white group-hover:text-amber-200">
								{p.name}
							</span>
							<span className="mt-0.5 block text-xs text-gray-400">{p.role}</span>
						</span>
					</Link>
				</li>
			))}
		</ul>
	)
	if (!head) return strip
	return (
		<>
			{head(<RowArrows row={row} label="people" />)}
			{strip}
		</>
	)
}

/** Award winners as compact rows: the poster, the title, and what it won. */
export function AwardStrip({ wins }: { wins: AwardWin[] }) {
	if (!wins.length) return null
	return (
		<ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
			{wins.map((w) => (
				<li key={w.title.card.key} className="min-w-0">
					<Link
						to={w.title.to}
						prefetch="intent"
						className="group flex items-center gap-3 rounded-xl p-2 outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<span className="block w-11 shrink-0 overflow-hidden rounded-[5px] bg-gray-800 ring-1 ring-white/10">
							{w.title.card.poster_path && (
								<img
									src={poster(w.title.card.poster_path, "w92")}
									alt=""
									loading="lazy"
									className="block aspect-[2/3] w-full object-cover"
								/>
							)}
						</span>
						<span className="min-w-0">
							<span className="block truncate text-sm font-semibold text-white group-hover:text-amber-200">
								{w.title.card.title}
							</span>
							<span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-300/90">
								<TrophyIcon className="h-3.5 w-3.5 shrink-0" />
								<span className="truncate">
									{w.award} · {w.year}
								</span>
							</span>
							<span className="block truncate text-xs text-gray-400">{w.category}</span>
						</span>
					</Link>
				</li>
			))}
		</ul>
	)
}
