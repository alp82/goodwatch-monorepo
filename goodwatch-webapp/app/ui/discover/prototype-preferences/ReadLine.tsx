// PROTOTYPE - throwaway (discover search preferences, see README.md). How the search read the words, on Discover's one
// reading line, after a fingerprint mark: everything the search read from the words (filters, preferences, and the
// remaining words it reads as text), the fingerprint qualities those switched-on words read as (Discover's own look),
// then your own filters. Each read item, including a run of plain words such as "epic", switches off and on. A read item switches off and on with a
// press (off: struck through, and the search no longer reads its words); your own filters keep their ×. Clear switches
// every read item off; Restore brings them back.
import { FingerPrintIcon } from "@heroicons/react/20/solid"
import type { ReadingChip } from "~/server/combined-search/reading-retrieval.server"
import type { BarChip } from "~/ui/discover-bar/chips"
import { Divider, Filter, Quality } from "~/ui/discover-bar/ReadingLine"
import type { Item } from "./interpretation"

function ReadItem({ item, onToggle, showField }: { item: Item; onToggle: () => void; showField: boolean }) {
	const title = !item.on
		? "Switched off: the search doesn't read these words. Press to switch on."
		: item.words
			? "Read as words: they shape the text and fingerprint ranking. Press to switch off."
			: item.soft
			? "Read from your search. Titles that fit rank higher; others still show. Press to switch off."
			: "Read from your search. Only matching titles show. Press to switch off."
	return (
		<button
			type="button"
			role="switch"
			aria-checked={item.on}
			onClick={onToggle}
			title={title}
			className="flex shrink-0 cursor-pointer items-baseline gap-[5px] rounded-md px-1 hover:bg-white/[0.05]"
		>
			{item.field && showField && (
				<span className={`text-[12px] ${item.on ? "text-[#92a5bf]" : "text-gray-600"}`}>{item.field}</span>
			)}
			<strong
				className={`text-[12px] font-[650] ${
					item.on
						? `text-white ${item.soft ? "underline decoration-white/35 decoration-dotted underline-offset-[3px]" : ""}`
						: "text-gray-500 line-through decoration-gray-500"
				}`}
			>
				{item.label}
			</strong>
			<span className="sr-only">{item.on ? (item.words ? ", words" : item.soft ? ", ranks higher" : ", filter") : ", off"}</span>
		</button>
	)
}

export function ReadLine({
	items,
	reading,
	chips,
	pending,
	onToggle,
	onAll,
	onRemoveChip,
	onOpenChip,
}: {
	items: readonly Item[]
	reading: readonly ReadingChip[]
	chips: readonly BarChip[]
	pending: boolean
	onToggle: (item: Item) => void
	/** Every read item off (true) or on again (false). */
	onAll: (off: boolean) => void
	onRemoveChip: (chip: BarChip) => void
	/** Advanced only: a filter's name opens it. */
	onOpenChip?: (chip: BarChip) => void
}) {
	const qualities = reading.filter((chip) => (chip.kind === "want" || chip.kind === "avoid") && chip.key)
	const itemKeys = new Set(items.filter((item) => item.on).flatMap((item) => item.chipKeys))
	const manual = chips.filter((chip) => chip.kind !== "query" && !itemKeys.has(chip.key))
	const anyOn = items.some((item) => item.on)
	if (!qualities.length && !items.length && !manual.length && !pending) return <div className="h-8 flex-1" />
	return (
		<div className="search-private ph-no-capture sentry-mask flex h-8 min-w-0 flex-1 items-center gap-3">
			<span className="flex shrink-0 items-center" title="How your search was read">
				<FingerPrintIcon className="h-4 w-4 text-amber-300/80" aria-hidden />
				<span className="sr-only">How your search was read:</span>
			</span>
			<div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto [scrollbar-width:none]">
				{pending && !qualities.length && !items.length && (
					<span className="shrink-0 text-[12px] text-gray-500">Reading…</span>
				)}
				{items.length > 0 && (
					<span className="flex shrink-0 items-center gap-x-2">
						{items.map((item, index) => (
							<ReadItem
								key={item.phrase}
								item={item}
								showField={index === 0 || items[index - 1].field !== item.field}
								onToggle={() => onToggle(item)}
							/>
						))}
					</span>
				)}
				{qualities.length > 0 && (
					<span className="flex shrink-0 items-center gap-x-[17px]" title="What the words switched on read as">
						{qualities.map((chip, index) => (
							<Quality key={`${chip.key}:${index}`} chip={chip} />
						))}
					</span>
				)}
				{manual.length > 0 && (items.length > 0 || qualities.length > 0) && <Divider />}
				{manual.length > 0 && (
					<span className="flex shrink-0 items-center gap-x-2">
						{manual.map((chip) => (
							<Filter
								key={chip.key}
								chip={chip}
								onOpen={onOpenChip && (() => onOpenChip(chip))}
								onRemove={() => onRemoveChip(chip)}
							/>
						))}
					</span>
				)}
			</div>
			{items.length > 0 && (
				<button
					type="button"
					onClick={() => onAll(anyOn)}
					title={anyOn ? "Switch off everything read from your search" : "Switch everything read from your search back on"}
					className="shrink-0 cursor-pointer rounded-md px-1.5 text-[12px] font-semibold text-gray-400 hover:bg-white/[0.05] hover:text-white"
				>
					{anyOn ? "Clear" : "Restore"}
				</button>
			)}
		</div>
	)
}
