// The panel footer, the same on every tab and sub-tab: the count with the hidden meter under it, the biggest one-tap
// recoveries while the list is short, every choice as a removable chip, Clear all, and the Show button. Desktop: one
// 68 px row. Phones: the count and chips over Clear all and Show.
import { PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { FilterName, FilterState } from "~/domain/filter-state"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { compactCount, recoveryLabel } from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import { BarChips } from "./BarChips"
import { ShowButton } from "./ShowButton"
import { type BarChip, countWords, footerRecoveries } from "./chips"
import { colorOf } from "./prototype-essentials/FilterMix"

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
	look = "a",
	mix,
}: {
	/**
	 * PROTOTYPE footer looks (`?footer=`): a today; b the header's count + line, recoveries as links, no chips; c the
	 * same with recoveries as pills in their filter's color; d no count (the Show button has it), recovery pills only.
	 */
	look?: "a" | "b" | "c" | "d"
	/** PROTOTYPE: the header's count with its line and popout (FilterMix). */
	mix?: React.ReactNode
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
	const recoveries =
		look === "a"
			? footerRecoveries(counts?.total, counts?.recoveries, phone ? 1 : 2)
			: footerRecoveries(counts?.total, counts?.recoveries, phone ? 2 : 3)
	const pills = (
		<div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none]">
			{recoveries.map((r) => (
				<motion.button
					key={r.filter}
					type="button"
					whileTap={TAP}
					onClick={() => onDrop(r.filter)}
					className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-[13px] font-semibold whitespace-nowrap text-gray-100 cursor-pointer outline-none hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<span className={`h-2 w-2 shrink-0 rounded-full ${colorOf(r.filter)}`} aria-hidden />
					<span className="sr-only">Show </span>
					<span className="font-bold text-amber-300">+{r.titles.toLocaleString("en")}</span>
					{recoveryLabel(r.filter, r.titles, state).replace(/^[\d,.k]+\s*/, "")}
				</motion.button>
			))}
		</div>
	)
	const links = (
		<div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto [scrollbar-width:none]">
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
		</div>
	)
	// d: every active filter as a removal pill, the ones that bring back the most first. "+N": what removing it alone
	// lets back in.
	const groups: { group: string; label: string; chips: BarChip[]; gain: number }[] = []
	for (const chip of chips) {
		if (chip.kind === "query" || !chip.group) continue
		const at = groups.find((g) => g.group === chip.group)
		if (at) {
			at.chips.push(chip)
			at.label = `${at.label} · ${chip.label}`
		} else
			groups.push({
				group: chip.group,
				label: chip.label,
				chips: [chip],
				gain: counts?.recoveries.find((r) => r.filter === chip.group)?.titles ?? 0,
			})
	}
	groups.sort((a, b) => b.gain - a.gain)
	const removals = (
		<div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none]">
			{groups.map((g) => (
				<motion.button
					key={g.group}
					type="button"
					whileTap={TAP}
					onClick={() => onChange((s) => g.chips.reduce((acc, c) => (c.remove ? c.remove(acc) : acc), s))}
					aria-label={`Remove ${g.label}${g.gain ? `, shows ${g.gain} more` : ""}`}
					title={g.gain ? `Remove to see ${g.gain.toLocaleString("en")} more` : "Remove"}
					className="group flex h-10 shrink-0 items-center gap-2 rounded-xl bg-white/[0.06] pr-3 pl-2.5 text-[13px] font-semibold whitespace-nowrap text-gray-100 cursor-pointer outline-none hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon className="h-3.5 w-3.5 shrink-0 text-gray-500 group-hover:text-white" aria-hidden />
					<span className={`h-2 w-2 shrink-0 rounded-full ${colorOf(g.group)}`} aria-hidden />
					<span className="max-w-[180px] truncate group-hover:line-through group-hover:decoration-gray-400">{g.label}</span>
					{g.gain > 0 && <span className="font-bold text-amber-300">+{g.gain.toLocaleString("en")}</span>}
				</motion.button>
			))}
		</div>
	)
	const line = look !== "a" ? (
		<div className="flex min-w-0 flex-1 items-center gap-4">
			{look !== "d" && mix}
			{look === "b" ? links : look === "d" ? removals : pills}
		</div>
	) : (
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
