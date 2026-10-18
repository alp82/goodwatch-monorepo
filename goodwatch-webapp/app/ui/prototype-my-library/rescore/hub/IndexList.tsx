// PROTOTYPE - throwaway. Hub variant C: a dense index, like a phone's settings list. One row per subpage: icon,
// name, one line of what is in it, the count and a chevron. Two groups: your titles, then tools. No posters.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type HubData, NewMark, type Section, count, sectionsOf } from "./sections"

function Row({ section }: { section: Section }) {
	return (
		<li className="border-b border-white/5 last:border-b-0">
			<Link
				to={section.to}
				prefetch="intent"
				data-hub-row={section.key}
				className="group flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-white/[0.04]"
			>
				<span
					className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${section.isNew ? "bg-amber-400 text-black" : "bg-white/[0.06] text-gray-300"}`}
				>
					<section.icon className="h-5 w-5" aria-hidden />
				</span>
				<span className="min-w-0 flex-1">
					<b className="flex items-center gap-2 text-sm text-white group-hover:text-amber-200 md:text-base">
						{section.name}
						{section.isNew && <NewMark />}
					</b>
					<span className="block truncate text-xs text-gray-400">
						{section.key === "progress" ? section.detail : section.hint}
					</span>
				</span>
				{section.count !== null && (
					<span className="shrink-0 text-sm font-bold tabular-nums text-gray-300">
						{count(section.count)}
					</span>
				)}
				<ChevronRightIcon
					className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300"
					aria-hidden
				/>
			</Link>
		</li>
	)
}

function Group({ label, sections }: { label: string; sections: Section[] }) {
	return (
		<section className="flex flex-col gap-2">
			<h2 className="px-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
				{label}
			</h2>
			<ul className="overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
				{sections.map((section) => (
					<Row key={section.key} section={section} />
				))}
			</ul>
		</section>
	)
}

export function HubIndex({ data }: { data: HubData }) {
	const sections = sectionsOf(data)
	return (
		<div className="flex max-w-2xl flex-col gap-6">
			<Group
				label="Your titles"
				sections={sections.filter((s) => s.group === "titles")}
			/>
			<Group label="Tools" sections={sections.filter((s) => s.group === "tools")} />
		</div>
	)
}
