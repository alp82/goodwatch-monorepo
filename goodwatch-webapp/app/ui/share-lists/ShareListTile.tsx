// One share list in a grid: its card, scaled into a fixed-height frame so portrait, square, and story designs line up,
// with the list title and date below. The card links to the public list page.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { ScaledCard } from "~/ui/share-card/ScaledCard"
import { designByKey } from "~/ui/share-card/designs"
import { shareListPath } from "~/ui/share-card/links"
import { type CardTitle, type ThemeKey, listByline } from "~/ui/share-card/model"

export interface ShareListSummary {
	id: string
	title: string
	design: string
	theme: ThemeKey
	items: CardTitle[]
	date: string
	// Only sent to the owner; everyone else only ever sees public lists.
	visibility?: "public" | "unlisted"
}

export function ShareListTile({
	list,
	handle,
	children,
}: { list: ShareListSummary; handle: string; children?: ReactNode }) {
	const design = designByKey(list.design)
	return (
		<li className="flex min-w-0 flex-col gap-3">
			<Link
				to={shareListPath(handle, list.id)}
				prefetch="intent"
				className="group relative block h-72 rounded-2xl bg-gray-900/60 p-3 ring-1 ring-white/5 transition hover:bg-gray-800/70 hover:ring-white/15 sm:h-80"
				aria-label={list.title}
			>
				{list.visibility === "unlisted" && (
					<span className="absolute top-3 left-3 z-10 rounded-full bg-gray-950/90 px-2.5 py-1 text-xs font-bold text-gray-200 ring-1 ring-white/15">
						Unlisted
					</span>
				)}
				<div className="pointer-events-none h-full transition duration-300 group-hover:-translate-y-0.5">
					<ScaledCard
						design={design}
						card={{
							title: list.title,
							items: list.items,
							name: listByline(handle),
							theme: list.theme,
							date: list.date,
						}}
						fill
						className="rounded-lg shadow-xl shadow-black/50"
					/>
				</div>
			</Link>
			<div className="min-w-0 px-1">
				<Link
					to={shareListPath(handle, list.id)}
					className="block truncate font-bold text-gray-100 hover:text-white"
				>
					{list.title}
				</Link>
				<p className="text-sm text-gray-400">
					{design.name} · {list.date}
				</p>
				{children}
			</div>
		</li>
	)
}
