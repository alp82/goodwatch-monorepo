// PROTOTYPE - throwaway. Round 4 variant 6: the More popover. "Find a filter" and the sub-tabs (one per kind of niche
// filter) share its top row; a tab shows its two to four filters as real controls in R's two columns, so nothing needs
// a long scroll. Typing in Find a filter swaps the tab's content for the matches from every filter.
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import { FilterGroups, FilterSearchField } from "~/ui/filter-bar"
import { type CardKey, cardOf } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import type { ProtoDiscover } from "../kit"
import { NICHE_KEYS, NicheControl, type Pieces, chipsOf, clearCard, nicheFor } from "./R4-6-parts"

type Item = { k: CardKey; title: string; hint: string }

const valueText = (pieces: Pieces, k: CardKey) =>
	chipsOf(pieces, k)
		.map((c) => c.label.replace(/^(About|Style|Theme|Similar to|Like|Loved|Disliked|With|Produced in) /, ""))
		.join(", ")

/** One niche filter: its name with the current value (or a hint), Clear, and the real control under it. */
export function FilterTile({ d, pieces, item }: { d: ProtoDiscover; pieces: Pieces; item: Item }) {
	const value = valueText(pieces, item.k)
	return (
		<section aria-label={item.title} className="min-w-0">
			<header className="mb-2.5 flex h-6 min-w-0 items-center gap-2">
				<span className={`h-1.5 w-1.5 shrink-0 rounded-full ${FILTER_ACCENTS[item.k].dot}`} />
				<h4 className="shrink-0 text-[14px] font-semibold text-gray-100">{item.title}</h4>
				<span className={`min-w-0 truncate text-[12px] ${value ? "font-semibold text-amber-200/90" : "text-gray-500"}`}>
					{value || item.hint}
				</span>
				{value && (
					<button
						type="button"
						onClick={() => clearCard(d, pieces, item.k)}
						className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
			</header>
			<NicheControl d={d} pieces={pieces} k={item.k} />
		</section>
	)
}

/** The tab a filter lives in. */
export const tabOf = (pieces: Pieces, k: CardKey) => nicheFor(pieces).find((g) => g.items.some((i) => i.k === k))?.kind

/** More opens at the first kind with something set, else the first. */
export const firstTab = (pieces: Pieces) => {
	const set = pieces.chips.map((c) => cardOf(c.group)).find((k): k is CardKey => !!k && NICHE_KEYS.has(k))
	return (set && tabOf(pieces, set)) || nicheFor(pieces)[0].kind
}

function Tabs({ pieces, tab, onTab }: { pieces: Pieces; tab: string; onTab: (t: string) => void }) {
	return (
		<div role="tablist" aria-label="More filters" className="-mb-px flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			{nicheFor(pieces).map((g) => {
				const on = g.kind === tab
				const n = g.items.reduce((a, i) => a + chipsOf(pieces, i.k).length, 0)
				return (
					<button
						key={g.kind}
						type="button"
						role="tab"
						aria-selected={on}
						onClick={() => onTab(g.kind)}
						className={`flex h-12 shrink-0 cursor-pointer items-center gap-2 border-b-2 px-2.5 text-[14px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
							on ? "border-amber-400 text-white" : "border-transparent text-gray-400 hover:text-gray-100"
						}`}
					>
						{g.kind}
						{n > 0 && (
							<span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold tabular-nums text-gray-950">
								{n}
							</span>
						)}
					</button>
				)
			})}
		</div>
	)
}

/** Two columns per kind, the tallest filter on its own (Scores by source is four bars). */
function columnsOf(items: Item[]): Item[][] {
	if (items.length === 4) return [[items[0], items[2]], [items[1], items[3]]]
	const tall = items.find((i) => i.k === "sourceScores" || i.k === "themes") ?? items[0]
	return [[tall], items.filter((i) => i !== tall)]
}

function Columns({ items, render, phone }: { items: Item[]; render: (i: Item) => ReactNode; phone: boolean }) {
	if (phone) return <div className="flex flex-col gap-7">{items.map(render)}</div>
	const cols = columnsOf(items)
	return (
		<div className="grid grid-cols-2 gap-x-8">
			{cols.map((col, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: two fixed columns
				<div key={i} className="flex min-w-0 flex-col gap-6">
					{col.map(render)}
				</div>
			))}
		</div>
	)
}

export function MoreBody({
	d,
	pieces,
	tab,
	onTab,
	find,
	onFind,
	phone = false,
}: {
	d: ProtoDiscover
	pieces: Pieces
	tab: string
	onTab: (t: string) => void
	find: string
	onFind: (t: string) => void
	phone?: boolean
}) {
	const groups = nicheFor(pieces)
	const group = groups.find((g) => g.kind === tab) ?? groups[0]
	const finding = find.trim() !== ""
	const field = <FilterSearchField value={find} onChange={onFind} className={phone ? "" : "h-9 w-[300px] shrink-0"} />
	const body = finding ? (
		<FilterGroups data={pieces.groups} query={find} />
	) : (
		<motion.div
			key={group.kind}
			initial={{ opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.16 }}
			role="tabpanel"
			aria-label={group.kind}
		>
			<Columns phone={phone} items={group.items} render={(item) => <FilterTile key={item.k} d={d} pieces={pieces} item={item} />} />
		</motion.div>
	)
	if (phone)
		return (
			<div>
				{field}
				{!finding && (
					<div className="mt-2 border-b border-white/[0.08]">
						<Tabs pieces={pieces} tab={group.kind} onTab={onTab} />
					</div>
				)}
				<div className="pt-5">{body}</div>
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex shrink-0 items-center gap-4 border-b border-white/[0.08] pr-4 pl-4">
				{finding ? (
					<span className="flex h-12 items-center px-2.5 text-[14px] font-semibold text-white">Filters matching</span>
				) : (
					<Tabs pieces={pieces} tab={group.kind} onTab={onTab} />
				)}
				<div className="ml-auto">{field}</div>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-5 pb-6">
				{body}
			</div>
		</div>
	)
}
