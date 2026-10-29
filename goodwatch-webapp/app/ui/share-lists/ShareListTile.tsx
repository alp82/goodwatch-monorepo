import type { CardDisplay } from "~/ui/share-card/page-images"
import { mediaFieldLanguage } from "~/utils/media-presentation"
// One share list in a grid: its card, scaled into a fixed-height frame so portrait, square, and story designs line up,
// with the list title and date below. The card links to the public list page.
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import { ScaledCard } from "~/ui/share-card/ScaledCard"
import { designByKey } from "~/ui/share-card/designs"
import { shareListPath } from "~/ui/share-card/links"
import {
	type CardDesign,
	type CardTitle,
	type ThemeKey,
	listByline,
} from "~/ui/share-card/model"

export interface ShareListSummary {
	id: string
	title: string
	design: string
	theme: ThemeKey
	items: CardTitle[]
	date: string
	// Only sent to the owner; everyone else only ever sees public lists.
	visibility?: "public" | "unlisted" | "private"
	collection?: boolean
	itemCount?: number
}

// Body's max-w-7xl/px-4/sm:px-6/lg:px-8, this grid's columns/gap-6, and the tile's p-3/h-72/sm:h-80.
// A card fits both dimensions of that box, so a portrait preview is narrower than the tile.
export function listTileDisplay(
	design: Pick<CardDesign, "w" | "h">,
): CardDisplay {
	const ratio = design.w / design.h
	const phone = 264 * ratio
	const wide = 296 * ratio
	return {
		rules: [
			["(min-width: 1280px)", `${Math.min(262, wide)}px`],
			[
				"(min-width: 1024px)",
				`min(calc(33.333333vw - 61.333333px), ${wide}px)`,
			],
			["(min-width: 640px)", `min(calc(50vw - 60px), ${wide}px)`],
			["(min-width: 480px)", `min(calc(50vw - 52px), ${phone}px)`],
			[null, `min(calc(100vw - 56px), ${phone}px)`],
		],
		maxWidth: Math.min(452, wide),
	}
}

export function ShareListTile({
	list,
	handle,
	children,
	imagePriority,
}: {
	list: ShareListSummary
	handle: string
	children?: ReactNode
	imagePriority?: "high" | "lazy"
}) {
	if (list.collection)
		return (
			<li className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
				<Link
					className="block break-words text-lg font-bold text-gray-100"
					to={`/lists/${list.id}`}
				>
					{list.title}
				</Link>
				<p className="mt-2 text-sm text-gray-400">
					{list.itemCount ?? list.items.length} titles ·{" "}
					{list.visibility ?? "public"}
				</p>
				{children}
			</li>
		)
	const design = designByKey(list.design)
	return (
		<li className="flex min-w-0 flex-col gap-3">
			<Link
				to={shareListPath(handle, list.id)}
				prefetch="intent"
				className="group relative block h-72 rounded-2xl bg-gray-900/60 p-3 ring-1 ring-white/5 transition hover:bg-gray-800/70 hover:ring-white/15 sm:h-80"
			>
				{list.visibility === "unlisted" && (
					<span className="absolute top-3 left-3 z-10 rounded-full bg-gray-950/90 px-2.5 py-1 text-xs font-bold text-gray-200 ring-1 ring-white/15">
						Unlisted
					</span>
				)}
				<div
					role="img"
					aria-label={list.title}
					className="pointer-events-none h-full transition duration-300 group-hover:-translate-y-0.5"
				>
					<ScaledCard
						imagePriority={imagePriority}
						display={imagePriority ? listTileDisplay(design) : undefined}
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
					<span lang={mediaFieldLanguage(list)}>{list.title}</span>
				</Link>
				<p className="text-sm text-gray-400">
					{design.name} · {list.date}
				</p>
				{children}
			</div>
		</li>
	)
}
