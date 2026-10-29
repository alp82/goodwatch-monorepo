// PROTOTYPE (Discover lab) Released b: decades as a histogram. Each decade is a bar with its real count (what that
// decade would leave, everything else as is); tapping one picks it, tapping a neighbor widens the span, tapping an end
// narrows it. Recent picks sit above, the year slider below for exact years.
import { motion } from "framer-motion"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { RangeSlider } from "~/ui/filter-bar/SheetControls"
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import { GroupLabel, ResetLink, Tile, YEAR_MIN, fmtYear, pad, sameRange, setYears, toggleYears, useRangeCounts, yearMax, yearRange } from "./parts"

export const DECADES = Array.from({ length: Math.floor(yearMax() / 10) - 192 + 1 }, (_, i) => 1920 + i * 10)
export const decadeRange = (start: number): [number, number] => [start, Math.min(start + 9, yearMax())]

/** The decades the range covers exactly, as [first, last] decade starts; null when it isn't decade-aligned. */
export function decadeSpan([lo, hi]: [number, number]): [number, number] | null {
	const now = yearMax()
	if (lo <= YEAR_MIN && hi >= now) return null
	if (lo % 10 !== 0) return null
	if (hi !== now && hi % 10 !== 9) return null
	return [lo, hi === now ? Math.floor(now / 10) * 10 : hi - 9]
}

/** Taps a decade: picks it, widens the span from a neighbor, narrows it from an end, or clears it when alone. */
export function tapDecade(d: ProtoDiscover, y: number) {
	const now = yearMax()
	const span = decadeSpan(yearRange(d.filters.state))
	if (!span) return setYears(d, decadeRange(y))
	const [a, b] = span
	if (a === b && a === y) return setYears(d, [YEAR_MIN, now])
	if (y === a - 10) return setYears(d, [y, decadeRange(b)[1]])
	if (y === b + 10) return setYears(d, [a, decadeRange(y)[1]])
	if (y === a && b > a) return setYears(d, [a + 10, decadeRange(b)[1]])
	if (y === b && b > a) return setYears(d, [a, decadeRange(b - 10)[1]])
	setYears(d, decadeRange(y))
}

export function ReleasedB({ d, phone }: SectionProps) {
	const range = yearRange(d.filters.state)
	const now = yearMax()
	const any = sameRange(range, [YEAR_MIN, now])
	const counts = useRangeCounts(
		d,
		"years",
		DECADES.map((y) => {
			const [a, b] = decadeRange(y)
			return { min: a, ...(b < now ? { max: b } : {}) }
		}),
	)
	const top = Math.max(1, ...counts.map((n) => n ?? 0))
	const recent: { label: string; sub: string; range: [number, number] }[] = [
		{ label: "This year", sub: String(now), range: [now, now] },
		{ label: "Last 3 years", sub: `Since ${now - 3}`, range: [now - 3, now] },
		{ label: "Last 5 years", sub: `Since ${now - 5}`, range: [now - 5, now] },
		{ label: "Last 10 years", sub: `Since ${now - 10}`, range: [now - 10, now] },
	]
	const recentCounts = useRangeCounts(
		d,
		"years",
		recent.map((r) => ({ min: r.range[0] })),
	)

	const inRange = (y: number) => {
		const [a, b] = decadeRange(y)
		return !any && a <= range[1] && b >= range[0]
	}

	return (
		<div className={`${pad(phone)} flex flex-col ${phone ? "gap-5" : "gap-4"}`}>
			<div>
				<GroupLabel right={<ResetLink show={!any} onClick={() => setYears(d, [YEAR_MIN, now])} />}>New</GroupLabel>
				<div className={phone ? "grid grid-cols-2 gap-2" : "grid grid-cols-4 gap-2.5"}>
					{recent.map((r, i) => (
						<Tile
							key={r.label}
							label={r.label}
							sub={r.sub}
							count={recentCounts[i]}
							active={sameRange(range, r.range)}
							onClick={() => toggleYears(d, r.range)}
						/>
					))}
				</div>
			</div>
			<div className="min-h-0 flex-1">
				<GroupLabel>Decades</GroupLabel>
				<div
					className="grid items-end gap-1"
					style={{ gridTemplateColumns: `repeat(${DECADES.length}, minmax(0, 1fr))`, height: phone ? 132 : 150 }}
				>
					{DECADES.map((y, i) => {
						const n = counts[i]
						const on = inRange(y)
						const h = n == null ? 0.06 : Math.max(0.04, n / top)
						return (
							<motion.button
								key={y}
								type="button"
								aria-pressed={on}
								aria-label={`${y}s${n == null ? "" : `, ${n.toLocaleString("en")} titles`}`}
								whileTap={TAP}
								onClick={() => tapDecade(d, y)}
								className="group flex h-full flex-col items-stretch justify-end gap-1 rounded-lg px-0.5 pt-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span className={`text-center text-[11px] tabular-nums ${on ? "text-amber-300" : "text-gray-500"} ${phone ? "hidden" : ""}`}>
									{n == null ? "" : compactCount(n)}
								</span>
								<span className="relative flex-1">
									<span
										className={`absolute inset-x-0 bottom-0 h-full origin-bottom rounded-md transition-[transform,background-color] duration-300 ${
											on ? "bg-amber-400" : "bg-white/[0.12] group-hover:bg-white/25"
										}`}
										style={{ transform: `scaleY(${h})` }}
									/>
								</span>
								<span className={`text-center text-[12px] tabular-nums ${on ? "font-semibold text-white" : "text-gray-400"}`}>
									{phone ? `’${String(y).slice(2)}` : `${y}s`}
								</span>
							</motion.button>
						)
					})}
				</div>
			</div>
			<div className={phone ? "" : "px-1"}>
				<RangeSlider label="Released" min={YEAR_MIN} max={now} step={1} value={range} format={fmtYear} onCommit={(r) => setYears(d, r)} />
			</div>
		</div>
	)
}
