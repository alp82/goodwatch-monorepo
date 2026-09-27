// Under the row: removable chips for every active filter, and the hidden-titles insight ("31 showing, 53 hidden by
// your filters") with the two largest one-tap recoveries.
import { PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import type { ReactNode } from "react"
import type { FilterName, FilterState } from "~/domain/filter-state"
import {
	type ActiveChip,
	FILTER_ACCENTS,
	METER_COLORS,
	recoveryLabel,
} from "./labels"
import { METER_TRANSITION, RollingNumber, SPRING, TAP } from "./motion"
import type { FilterBarCounts } from "./types"

/** A thin proportional bar: amber for what shows, then what each recovery would let back in. */
export function HiddenMeter({
	counts,
	className = "",
}: {
	counts: FilterBarCounts | null
	className?: string
}) {
	const universe = counts ? counts.total + counts.hidden : 0
	const share = (n: number) => `${universe ? (n / universe) * 100 : 0}%`
	return (
		<div
			aria-hidden
			className={`flex h-1.5 overflow-hidden rounded-full bg-white/5 ${className}`}
		>
			<motion.div
				layout
				transition={METER_TRANSITION}
				className="h-full bg-amber-500"
				style={{ width: share(counts?.total ?? 0) }}
			/>
			{counts?.recoveries.map((r) => (
				<motion.div
					layout
					key={r.filter}
					transition={METER_TRANSITION}
					className={`ml-px h-full opacity-70 ${METER_COLORS[r.filter] ?? "bg-gray-500"}`}
					style={{ width: share(r.titles) }}
				/>
			))}
		</div>
	)
}

/** Removable chips, one per active filter, and Clear filters. */
export function FilterChips({
	chips,
	state,
	onChange,
	onClear,
	lead,
	className = "",
}: {
	chips: ActiveChip[]
	state: FilterState
	onChange: (state: FilterState) => void
	onClear: () => void
	/** A first chip the surface adds, for example Watch next's mood. */
	lead?: ReactNode
	className?: string
}) {
	return (
		<AnimatePresence initial={false}>
			{(chips.length > 0 || lead) && (
				<motion.div
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: "auto" }}
					exit={{ opacity: 0, height: 0 }}
					className={`overflow-hidden ${className}`}
				>
					<ul
						aria-label="Active filters"
						className="flex flex-wrap items-center gap-2 pt-1"
					>
						{lead}
						<AnimatePresence initial={false} mode="popLayout">
							{chips.map((chip) => (
								<motion.li
									layout
									key={chip.key}
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.85 }}
									transition={SPRING}
								>
									<motion.button
										type="button"
										whileTap={TAP}
										onClick={() => onChange(chip.remove(state))}
										aria-label={`Remove ${chip.label}`}
										className="group flex h-8 items-center gap-2 rounded-full bg-white/[0.06] pl-3 pr-2 text-sm text-gray-100 ring-1 ring-white/10 cursor-pointer outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400"
									>
										<span
											className={`h-1.5 w-1.5 rounded-full ${FILTER_ACCENTS[chip.group].dot}`}
										/>
										{chip.label}
										<XMarkIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-white" />
									</motion.button>
								</motion.li>
							))}
						</AnimatePresence>
						{chips.length > 0 && (
							<li>
								<button
									type="button"
									onClick={onClear}
									className="ml-1 text-sm text-gray-500 cursor-pointer hover:text-white"
								>
									Clear filters
								</button>
							</li>
						)}
					</ul>
				</motion.div>
			)}
		</AnimatePresence>
	)
}

/** "N showing" (or "N matches" on a search), ", M hidden by your filters". */
export function CountLine({
	counts,
	searching = false,
}: {
	counts: FilterBarCounts | null
	searching?: boolean
}) {
	if (!counts) return <span className="text-sm text-gray-500">Counting…</span>
	return (
		<span className="text-sm text-gray-400">
			<RollingNumber value={counts.total} className="font-bold text-white" />{" "}
			{searching ? (counts.total === 1 ? "match" : "matches") : "showing"}
			{counts.hidden > 0 && (
				<>
					, <RollingNumber value={counts.hidden} /> hidden by your filters
				</>
			)}
		</span>
	)
}

/** The insight line: meter, count, and the two largest one-tap recoveries. */
export function HiddenInsight({
	counts,
	state,
	onDrop,
	searching = false,
	lead,
	className = "",
}: {
	counts: FilterBarCounts | null
	state: FilterState
	onDrop: (filter: FilterName) => void
	searching?: boolean
	lead?: ReactNode
	className?: string
}) {
	const top = counts?.recoveries.slice(0, 2) ?? []
	return (
		<div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
			{lead}
			<div className="flex items-center gap-3" aria-live="polite">
				<HiddenMeter counts={counts} className="w-32" />
				<CountLine counts={counts} searching={searching} />
			</div>
			{top.map((r) => (
				<motion.button
					key={r.filter}
					type="button"
					whileTap={TAP}
					onClick={() => onDrop(r.filter)}
					className="flex items-center gap-1.5 rounded-md text-sm font-bold text-amber-400 cursor-pointer outline-none hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<PlusIcon className="h-3.5 w-3.5" />
					<span className="sr-only">Show </span>
					{recoveryLabel(r.filter, r.titles, state)}
				</motion.button>
			))}
		</div>
	)
}

/** Recoveries as a list of rows, for the phone's sheet and empty results. */
export function RecoveryList({
	counts,
	state,
	onDrop,
	limit = 3,
}: {
	counts: FilterBarCounts | null
	state: FilterState
	onDrop: (filter: FilterName) => void
	limit?: number
}) {
	if (!counts?.recoveries.length)
		return (
			<p className="px-1 text-sm text-gray-400">
				Nothing is hidden by a single filter.
			</p>
		)
	return (
		<div className="flex flex-col">
			{counts.recoveries.slice(0, limit).map((r) => (
				<motion.button
					key={r.filter}
					type="button"
					whileTap={TAP}
					onClick={() => onDrop(r.filter)}
					className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left cursor-pointer outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<span
						className={`h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[r.filter].dot}`}
					/>
					<span className="flex-1 text-sm text-gray-200">
						{recoveryLabel(r.filter, r.titles, state)}
					</span>
					<span className="text-xs font-bold text-amber-400 group-hover:text-amber-300">
						Show
					</span>
				</motion.button>
			))}
		</div>
	)
}
