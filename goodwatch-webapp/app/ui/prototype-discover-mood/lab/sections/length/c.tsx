// PROTOTYPE (Discover lab) Length c: the time you have. Pick movies, shows or both (the real type filter), then one
// big row of times, read as "up to" or "at least". The steps follow the type: episode lengths for shows, movie
// lengths for movies.
import { motion } from "framer-motion"
import { useState } from "react"
import type { FilterState } from "~/domain/filter-state"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { Segmented } from "~/ui/filter-bar/SheetControls"
import type { SectionProps } from "../../types"
import { GroupLabel, ResetLink, pad, useRangeCounts } from "../released/parts"
import { LEN_MAX, asRange, fmtLen, isAnyLength, lengthRange, setLength } from "./parts"

type Mode = "upTo" | "atLeast"

const STEPS: Record<FilterState["type"], number[]> = {
	movie: [80, 90, 100, 110, 120, 150, 180],
	show: [20, 25, 30, 35, 45, 50, 60],
	all: [25, 45, 60, 90, 120, 150, 180],
}

export function LengthC({ d, phone }: SectionProps) {
	const s = d.filters.state
	const range = lengthRange(s)
	const any = isAnyLength(range)
	const [mode, setMode] = useState<Mode>(s.runtime?.min !== undefined && s.runtime?.max === undefined ? "atLeast" : "upTo")
	const steps = STEPS[s.type]
	const rangeFor = (m: number): [number, number] => (mode === "upTo" ? [0, m] : [m, LEN_MAX])
	const counts = useRangeCounts(
		d,
		"runtime",
		steps.map((m) => asRange(rangeFor(m))),
	)
	const typeCount = (t: string) => d.counts?.optionCounts.type?.[t] ?? null
	const switchMode = (m: Mode) => {
		setMode(m)
		// Keeps the chosen time, read the other way.
		const t = mode === "upTo" ? range[1] : range[0]
		if (!any && t > 0 && t < LEN_MAX) setLength(d, m === "upTo" ? [0, t] : [t, LEN_MAX])
	}
	return (
		<div className={`${pad(phone)} flex flex-col gap-5`}>
			<div className={phone ? "flex flex-col gap-4" : "grid grid-cols-2 gap-8"}>
				<div>
					<GroupLabel>For</GroupLabel>
					<Segmented
						label="Movies or shows"
						value={s.type}
						onChange={(type) => d.filters.set({ type })}
						options={[
							{ id: "movie", label: "Movies", count: typeCount("movie") },
							{ id: "show", label: "Episodes of shows", count: typeCount("show") },
							{ id: "all", label: "Both", count: typeCount("all") },
						]}
					/>
				</div>
				<div>
					<GroupLabel right={<ResetLink show={!any} onClick={() => setLength(d, [0, LEN_MAX])} />}>Length</GroupLabel>
					<Segmented
						label="Length reads as"
						value={mode}
						onChange={switchMode}
						options={[
							{ id: "upTo", label: "Up to" },
							{ id: "atLeast", label: "At least" },
						]}
					/>
				</div>
			</div>
			<div className={phone ? "grid grid-cols-3 gap-2" : "grid grid-cols-8 gap-2.5"}>
				{steps.map((m, i) => {
					const r = rangeFor(m)
					const active = range[0] === r[0] && range[1] === r[1]
					const n = counts[i]
					return (
						<motion.button
							key={`${mode}-${m}`}
							type="button"
							aria-pressed={active}
							whileTap={TAP}
							onClick={() => setLength(d, active ? [0, LEN_MAX] : r)}
							className={`flex flex-col items-center justify-center gap-1 rounded-2xl outline-none cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${phone ? "h-20" : "h-28"} ${
								active ? "bg-white text-gray-950" : n === 0 ? "bg-white/[0.02] text-gray-600" : "bg-white/[0.06] text-gray-100 hover:bg-white/[0.11]"
							}`}
						>
							<span className={`text-[11px] ${active ? "text-gray-600" : "text-gray-500"}`}>{mode === "upTo" ? "Up to" : "At least"}</span>
							<span className={`${phone ? "text-[18px]" : "text-[22px]"} font-semibold tabular-nums`}>{fmtLen(m)}</span>
							<span className={`text-[11px] tabular-nums ${active ? "text-gray-600" : "text-gray-500"}`}>{n == null ? " " : compactCount(n)}</span>
						</motion.button>
					)
				})}
				<motion.button
					type="button"
					aria-pressed={any}
					whileTap={TAP}
					onClick={() => setLength(d, [0, LEN_MAX])}
					className={`flex flex-col items-center justify-center rounded-2xl outline-none cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${phone ? "h-20" : "h-28"} ${
						any ? "bg-white text-gray-950" : "bg-white/[0.06] text-gray-100 hover:bg-white/[0.11]"
					}`}
				>
					<span className={`${phone ? "text-[18px]" : "text-[22px]"} font-semibold`}>Any</span>
				</motion.button>
			</div>
			{!any && !steps.some((m) => {
				const r = rangeFor(m)
				return range[0] === r[0] && range[1] === r[1]
			}) && (
				<p className="text-[13px] text-gray-400">
					Custom:{" "}
					{range[0] <= 0 ? `up to ${fmtLen(range[1])}` : range[1] >= LEN_MAX ? `at least ${fmtLen(range[0])}` : `${fmtLen(range[0])} to ${fmtLen(range[1])}`}
				</p>
			)}
		</div>
	)
}
