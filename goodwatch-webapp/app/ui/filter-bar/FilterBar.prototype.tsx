// PROTOTYPE - throwaway. The desktop bar for the Filters sheet variants: For you and Sort as one split control, and
// the Filters button merged with the active filters into one row.
import { AdjustmentsHorizontalIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { ComponentProps } from "react"
import type { FilterState } from "~/domain/filter-state"
import { OneRowChips } from "./FilterGroups.prototype"
import { FingerprintTip, MovedUp } from "./ForYou"
import { SortControl } from "./controls"
import type { ActiveChip } from "./labels"
import { Knob, TAP } from "./motion"
import type { ForYouControl } from "./types"

/** For you | Sort in one shell: For you lights its half amber, Sort opens its menu from the other half. */
export function ForYouSortSplit({
	forYou,
	sort,
}: {
	forYou?: ForYouControl
	sort: ComponentProps<typeof SortControl>
}) {
	if (!forYou || forYou.replacement)
		return (
			<>
				{forYou?.replacement && <div className="flex h-12 shrink-0 items-center">{forYou.replacement}</div>}
				<SortControl {...sort} />
			</>
		)
	const { on, onChange, movedUp, explanation, disabled } = forYou
	const lit = on && !disabled
	return (
		<div
			className={`flex h-12 shrink-0 items-stretch rounded-2xl ring-1 transition-[background-color,box-shadow] duration-300 ${lit ? "bg-white/[0.04] ring-amber-500/40 shadow-[0_0_30px_-10px_rgba(245,158,11,.55)]" : "bg-white/[0.04] ring-white/10"}`}
		>
			<div className={`flex items-center rounded-l-2xl pl-1.5 transition-colors ${lit ? "bg-amber-500/[0.14]" : ""}`}>
				<FingerprintTip on={lit} explanation={explanation} />
				<motion.button
					type="button"
					role="switch"
					aria-checked={lit}
					aria-disabled={disabled || undefined}
					whileTap={disabled ? undefined : TAP}
					data-for-you-switch
					onClick={() => !disabled && onChange(!on)}
					className={`flex h-full items-center gap-2.5 pr-3.5 pl-1.5 text-sm font-bold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${disabled ? "cursor-not-allowed text-gray-500" : lit ? "cursor-pointer text-amber-100" : "cursor-pointer text-gray-400 hover:text-gray-200"}`}
				>
					For you
					<MovedUp on={lit} movedUp={movedUp} />
					<Knob on={lit} />
				</motion.button>
			</div>
			<span aria-hidden className="my-2.5 w-px bg-white/10" />
			<SortControl {...sort} bare />
		</div>
	)
}

/**
 * The Filters button and the active filters as one row: the button opens the sheet, each chip comes off with its ×,
 * what doesn't fit folds into "+N" (which opens the sheet), and Clear ends the row. Without filters the row says what
 * the sheet holds.
 */
export function FiltersRow({
	count,
	chips,
	state,
	onChange,
	onOpen,
	onClear,
	expanded,
}: {
	count: number
	chips: ActiveChip[]
	state: FilterState
	onChange: (state: FilterState) => void
	onOpen: () => void
	onClear: () => void
	expanded: boolean
}) {
	return (
		<div className="flex min-h-12 items-center gap-2 rounded-2xl bg-white/[0.04] p-1.5 ring-1 ring-white/10">
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={onOpen}
				aria-haspopup="dialog"
				aria-expanded={expanded}
				aria-label={count ? `Filters, ${count} active` : "Filters"}
				className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-white/[0.07] px-3 text-sm font-bold text-white cursor-pointer outline-none hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<AdjustmentsHorizontalIcon className="h-4 w-4" />
				Filters
				{count > 0 && (
					<span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs tabular-nums text-gray-950">
						{count}
					</span>
				)}
			</motion.button>
			{chips.length ? (
				<OneRowChips
					chips={chips}
					state={state}
					onChange={onChange}
					onMore={onOpen}
					className="flex-1"
					trailing={
						<button type="button" onClick={onClear} className="h-8 shrink-0 px-2 text-[13px] text-gray-500 cursor-pointer hover:text-white">
							Clear
						</button>
					}
				/>
			) : (
				<button type="button" onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-[13px] text-gray-500 cursor-pointer hover:text-gray-300">
					Genre, mood, score, year, length, streaming, cast…
				</button>
			)}
		</div>
	)
}
