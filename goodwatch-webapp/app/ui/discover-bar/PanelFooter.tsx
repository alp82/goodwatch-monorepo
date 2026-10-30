// The panel footer, the same on every tab and sub-tab: every active filter as a removal pill (an x, its color, its name,
// and "+N" when removing it alone lets titles back in; the ones that bring back the most first), Clear all, and the
// Show button, which carries the count. Desktop: one 68 px row. Phones: the pills over Clear all and Show.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { FilterName, FilterState } from "~/domain/filter-state"
import { FILTER_ACCENTS, METER_COLORS } from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import { ShowButton } from "./ShowButton"
import { type BarChip, countWords } from "./chips"

export const FOOTER_HEIGHT = 68

/** "N titles", "N matches", "About N matches" or "Counting…". */
export function CountText({
	counts,
	searching,
}: {
	counts: FilterBarCounts | null
	searching: boolean
}) {
	const { n, words, about } = countWords(
		counts?.total,
		searching,
		counts?.searchEstimate,
	)
	return (
		<span
			className="text-sm leading-5 whitespace-nowrap text-gray-400"
			aria-live="polite"
		>
			{n === null ? (
				words
			) : about ? (
				<>
					About{" "}
					<span className="font-bold text-white">{n.toLocaleString("en")}</span>{" "}
					{words}
				</>
			) : (
				<>
					<RollingNumber value={n} className="font-bold text-white" /> {words}
				</>
			)}
		</span>
	)
}

/** A filter's color in the count's line and the footer's pills; amber stays for what shows. */
export function filterColor(group: FilterName | string): string {
	const meter = METER_COLORS[group as FilterName]
	if (meter) return meter
	const bar = FILTER_ACCENTS[group as FilterName]?.bar
	if (bar?.includes("orange")) return "bg-rose-500"
	return !bar || bar.includes("amber") ? "bg-gray-400" : bar
}

interface Removal {
	group: string
	label: string
	chips: BarChip[]
	/** What removing this filter alone lets back in. */
	gain: number
}

/** The chips by filter group, the groups that bring back the most first. */
export function removalsOf(
	chips: BarChip[],
	counts: FilterBarCounts | null,
): Removal[] {
	const out: Removal[] = []
	for (const chip of chips) {
		if (chip.kind === "query" || !chip.group) continue
		const at = out.find((r) => r.group === chip.group)
		if (at) {
			at.chips.push(chip)
			at.label = `${at.label} · ${chip.label}`
		} else
			out.push({
				group: chip.group,
				label: chip.label,
				chips: [chip],
				gain:
					counts?.recoveries.find((r) => r.filter === chip.group)?.titles ?? 0,
			})
	}
	return out.sort((a, b) => b.gain - a.gain)
}

export function PanelFooter({
	counts,
	searching,
	chips,
	clearCount,
	onChange,
	onClearAll,
	onShow,
	phone = false,
}: {
	counts: FilterBarCounts | null
	searching: boolean
	chips: BarChip[]
	/** What Clear all clears (clearAllCount). */
	clearCount: number
	onChange: (change: (state: FilterState) => FilterState) => void
	onClearAll: () => void
	/** The Show button: closes the panel. */
	onShow: () => void
	phone?: boolean
}) {
	const removals = removalsOf(chips, counts)
	const pills = (
		<div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			{removals.map((r) => (
				<motion.button
					key={r.group}
					type="button"
					whileTap={TAP}
					onClick={() =>
						onChange((s) =>
							r.chips.reduce((acc, c) => (c.remove ? c.remove(acc) : acc), s),
						)
					}
					aria-label={`Remove ${r.label}${r.gain ? `, shows ${r.gain.toLocaleString("en")} more` : ""}`}
					title={
						r.gain
							? `Remove to see ${r.gain.toLocaleString("en")} more`
							: "Remove"
					}
					className="group flex h-10 shrink-0 items-center gap-2 rounded-xl bg-white/[0.06] pr-3 pl-2.5 text-[13px] font-semibold whitespace-nowrap text-gray-100 cursor-pointer outline-none hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<XMarkIcon
						className="h-3.5 w-3.5 shrink-0 text-gray-500 group-hover:text-white"
						aria-hidden
					/>
					<span
						className={`h-2 w-2 shrink-0 rounded-full ${filterColor(r.group)}`}
						aria-hidden
					/>
					<span className="max-w-[180px] truncate group-hover:line-through group-hover:decoration-gray-400">
						{r.label}
					</span>
					{r.gain > 0 && (
						<span className="font-bold text-amber-300">
							+{r.gain.toLocaleString("en")}
						</span>
					)}
				</motion.button>
			))}
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
				{removals.length > 0 && pills}
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
			{pills}
			{clear}
			{show}
		</div>
	)
}
