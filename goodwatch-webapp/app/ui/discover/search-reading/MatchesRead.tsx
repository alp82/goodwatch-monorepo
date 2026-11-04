// The Matches popout's read parts while searching: every part the search read, each with the same switch as the read
// strip, with what each filter keeps out, then the fingerprint qualities the switched-on words read as. Loaded when the
// popout first opens (DiscoverPage).
import { useState } from "react"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import { HideNumber } from "~/ui/discover-bar/HideNumber"
import { Knob } from "~/ui/filter-bar/motion"
import { type ReadItem as Item, scopeOwner } from "./read-items"
import {
	ClearRead,
	ESTIMATE_TITLE,
	HIDES_TITLE,
	type HideCount,
	ItemMarker,
	PREFERRED_TITLE,
	QualityMark,
	SCOPE_COLOR,
	SCOPE_TITLE,
	itemNote,
	itemTitle,
	matchesOrder,
	qualitiesOf,
	readColor,
	sharedTitle,
} from "./read-parts"

const SHOW_FIRST = 6

/** In the Matches popout: every read part, each with its switch, then what the switched-on words read as. */
export default function MatchesRead({
	items,
	reading,
	onToggle,
	onAll,
	hides,
	outside,
}: {
	/** Titles outside this search's results that pass every filter (the answer's scope); null without one. */
	outside: number | null
	items: readonly Item[]
	reading: readonly ReadingChip[]
	onToggle: (item: Item) => void
	onAll: (off: boolean) => void
	/** Hard filters' hide counts by phrase (lowercase), from the answer that is on screen. */
	hides: ReadonlyMap<string, HideCount>
}) {
	const [all, setAll] = useState(false)
	if (!items.length) return null
	// The search's count belongs to one row, chosen before sorting, so sorting never moves it to another row.
	const owner = outside !== null && outside > 0 ? scopeOwner(items) : null
	const ownerLabel = owner ? (items.find((item) => item.phrase === owner)?.label ?? owner) : null
	// Rows with a count first, highest first (stable); the rest keep their order after them.
	const countOf = (item: Item): number | undefined =>
		item.phrase === owner && outside
			? outside
			: item.on && !item.aside && !item.soft && !item.words
				? hides.get(item.phrase.toLowerCase())?.n
				: undefined
	const ordered = matchesOrder(items)
		.map((item, index) => ({ item, index, n: countOf(item) }))
		.sort((a, b) =>
			a.n !== undefined && b.n !== undefined
				? b.n - a.n || a.index - b.index
				: a.n !== undefined
					? -1
					: b.n !== undefined
						? 1
						: a.index - b.index,
		)
		.map(({ item }) => item)
	const shown = all ? ordered : ordered.slice(0, SHOW_FIRST)
	const noteOf = (item: Item) =>
		item.phrase === owner && outside ? (
			<>
				hides <HideNumber n={outside} />
			</>
		) : (
			itemNote(item, hides.get(item.phrase.toLowerCase()))
		)
	const titleOf = (item: Item) =>
		item.phrase === owner
			? SCOPE_TITLE
			: item.on && !item.aside
				? item.words
					? ownerLabel
						? sharedTitle(ownerLabel)
						: itemTitle(item)
					: item.soft
						? PREFERRED_TITLE
						: hides.get(item.phrase.toLowerCase())?.approx
							? ESTIMATE_TITLE
							: HIDES_TITLE
				: itemTitle(item)
	// The search's scope (titles it doesn't bring in) is one count for the whole search: it sits on one row, the first
	// plain word switched on, else the first read preference switched on. Other words keep their switch, no number.
	const qualities = qualitiesOf(reading)
	return (
		<li className="mt-1">
			<div className="flex items-center justify-between">
				<span className="text-[11px] font-semibold tracking-[0.06em] text-gray-500 uppercase">Filters</span>
				<ClearRead items={items} onAll={onAll} className="-mr-2" />
			</div>
			<ul className="mt-1 flex flex-col">
				{shown.map((item) => [
					<li key={item.phrase} className="flex h-9 items-center">
						{item.aside ? (
							<span className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-0 text-left" title={itemTitle(item)}>
								<span className="grid w-2.5 shrink-0 place-items-center opacity-40"><ItemMarker item={item} /></span>
								<span className="min-w-0 flex-1 truncate text-gray-400 line-through decoration-gray-300 decoration-2">
									{item.field ? `${item.field} ` : ""}
									{item.label}
								</span>
								<span className="shrink-0 text-xs text-gray-500">{noteOf(item)}</span>
								<span className="w-[42px]" aria-hidden />
							</span>
						) : (
							<button
								type="button"
								role="switch"
								aria-checked={item.on}
								aria-label={`${item.field ? `${item.field} ` : ""}${item.label}`}
								title={titleOf(item)}
								onClick={() => onToggle(item)}
								className="-ml-2 flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg pr-1 pl-2 text-left outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span className={`grid w-2.5 shrink-0 place-items-center ${item.on ? "" : "opacity-40"}`}>
									{/* A hard filter's dot is its segment's color in the meter above. */}
									{item.phrase === owner ? (
										<span className={`h-2.5 w-2.5 rounded-full ${SCOPE_COLOR}`} aria-hidden />
									) : item.soft || item.words ? (
										<ItemMarker item={item} />
									) : (
										<span className={`h-2.5 w-2.5 rounded-full ${readColor(item)}`} aria-hidden />
									)}
								</span>
								<span className={`min-w-0 flex-1 truncate ${item.on ? "text-gray-200" : "text-gray-400 line-through decoration-gray-300 decoration-2"}`}>
									{item.field && <span className="text-gray-500">{item.field} </span>}
									{item.label}
								</span>
								<span className="shrink-0 text-xs tabular-nums text-gray-400">{noteOf(item)}</span>
								<span className="shrink-0 origin-center scale-75" aria-hidden>
									<Knob on={item.on} />
								</span>
							</button>
						)}
					</li>,
				])}
			</ul>
			{items.length > SHOW_FIRST && (
				<button type="button" onClick={() => setAll(!all)} className="mt-0.5 cursor-pointer text-xs font-semibold text-amber-400 hover:text-amber-300">
					{all ? "Show fewer" : `Show all ${items.length}`}
				</button>
			)}
			{qualities.length > 0 && (
				<div className="mt-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
					<p className="text-[11px] text-gray-500">Search based on</p>
					<div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1.5">
						{qualities.map((chip, i) => (
							<QualityMark key={`${chip.key}:${i}`} chip={chip} size="sm" />
						))}
					</div>
				</div>
			)}
		</li>
	)
}
