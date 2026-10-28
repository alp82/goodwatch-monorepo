// PROTOTYPE (Discover lab) Released c: a board of eras in columns (New, Decades, Older) with real counts on every
// tile, and exact years as two steppers instead of a slider.
import { MinusIcon, PlusIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { TAP } from "~/ui/filter-bar/motion"
import type { SectionProps } from "../../types"
import { GroupLabel, ResetLink, Tile, YEAR_MIN, fmtYear, pad, sameRange, setYears, toggleYears, useRangeCounts, yearMax, yearRange } from "./parts"

interface Era {
	label: string
	sub?: string
	range: [number, number]
}

export function eras(): { id: string; label: string; items: Era[] }[] {
	const now = yearMax()
	return [
		{
			id: "new",
			label: "New",
			items: [
				{ label: "This year", range: [now, now] },
				{ label: "Last year", sub: String(now - 1), range: [now - 1, now - 1] },
				{ label: "Last 3 years", range: [now - 3, now] },
				{ label: "Last 5 years", range: [now - 5, now] },
			],
		},
		{
			id: "decades",
			label: "Decades",
			items: [2020, 2010, 2000, 1990, 1980, 1970].map((y) => ({ label: `${y}s`, range: [y, Math.min(y + 9, now)] as [number, number] })),
		},
		{
			id: "older",
			label: "Older",
			items: [
				{ label: "1960s", range: [1960, 1969] },
				{ label: "1950s", range: [1950, 1959] },
				{ label: "Before 1950", range: [YEAR_MIN, 1949] },
				{ label: "Before 2000", range: [YEAR_MIN, 1999] },
			],
		},
	]
}

function Stepper({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
	const btn =
		"grid h-10 w-10 place-items-center rounded-lg bg-white/[0.06] text-gray-200 cursor-pointer outline-none hover:bg-white/[0.11] focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-30"
	return (
		<div>
			<GroupLabel>{label}</GroupLabel>
			<div className="flex items-center gap-1.5">
				<motion.button type="button" whileTap={TAP} aria-label={`${label} earlier`} disabled={value <= min} onClick={() => onChange(value - 1)} className={btn}>
					<MinusIcon className="h-4 w-4" />
				</motion.button>
				<span className="w-20 text-center text-[18px] font-semibold tabular-nums text-white">{fmtYear(value)}</span>
				<motion.button type="button" whileTap={TAP} aria-label={`${label} later`} disabled={value >= max} onClick={() => onChange(value + 1)} className={btn}>
					<PlusIcon className="h-4 w-4" />
				</motion.button>
			</div>
			<div className="mt-1.5 flex gap-1">
				{[-10, 10].map((step) => (
					<button
						key={step}
						type="button"
						onClick={() => onChange(Math.min(max, Math.max(min, value + step)))}
						className="rounded-md px-2 py-0.5 text-[12px] tabular-nums text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						{step > 0 ? "+10" : "−10"}
					</button>
				))}
			</div>
		</div>
	)
}

export function ReleasedC({ d, phone }: SectionProps) {
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
	let i = 0
	return (
		<div className={`${pad(phone)} ${phone ? "flex flex-col gap-5" : "grid grid-cols-[1fr_1.4fr_1fr_auto] gap-6"}`}>
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
			<div className={`flex gap-6 ${phone ? "flex-row flex-wrap" : "flex-col border-l border-white/[0.07] pl-6"}`}>
				<Stepper label="From" value={range[0]} min={YEAR_MIN} max={range[1]} onChange={(v) => setYears(d, [v, range[1]])} />
				<Stepper label="To" value={range[1]} min={range[0]} max={now} onChange={(v) => setYears(d, [range[0], v])} />
				<ResetLink show={!any} onClick={() => setYears(d, [YEAR_MIN, now])}>
					Any year
				</ResetLink>
			</div>
		</div>
	)
}
