// PROTOTYPE (Discover lab) Released a: quick picks on the left (the real presets with counts, plus year ranges the
// years filter expresses), the year range on the right with the slider and from/to fields.
import { RELEASED } from "~/domain/filter-state"
import { RELEASED_LABELS } from "~/ui/filter-bar/labels"
import { Chip, RangeSlider } from "~/ui/filter-bar/SheetControls"
import type { SectionProps } from "../../types"
import { GroupLabel, ResetLink, YEAR_MIN, fmtYear, pad, sameRange, setYears, toggleYears, useRangeCounts, yearMax, yearRange } from "./parts"

export function extraPicks(): { label: string; range: [number, number] }[] {
	const now = yearMax()
	return [
		{ label: "This year", range: [now, now] },
		{ label: "Last 5 years", range: [now - 5, now] },
		{ label: "Last 10 years", range: [now - 10, now] },
		{ label: "1990s", range: [1990, 1999] },
		{ label: "1980s", range: [1980, 1989] },
		{ label: "Before 1980", range: [YEAR_MIN, 1979] },
	]
}

export function YearField({ label, value, onCommit }: { label: string; value: number; onCommit: (y: number) => void }) {
	return (
		<label className="flex flex-col gap-1">
			<span className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">{label}</span>
			<input
				key={value}
				type="number"
				inputMode="numeric"
				min={YEAR_MIN}
				max={yearMax()}
				defaultValue={value}
				onBlur={(e) => onCommit(Number(e.currentTarget.value))}
				onKeyDown={(e) => {
					if (e.key === "Enter") onCommit(Number(e.currentTarget.value))
				}}
				className="h-10 w-28 rounded-lg bg-white/[0.06] px-3 text-[15px] tabular-nums text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-amber-400"
			/>
		</label>
	)
}

export function ReleasedA({ d, phone }: SectionProps) {
	const s = d.filters.state
	const range = yearRange(s)
	const now = yearMax()
	const c = (o: string) => d.counts?.optionCounts.released?.[o] ?? null
	const any = sameRange(range, [YEAR_MIN, now])
	const extra = extraPicks()
	const extraCounts = useRangeCounts(
		d,
		"years",
		extra.map((p) => ({ ...(p.range[0] > YEAR_MIN ? { min: p.range[0] } : {}), ...(p.range[1] < now ? { max: p.range[1] } : {}) })),
	)
	const clamp = (y: number) => Math.min(now, Math.max(YEAR_MIN, Number.isFinite(y) ? Math.round(y) : YEAR_MIN))
	return (
		<div className={`${pad(phone)} ${phone ? "flex flex-col gap-6" : "grid grid-cols-[1fr_1fr] gap-10"}`}>
			<div>
				<GroupLabel right={<ResetLink show={!any} onClick={() => setYears(d, [YEAR_MIN, now])} />}>Quick picks</GroupLabel>
				<div className="flex flex-wrap gap-2">
					{RELEASED.filter((r) => r !== "any").map((r) => (
						<Chip
							key={r}
							o={{
								id: r,
								label: RELEASED_LABELS[r],
								active: !s.years && s.released === r,
								count: c(r),
								toggle: () => d.filters.set({ released: s.released === r && !s.years ? "any" : r, years: undefined }),
							}}
						/>
					))}
				</div>
				<div className="mt-2 flex flex-wrap gap-2">
					{extra.map((p, i) => (
						<Chip
							key={p.label}
							o={{ id: p.label, label: p.label, active: !!s.years && sameRange(range, p.range), count: extraCounts[i], toggle: () => toggleYears(d, p.range) }}
						/>
					))}
				</div>
			</div>
			<div>
				<GroupLabel>Years</GroupLabel>
				<RangeSlider label="Released" min={YEAR_MIN} max={now} step={1} value={range} format={fmtYear} onCommit={(r) => setYears(d, r)} />
				<div className="mt-5 flex items-end gap-3">
					<YearField label="From" value={range[0]} onCommit={(y) => setYears(d, [Math.min(clamp(y), range[1]), range[1]])} />
					<span className="pb-2.5 text-gray-600">to</span>
					<YearField label="To" value={range[1]} onCommit={(y) => setYears(d, [range[0], Math.max(clamp(y), range[0])])} />
				</div>
			</div>
		</div>
	)
}
