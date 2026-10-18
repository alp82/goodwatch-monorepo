// PROTOTYPE - throwaway. Hub variant A: the Settings page's tiles. Each tile shows what is inside now and is the
// link. Scores is the wide first tile with its score spread; the tools sit in a row of small tiles at the end.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import {
	type HubData,
	NewMark,
	PosterFan,
	type Section,
	SpreadBars,
	count,
	sectionsOf,
	spreadOf,
} from "./sections"

const tileClass =
	"group flex min-h-48 flex-col rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:p-6"

function Tile({
	section,
	className = "",
	children,
}: { section: Section; className?: string; children?: ReactNode }) {
	return (
		<Link
			to={section.to}
			prefetch="intent"
			className={`${tileClass} ${className}`}
			data-hub-tile={section.key}
		>
			<span className="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
				{section.name}
				{section.isNew && <NewMark />}
			</span>
			<span className="mb-4 text-sm text-gray-400">{section.hint}</span>
			<span className="mt-auto">{children}</span>
			<span className="mt-4 text-sm font-semibold text-amber-500 group-hover:text-amber-400">
				Open
			</span>
		</Link>
	)
}

const Big = ({ section }: { section: Section }) =>
	section.count === null ? null : (
		<span className="flex items-baseline gap-2">
			<span className="text-3xl font-black tabular-nums text-white md:text-4xl">
				{count(section.count)}
			</span>
			{section.detail && section.key !== "progress" && (
				<span className="text-sm text-gray-400">{section.detail}</span>
			)}
		</span>
	)

export function HubTiles({ data }: { data: HubData }) {
	const sections = sectionsOf(data)
	const by = Object.fromEntries(sections.map((s) => [s.key, s])) as Record<
		Section["key"],
		Section
	>
	const tools = sections.filter((s) => s.group === "tools")
	return (
		<div className="flex flex-col gap-4">
			<div className="grid gap-4 md:grid-cols-2">
				<Tile section={by.scores} className="md:col-span-2">
					<span className="flex flex-wrap items-end gap-6">
						<span className="flex flex-col gap-3">
							<Big section={by.scores} />
							<PosterFan posters={by.scores.posters} max={6} />
						</span>
						<span className="min-w-56 flex-1">
							<SpreadBars spread={spreadOf(data.rescore)} className="h-16" />
						</span>
					</span>
				</Tile>
				{(["want", "seen", "progress", "unrated"] as const).map((key) => (
					<Tile key={key} section={by[key]}>
						<span className="flex items-end justify-between gap-4">
							<span className="flex flex-col gap-1">
								<Big section={by[key]} />
								{key === "progress" && (
									<span className="text-sm text-gray-400">
										{by.progress.detail}
									</span>
								)}
							</span>
							<PosterFan posters={by[key].posters} />
						</span>
					</Tile>
				))}
			</div>
			<div className="grid gap-4 sm:grid-cols-3">
				{tools.map((section) => (
					<Link
						key={section.key}
						to={section.to}
						prefetch="intent"
						data-hub-tile={section.key}
						className="group flex items-center gap-3 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 hover:bg-white/[0.06]"
					>
						<section.icon className="h-6 w-6 shrink-0 text-gray-400" aria-hidden />
						<span className="min-w-0 flex-1">
							<b className="block text-sm text-white">{section.name}</b>
							<span className="block truncate text-xs text-gray-400">
								{section.count !== null
									? `${count(section.count)} · ${section.hint}`
									: section.hint}
							</span>
						</span>
						<ChevronRightIcon
							className="h-4 w-4 shrink-0 text-gray-600 group-hover:text-amber-300"
							aria-hidden
						/>
					</Link>
				))}
			</div>
		</div>
	)
}
