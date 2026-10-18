// PROTOTYPE - throwaway. Hub variant B: one shelf per subpage, like the start page's rows. A heading with the count,
// a strip of posters from the subpage, and an Open key. Scores leads, with its spread beside the strip. The tools
// without posters are one line of keys at the end.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { DISPLAY, Poster } from "~/ui/my-pages/bits"
import {
	type HubData,
	NewMark,
	type Section,
	SpreadBars,
	count,
	sectionsOf,
	spreadOf,
} from "./sections"

const ORDER: Section["key"][] = ["scores", "want", "progress", "seen", "unrated"]

function Shelf({ section, spread }: { section: Section; spread?: number[] }) {
	return (
		<section
			className="flex flex-col gap-3 border-b border-white/5 pb-6"
			data-hub-shelf={section.key}
		>
			<div className="flex flex-wrap items-end gap-x-4 gap-y-1">
				<h2 className={`${DISPLAY} flex items-center gap-2 text-2xl text-white`}>
					{section.name}
					{section.isNew && <NewMark />}
				</h2>
				{section.count !== null && (
					<span className="pb-0.5 text-sm tabular-nums text-gray-400">
						{section.key === "progress" ? section.detail : count(section.count)}
					</span>
				)}
				<span className="grow" />
				<Link
					to={section.to}
					prefetch="intent"
					className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
				>
					{section.key === "scores" ? "Rescore" : "Open"}
					<ChevronRightIcon className="h-4 w-4" aria-hidden />
				</Link>
			</div>
			<p className="-mt-2 text-sm text-gray-500">{section.hint}</p>
			<div className="flex items-stretch gap-4">
				{spread && (
					<Link
						to={section.to}
						className="hidden w-64 shrink-0 flex-col justify-end rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10 hover:bg-white/[0.06] sm:flex"
						aria-label="Your scores, by score"
					>
						<SpreadBars spread={spread} className="h-20" />
					</Link>
				)}
				{section.posters.length ? (
					<ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
						{section.posters.map((poster) => (
							<li key={poster.key} className="shrink-0">
								<Link to={section.to} title={poster.title}>
									<Poster
										path={poster.poster_path}
										size="w154"
										className="h-[138px] w-[92px] rounded-md hover:ring-2 hover:ring-amber-300"
									/>
								</Link>
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-gray-500">Nothing here yet.</p>
				)}
			</div>
		</section>
	)
}

export function HubShelves({ data }: { data: HubData }) {
	const sections = sectionsOf(data)
	const by = Object.fromEntries(sections.map((s) => [s.key, s])) as Record<
		Section["key"],
		Section
	>
	return (
		<div className="flex flex-col gap-6">
			{ORDER.map((key) => (
				<Shelf
					key={key}
					section={by[key]}
					spread={key === "scores" ? spreadOf(data.rescore) : undefined}
				/>
			))}
			<div className="flex flex-wrap gap-2">
				{sections
					.filter((s) => s.group === "tools")
					.map((section) => (
						<Link
							key={section.key}
							to={section.to}
							prefetch="intent"
							className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/[0.04] px-4 text-sm font-bold text-gray-200 ring-1 ring-white/10 hover:bg-white/10"
						>
							<section.icon className="h-5 w-5 text-gray-400" aria-hidden />
							{section.name}
							{section.count !== null && (
								<span className="text-xs tabular-nums text-gray-500">
									{count(section.count)}
								</span>
							)}
						</Link>
					))}
			</div>
		</div>
	)
}
