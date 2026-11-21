// PROTOTYPE - throwaway (prototype/explore-r4; round 7 layout). The controls over a place's full list, borrowed whole
// from Discover and Watch next: On my services | Everywhere and Not seen yet on the left, the real sort menu on the right
// (where other pages keep it). They change the address (`?sort=`, `?mine=1`, `?unseen=1`), so every state is a link.
//
// Round 7: "More filters in Discover" is a way out, not a filter. Where it shows is the lab's part slot "grid-out"
// (`GridOut` below): in the footer only, as an exit link after the sort, or beside the list's heading. The footer
// (`GridFooter`) always carries it, with Prev and Next instead of page numbers.
import { count } from "../count"
import { Link, useNavigate } from "@remix-run/react"
import { ArrowUpRightIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { type ReactNode, createContext, useContext } from "react"
import { NotSeenSwitch, ServicesControl, SortControl } from "~/ui/filter-bar/controls"
import { DISCOVER_SORTS } from "~/ui/filter-bar/labels"
import { useMyServices } from "~/ui/filter-bar/useFilterData"
import type { Address, Sort } from "../address"
import type { Viewer } from "../types"
import { QUICK_T } from "./motion"

const SORTS = [DISCOVER_SORTS.popular, DISCOVER_SORTS.top, DISCOVER_SORTS.newest]

/**
 * How the way out to Discover looks over and under a grid (the lab's part slot "grid-out"): "match", the mood page's
 * treatment (quiet underlined "More filters in Discover" with an arrow up and out, beside the sort; in the footer the
 * same link, an amber "Keep going in Discover" on the last page), or "exit" (an amber "Open in Discover" after the sort,
 * past a divider; a large card at the end of the list).
 */
export type GridOutStyle = "match" | "exit"
export const GridOut = createContext<GridOutStyle>("match")
export const useGridOut = () => useContext(GridOut)

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

/** "match": quiet text with an arrow pointing away, set apart from the controls (the mood grid's link). */
export function DiscoverOut({ href }: { href: string }) {
	return (
		<Link
			to={href}
			prefetch="intent"
			data-discover-out=""
			className={`group/out inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-1.5 text-sm font-semibold text-gray-400 hover:text-white ${QUICK_T} ${FOCUS}`}
		>
			<span className="underline decoration-white/20 underline-offset-4 group-hover/out:decoration-white/60">
				More filters in Discover
			</span>
			<ArrowUpRightIcon
				aria-hidden
				className={`h-4 w-4 group-hover/out:translate-x-0.5 group-hover/out:-translate-y-0.5 ${QUICK_T}`}
			/>
		</Link>
	)
}

/** "exit": amber, an arrow up and out, no pill. */
export function DiscoverExit({ href, className = "" }: { href: string; className?: string }) {
	return (
		<Link
			to={href}
			prefetch="intent"
			data-discover-out=""
			className={`group inline-flex items-center gap-1 rounded-sm text-sm font-bold text-amber-300 hover:text-amber-200 ${QUICK_T} ${FOCUS} ${className}`}
		>
			<span className="max-sm:hidden">Open in Discover</span>
			<span className="sm:hidden">Discover</span>
			<ArrowUpRightIcon
				aria-hidden
				className={`h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${QUICK_T}`}
			/>
		</Link>
	)
}

export function ListControls({
	address,
	to,
	viewer,
	discoverHref,
	sorts = true,
	lead,
}: {
	address: Address
	to: (a: Address) => string
	viewer: Viewer
	/** Discover with the same filters (TitleList.discoverHref); the link is left out when null. */
	discoverHref?: string | null
	/** False where the order is fixed (a ranking). */
	sorts?: boolean
	/** Something the concept puts first in the row (an intensity or Venn switch). */
	lead?: ReactNode
}) {
	const navigate = useNavigate()
	const mine = useMyServices()
	const out = useGridOut()
	const go = (patch: Partial<Address>) =>
		navigate(to({ ...address, page: undefined, ...patch }), { preventScrollReset: true })
	const hasServices = viewer.hasServices || mine.ids.length > 0
	return (
		<div className="flex flex-wrap items-center gap-2">
			{lead}
			<ServicesControl
				size="sm"
				on={!!address.mine && hasServices}
				hasServices={hasServices}
				providers={mine.providers}
				onChange={(on) => go({ mine: on || undefined })}
				onAddServices={() => navigate("/settings/streaming")}
				labels={{ mine: "My services", everywhere: "Everywhere" }}
			/>
			<NotSeenSwitch
				size="sm"
				on={!!address.unseen}
				onChange={(on) => go({ unseen: on || undefined })}
			/>
			<div className="ml-auto flex items-center gap-2">
				{discoverHref && out === "match" && (
					<span className="max-lg:hidden">
						<DiscoverOut href={discoverHref} />
					</span>
				)}
				{sorts && (
					<SortControl<Sort>
						size="sm"
						options={SORTS as never}
						value={address.sort ?? "popular"}
						onChange={(sort) => go({ sort: sort === "popular" ? undefined : sort })}
					/>
				)}
				{discoverHref && out === "exit" && (
					<>
						<span aria-hidden className="mx-1 h-6 w-px bg-white/10" />
						<DiscoverExit href={discoverHref} />
					</>
				)}
			</div>
		</div>
	)
}

const STEP = `inline-flex h-10 items-center gap-1 rounded-full px-3.5 text-sm font-bold ring-1 ${QUICK_T} ${FOCUS}`
const STEP_ON = "bg-white/[0.06] text-white ring-white/15 hover:bg-white/[0.12] active:scale-[0.97]"
const STEP_OFF = "pointer-events-none text-gray-600 ring-white/[0.06]"

function Step({ dir, to }: { dir: -1 | 1; to: string | null }) {
	const label = dir < 0 ? "Prev" : "Next"
	const body = (
		<>
			{dir < 0 && <ChevronLeftIcon aria-hidden className="h-4 w-4" />}
			{label}
			{dir > 0 && <ChevronRightIcon aria-hidden className="h-4 w-4" />}
		</>
	)
	if (!to)
		return (
			<span aria-disabled="true" className={`${STEP} ${STEP_OFF}`}>
				{body}
			</span>
		)
	return (
		<Link
			to={to}
			rel={dir < 0 ? "prev" : "next"}
			prefetch="intent"
			data-step={label}
			className={`${STEP} ${STEP_ON}`}
		>
			{body}
		</Link>
	)
}

/**
 * Under a grid: how far along you are ("25–48 of 2,318"), the way on to Discover, and Prev and Next (no page numbers).
 * At the end of the list Discover becomes the main way forward: an amber button ("match") or a large card ("exit").
 */
export function GridFooter({
	page,
	pages,
	total,
	shown,
	to,
	discoverHref,
	noun,
}: {
	page: number
	pages: number
	total: number
	/** Titles on this page. */
	shown: number
	to: (n: number) => string
	discoverHref?: string | null
	/** "movies", "shows", "movies and shows". */
	noun: string
}) {
	const out = useGridOut()
	const last = page >= pages
	const per = pages > 1 && !last ? shown : Math.ceil(total / Math.max(1, pages))
	const from = (page - 1) * per + 1
	const range =
		total > 0
			? // Under a thousand the range already shows exact numbers, so the total is exact too ("1–27 of 27", never
				// "of 20"); from a thousand up it's the compact count ("1–40 of 3k").
				`${from.toLocaleString("en-US")}–${(from + shown - 1).toLocaleString("en-US")} of ${total < 1000 ? total : count(total)}`
			: ""
	const steps = pages > 1 && (
		<nav aria-label="Pages" className="flex items-center gap-2">
			<Step dir={-1} to={page > 1 ? to(page - 1) : null} />
			<Step dir={1} to={last ? null : to(page + 1)} />
		</nav>
	)
	if (out === "exit" && discoverHref && last)
		return (
			<div className="space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<p className="text-sm text-gray-400 tabular-nums">{range}</p>
					{steps}
				</div>
				<Link
					to={discoverHref}
					prefetch="intent"
					className={`group flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl bg-gradient-to-r from-amber-400/[0.12] via-amber-400/[0.05] to-transparent px-6 py-5 ring-1 ring-amber-300/25 hover:ring-amber-300/50 ${QUICK_T} ${FOCUS}`}
				>
					<span className="min-w-0">
						<span className="block font-display text-xl font-bold tracking-tight text-white">
							{pages > 1 ? "That's the end of this list" : "That's all of them here"}
						</span>
						<span className="block text-[15px] text-gray-300">
							{`Keep going in Discover: the same ${noun}, with runtime, ratings, age, and every other filter.`}
						</span>
					</span>
					<span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-4 py-2 text-sm font-bold text-gray-950 group-hover:bg-amber-200">
						Open in Discover
						<ArrowUpRightIcon
							aria-hidden
							className={`h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${QUICK_T}`}
						/>
					</span>
				</Link>
			</div>
		)
	const way =
		discoverHref &&
		(last ? (
			<Link
				to={discoverHref}
				prefetch="intent"
				className={`group/end flex h-10 items-center gap-1.5 rounded-full bg-amber-400 px-4 text-sm font-bold text-gray-950 hover:bg-amber-300 active:scale-[0.97] ${QUICK_T} ${FOCUS}`}
			>
				Keep going in Discover
				<ArrowUpRightIcon
					aria-hidden
					className={`h-4 w-4 group-hover/end:translate-x-0.5 group-hover/end:-translate-y-0.5 ${QUICK_T}`}
				/>
			</Link>
		) : out === "exit" ? (
			<DiscoverExit href={discoverHref} />
		) : (
			<DiscoverOut href={discoverHref} />
		))
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-3 border-t border-white/[0.07] pt-5">
			<p className="min-w-0 flex-1 text-sm text-gray-400 tabular-nums max-sm:basis-full">{range}</p>
			{way}
			{steps}
		</div>
	)
}
