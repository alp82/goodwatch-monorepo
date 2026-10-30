// The panel footer, the same on every tab and sub-tab: the count with the hidden meter under it, the biggest one-tap
// recoveries while the list is short, every choice as a removable chip, Clear all, and the Show button. Desktop: one
// 68 px row. Phones: the count and chips over Clear all and Show.
import { PlusIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { FilterName, FilterState } from "~/domain/filter-state"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { compactCount, recoveryLabel } from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import { BarChips } from "./BarChips"
import { ShowButton } from "./ShowButton"
import { type BarChip, countWords, footerRecoveries } from "./chips"

export const FOOTER_HEIGHT = 68

/** "N titles", "N matches", "Top 100 matches" or "Counting…". */
export function CountText({
	counts,
	searching,
}: {
	counts: FilterBarCounts | null
	searching: boolean
}) {
	const { n, words, top } = countWords(counts?.total, searching)
	return (
		<span
			className="text-sm leading-5 whitespace-nowrap text-gray-400"
			aria-live="polite"
		>
			{n === null ? (
				words
			) : top ? (
				<>
					Top <span className="font-bold text-white">{n}</span> {words}
				</>
			) : (
				<>
					<RollingNumber value={n} className="font-bold text-white" /> {words}
				</>
			)}
		</span>
	)
}

export function Count({
	counts,
	searching,
}: {
	counts: FilterBarCounts | null
	searching: boolean
}) {
	const hidden = counts?.hidden ?? 0
	return (
		<span className="flex shrink-0 flex-col gap-1">
			<CountText counts={counts} searching={searching} />
			{/* Always there, so the footer keeps its height. */}
			<span className="flex h-3 items-center gap-2">
				<HiddenMeter counts={counts} className="w-14" />
				<span className="text-[11px] leading-none whitespace-nowrap text-gray-500">
					{hidden > 0 ? `${compactCount(hidden)} hidden` : ""}
				</span>
			</span>
		</span>
	)
}

export function PanelFooter({
	counts,
	searching,
	state,
	chips,
	clearCount,
	onOpen,
	onChange,
	onDrop,
	onClearSearch,
	onClearAll,
	onShow,
	phone = false,
}: {
	counts: FilterBarCounts | null
	searching: boolean
	state: FilterState
	chips: BarChip[]
	/** What Clear all clears (clearAllCount). */
	clearCount: number
	onOpen: (chip: BarChip) => void
	onChange: (change: (state: FilterState) => FilterState) => void
	/** A one-tap recovery: drops that filter group. */
	onDrop: (filter: FilterName) => void
	onClearSearch: () => void
	onClearAll: () => void
	/** The Show button: closes the panel. */
	onShow: () => void
	phone?: boolean
}) {
	const recoveries = footerRecoveries(
		counts?.total,
		counts?.recoveries,
		phone ? 1 : 2,
	)
	const line = (
		<div className="flex min-w-0 flex-1 items-center gap-3">
			<Count counts={counts} searching={searching} />
			{recoveries.map((r) => (
				<motion.button
					key={r.filter}
					type="button"
					whileTap={TAP}
					onClick={() => onDrop(r.filter)}
					className="flex shrink-0 items-center gap-1 rounded-md text-[13px] font-bold whitespace-nowrap text-amber-400 cursor-pointer outline-none hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<PlusIcon className="h-3.5 w-3.5" aria-hidden />
					<span className="sr-only">Show </span>
					{recoveryLabel(r.filter, r.titles, state)}
				</motion.button>
			))}
			<BarChips
				chips={chips}
				onOpen={onOpen}
				onChange={onChange}
				onClearSearch={onClearSearch}
				className="h-8"
			/>
		</div>
	)
	const clear = (
		<button
			type="button"
			onClick={onClearAll}
			disabled={!clearCount}
			className="shrink-0 rounded-md px-2 py-1 text-sm whitespace-nowrap text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
		>
			{clearCount ? `Clear all ${clearCount}` : "Clear all"}
		</button>
	)
	const show = (
		<ShowButton
			searching={searching}
			counts={counts}
			onClick={onShow}
			className={phone ? "h-11 flex-1" : "h-11 min-w-48 shrink-0"}
		/>
	)
	if (phone)
		return (
			<div className="flex shrink-0 flex-col gap-2.5 border-t border-white/[0.06] bg-gray-950/85 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
				{line}
				<div className="flex items-center gap-3">
					{clear}
					{show}
				</div>
			</div>
		)
	return (
		<div
			className="flex shrink-0 items-center gap-4 border-t border-white/[0.06] bg-gray-950/85 px-5"
			style={{ height: FOOTER_HEIGHT }}
		>
			{line}
			{clear}
			{show}
		</div>
	)
}
