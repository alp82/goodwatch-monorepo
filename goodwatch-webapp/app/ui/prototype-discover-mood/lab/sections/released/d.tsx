// PROTOTYPE (Discover lab) Released d: c's era board (New, Decades, Older, real counts on every tile) with a's year
// range beside it: the slider and From / To fields instead of steppers.
import { RangeSlider } from "~/ui/filter-bar/SheetControls"
import type { SectionProps } from "../../types"
import { YearField } from "./a"
import { eras } from "./c"
import { GroupLabel, ResetLink, Tile, YEAR_MIN, fmtYear, pad, sameRange, setYears, toggleYears, useRangeCounts, yearMax, yearRange } from "./parts"

export function ReleasedD({ d, phone }: SectionProps) {
	const range = yearRange(d.filters.state)
	const now = yearMax()
	const any = sameRange(range, [YEAR_MIN, now])
	const cols = eras()
	const flat = cols.flatMap((c) => c.items)
	const counts = useRangeCounts(
		d,
		"years",
		flat.map((e) => ({ ...(e.range[0] > YEAR_MIN ? { min: e.range[0] } : {}), ...(e.range[1] < now ? { max: e.range[1] } : {}) })),
	)
	const clamp = (y: number) => Math.min(now, Math.max(YEAR_MIN, Number.isFinite(y) ? Math.round(y) : YEAR_MIN))
	let i = 0
	const years = (
		<div className={phone ? "" : "border-l border-white/[0.07] pl-7"}>
			<GroupLabel right={<ResetLink show={!any} onClick={() => setYears(d, [YEAR_MIN, now])}>Any year</ResetLink>}>Years</GroupLabel>
			<RangeSlider label="Released" min={YEAR_MIN} max={now} step={1} value={range} format={fmtYear} onCommit={(r) => setYears(d, r)} />
			<div className="mt-5 flex items-end gap-3">
				<YearField label="From" value={range[0]} onCommit={(y) => setYears(d, [Math.min(clamp(y), range[1]), range[1]])} />
				<span className="pb-2.5 text-gray-600">to</span>
				<YearField label="To" value={range[1]} onCommit={(y) => setYears(d, [range[0], Math.max(clamp(y), range[0])])} />
			</div>
		</div>
	)
	return (
		<div className={`${pad(phone)} ${phone ? "flex flex-col gap-5" : "grid grid-cols-[1fr_1.4fr_1fr_340px] gap-6"}`}>
			{phone && years}
			{cols.map((col) => (
				<div key={col.id}>
					<GroupLabel>{col.label}</GroupLabel>
					<div className={`grid gap-2 ${col.id === "decades" || phone ? "grid-cols-2" : "grid-cols-1"}`}>
						{col.items.map((e) => {
							const n = counts[i++]
							return (
								<Tile
									key={e.label}
									label={e.label}
									sub={e.sub}
									count={n}
									active={sameRange(range, e.range)}
									onClick={() => toggleYears(d, e.range)}
									className={phone ? "" : "min-h-[58px]"}
								/>
							)
						})}
					</div>
				</div>
			))}
			{!phone && years}
		</div>
	)
}
