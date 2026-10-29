// Shared hidden-title meter and recovery rows for Discover's footer and empty results.
import { motion, useReducedMotion } from "framer-motion"
import type { FilterName, FilterState } from "~/domain/filter-state"
import { FILTER_ACCENTS, METER_COLORS, recoveryLabel } from "./labels"
import { METER_TRANSITION, TAP } from "./motion"
import type { FilterBarCounts } from "./types"

/** A thin proportional bar: amber for what shows, then what each recovery would let back in. */
export function HiddenMeter({
	counts,
	className = "",
}: {
	counts: FilterBarCounts | null
	className?: string
}) {
	// Layout animation keeps running under MotionConfig reducedMotion; with reduced motion the meter just takes its width.
	const layout = !useReducedMotion()
	const universe = counts ? counts.total + counts.hidden : 0
	const share = (n: number) => `${universe ? (n / universe) * 100 : 0}%`
	return (
		<div
			aria-hidden
			className={`flex h-1.5 overflow-hidden rounded-full bg-white/5 ${className}`}
		>
			<motion.div
				layout={layout}
				transition={METER_TRANSITION}
				className="h-full bg-amber-500"
				style={{ width: share(counts?.total ?? 0) }}
			/>
			{counts?.recoveries.map((r) => (
				<motion.div
					layout={layout}
					key={r.filter}
					transition={METER_TRANSITION}
					className={`ml-px h-full opacity-70 ${METER_COLORS[r.filter] ?? "bg-gray-500"}`}
					style={{ width: share(r.titles) }}
				/>
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
