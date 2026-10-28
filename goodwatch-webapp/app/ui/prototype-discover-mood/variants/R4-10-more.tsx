// PROTOTYPE - throwaway. Round 4 variant 10: More as an accordion. "Find a filter" is the first row; then one row per
// kind of niche filter. One kind is open at a time and shows its filters as real controls in two columns; the others
// stay one line each, with their set values (or the names of what's inside). Typing in Find a filter swaps the rows
// for the matches from every filter.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import { FilterGroups, FilterSearchField } from "~/ui/filter-bar"
import { type CardKey, cardOf } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import type { ProtoDiscover } from "../kit"
import { NICHE_KEYS, NicheControl, type Pieces, chipsOf, clearCard, nicheFor } from "./R4-10-parts"

type Item = { k: CardKey; title: string; hint: string }

const valueText = (pieces: Pieces, k: CardKey) =>
	chipsOf(pieces, k)
		.map((c) => c.label.replace(/^(About|Style|Theme|Similar to|Like|Loved|Disliked|With|Produced in) /, ""))
		.join(", ")

/** One niche filter: its name with the current value (or a hint), Clear, and the real control under it. */
function FilterTile({ d, pieces, item }: { d: ProtoDiscover; pieces: Pieces; item: Item }) {
	const value = valueText(pieces, item.k)
	return (
		<section aria-label={item.title} className="min-w-0">
			<header className="mb-2 flex h-6 min-w-0 items-center gap-2">
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

/** The kind More opens at: the first with something set, else the first. */
export const firstGroup = (pieces: Pieces) => {
	const set = pieces.chips.map((c) => cardOf(c.group)).find((k): k is CardKey => !!k && NICHE_KEYS.has(k))
	return nicheFor(pieces).find((g) => g.items.some((i) => i.k === set))?.kind ?? nicheFor(pieces)[0].kind
}

/** Two columns per kind, the tallest filter on its own (Scores by source is four bars). */
function columnsOf(items: Item[]): Item[][] {
	if (items.length === 4) return [[items[0], items[2]], [items[1], items[3]]]
	const tall = items.find((i) => i.k === "sourceScores" || i.k === "themes") ?? items[0]
	return [[tall], items.filter((i) => i !== tall)]
}

function Columns({ items, render, phone }: { items: Item[]; render: (i: Item) => ReactNode; phone: boolean }) {
	if (phone) return <div className="flex flex-col gap-6">{items.map(render)}</div>
	const cols = columnsOf(items)
	return (
		<div className="grid grid-cols-2 gap-x-10">
			{cols.map((col, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: two fixed columns
				<div key={i} className="flex min-w-0 flex-col gap-5">
					{col.map(render)}
				</div>
			))}
		</div>
	)
}

function GroupRow({
	pieces,
	kind,
	items,
	open,
	onClick,
}: { pieces: Pieces; kind: string; items: Item[]; open: boolean; onClick: () => void }) {
	const set = items.map((i) => ({ i, v: valueText(pieces, i.k) })).filter((x) => x.v)
	return (
		<button
			type="button"
			onClick={onClick}
			aria-expanded={open}
			className={`group flex h-10 w-full min-w-0 shrink-0 items-center gap-3 rounded-xl px-3 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				open ? "" : "hover:bg-white/[0.04]"
			}`}
		>
			<ChevronDownIcon
				className={`h-4 w-4 shrink-0 transition-transform ${open ? "text-gray-200" : "-rotate-90 text-gray-600 group-hover:text-gray-300"}`}
				aria-hidden
			/>
			<span className={`shrink-0 text-[14px] font-semibold ${open || set.length ? "text-white" : "text-gray-300 group-hover:text-white"}`}>
				{kind}
			</span>
			{set.length > 0 && (
				<span className="grid h-4.5 min-w-4.5 shrink-0 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold tabular-nums text-gray-950">
					{set.reduce((a, x) => a + chipsOf(pieces, x.i.k).length, 0)}
				</span>
			)}
			{!open && (
				<span className={`min-w-0 flex-1 truncate text-[13px] ${set.length ? "text-amber-200/90" : "text-gray-500"}`}>
					{set.length ? set.map((x) => `${x.i.title}: ${x.v}`).join(" · ") : items.map((i) => i.title).join(", ")}
				</span>
			)}
		</button>
	)
}

export function MoreAccordion({
	d,
	pieces,
	open,
	onOpen,
	find,
	onFind,
	phone = false,
}: {
	d: ProtoDiscover
	pieces: Pieces
	open: string
	onOpen: (kind: string) => void
	find: string
	onFind: (t: string) => void
	phone?: boolean
}) {
	const groups = nicheFor(pieces)
	const finding = find.trim() !== ""
	return (
		<div className={phone ? "" : "flex h-full min-h-0 flex-col px-5 pt-4"}>
			<div className={`shrink-0 ${phone ? "mb-2" : "mb-2 px-1"}`}>
				<FilterSearchField value={find} onChange={onFind} className="h-10" />
			</div>
			{finding ? (
				<div className={phone ? "pt-3" : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pt-3 pb-5"}>
					<FilterGroups data={pieces.groups} query={find} />
				</div>
			) : (
				<div className={phone ? "flex flex-col" : "flex min-h-0 flex-1 flex-col"}>
					{groups.map((g) => {
						const on = g.kind === open
						return (
							<div
								key={g.kind}
								className={`flex min-w-0 flex-col border-t border-white/[0.06] first:border-t-0 ${on && !phone ? "min-h-0 flex-1" : ""}`}
							>
								<GroupRow pieces={pieces} kind={g.kind} items={g.items} open={on} onClick={() => onOpen(g.kind)} />
								{on && (
									<motion.div
										initial={{ opacity: 0, y: -4 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.16 }}
										className={phone ? "px-3 pt-1 pb-6" : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-1 pb-4 pl-10"}
									>
										<Columns phone={phone} items={g.items} render={(item) => <FilterTile key={item.k} d={d} pieces={pieces} item={item} />} />
									</motion.div>
								)}
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
