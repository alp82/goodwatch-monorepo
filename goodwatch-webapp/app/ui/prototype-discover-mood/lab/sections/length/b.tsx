// PROTOTYPE (Discover lab) Length b: one time ruler from 0 to 4 h. Bars show how many titles run that long (real
// counts, everything else as is), named bands above it mark episodes and movies, and the slider under it lines up
// with the ruler. Tapping a bar or a band picks that span.
import { motion } from "framer-motion"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { RangeSlider } from "~/ui/filter-bar/SheetControls"
import type { SectionProps } from "../../types"
import { GroupLabel, ResetLink, pad, useRangeCounts } from "../released/parts"
import { LEN_MAX, asRange, fmtLen, isAnyLength, lengthRange, setLength, toggleLength } from "./parts"

const EDGES = [0, 25, 35, 50, 65, 80, 95, 110, 125, 150, 180, LEN_MAX]
const BINS: [number, number][] = EDGES.slice(1).map((hi, i) => [EDGES[i], hi])
const TICKS = [0, 30, 60, 90, 120, 150, 180, 210, LEN_MAX]

const BANDS: { label: string; range: [number, number] }[] = [
	{ label: "Short episodes", range: [0, 35] },
	{ label: "Hour episodes", range: [35, 65] },
	{ label: "Short movies", range: [65, 95] },
	{ label: "Most movies", range: [95, 125] },
	{ label: "Long movies", range: [125, 180] },
	{ label: "Epics", range: [180, LEN_MAX] },
]

const pct = (m: number) => (m / LEN_MAX) * 100

export function LengthB({ d, phone }: SectionProps) {
	const range = lengthRange(d.filters.state)
	const any = isAnyLength(range)
	const counts = useRangeCounts(
		d,
		"runtime",
		BINS.map((b) => asRange(b)),
	)
	const top = Math.max(1, ...counts.map((n) => n ?? 0))
	const on = (r: [number, number]) => !any && r[0] >= range[0] && r[1] <= range[1]
	return (
		<div className={`${pad(phone)} flex flex-col gap-3`}>
			<GroupLabel right={<ResetLink show={!any} onClick={() => setLength(d, [0, LEN_MAX])} />}>Movie or episode length</GroupLabel>
			<div className={phone ? "-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" : ""}>
				<div className={phone ? "w-[640px]" : ""}>
					<div className="relative h-9">
						{BANDS.map((b) => {
							const exact = range[0] === b.range[0] && range[1] === b.range[1]
							return (
								<motion.button
									key={b.label}
									type="button"
									whileTap={TAP}
									aria-pressed={exact}
									onClick={() => toggleLength(d, b.range)}
									className={`absolute top-0 flex h-8 items-center justify-center truncate rounded-full px-2 text-[12px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
										exact ? "bg-white font-semibold text-gray-950" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11]"
									}`}
									style={{ left: `calc(${pct(b.range[0])}% + 2px)`, width: `calc(${pct(b.range[1] - b.range[0])}% - 4px)` }}
								>
									{b.label}
								</motion.button>
							)
						})}
					</div>
					<div className={`relative mt-2 ${phone ? "h-28" : "h-[150px]"}`}>
						{BINS.map((b, i) => {
							const n = counts[i]
							const h = n == null ? 0.05 : Math.max(0.03, n / top)
							const lit = on(b)
							return (
								<motion.button
									key={b[0]}
									type="button"
									whileTap={TAP}
									aria-pressed={lit}
									aria-label={`${fmtLen(b[0])} to ${fmtLen(b[1])}${n == null ? "" : `, ${n.toLocaleString("en")} titles`}`}
									onClick={() => toggleLength(d, b)}
									className="group absolute bottom-0 top-0 flex flex-col justify-end cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md"
									style={{ left: `calc(${pct(b[0])}% + 1px)`, width: `calc(${pct(b[1] - b[0])}% - 2px)` }}
								>
									<span className={`mb-1 text-center text-[11px] tabular-nums ${lit ? "text-amber-300" : "text-gray-500"}`}>
										{n == null ? "" : compactCount(n)}
									</span>
									<span className="relative flex-1">
										<span
											className={`absolute inset-x-0 bottom-0 h-full origin-bottom rounded-t-md transition-[transform,background-color] duration-300 ${
												lit ? "bg-amber-400" : "bg-white/[0.12] group-hover:bg-white/25"
											}`}
											style={{ transform: `scaleY(${h})` }}
										/>
									</span>
								</motion.button>
							)
						})}
					</div>
					<div className="relative mt-1 h-5 border-t border-white/10">
						{TICKS.map((t) => (
							<span
								key={t}
								className="absolute top-1 -translate-x-1/2 text-[11px] tabular-nums text-gray-500 first:translate-x-0 last:-translate-x-full"
								style={{ left: `${pct(t)}%` }}
							>
								{t === 0 ? "0" : fmtLen(t)}
							</span>
						))}
					</div>
				</div>
			</div>
			<div className="mt-1">
				<RangeSlider label="Length" min={0} max={LEN_MAX} step={5} value={range} format={fmtLen} onCommit={(r) => setLength(d, r)} />
			</div>
		</div>
	)
}
