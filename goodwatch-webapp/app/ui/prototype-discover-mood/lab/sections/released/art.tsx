// PROTOTYPE (Discover lab) Released f: its looks. Era tints, the era board's reads (one per tile), a picture chip and
// the slider with From / To fields.
import { motion } from "framer-motion"
import { compactCount } from "~/ui/filter-bar/labels"
import { ChoiceArt } from "~/ui/watch-next/TasteShelf"
import type { ProtoDiscover } from "../../../kit"
import { type RangeRead, YEAR_MIN, setYears, useRangeReads, yearMax, yearRange, yearsFilter } from "./parts"

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
				// Last N years runs from N years back to now, like Last 3 years (the real "recent" preset).
				{ label: "Last 2 years", range: [now - 2, now] },
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
				{ label: "After 2000", range: [2000, now] },
				{ label: "After 1950", range: [1950, now] },
			],
		},
	]
}

function YearField({ label, value, onCommit }: { label: string; value: number; onCommit: (y: number) => void }) {
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

/** One hue per era: warm for new, cool through the 2000s, then the film stock colors of each older decade. */
const TINT: Record<string, string> = {
	"This year": "#d97706",
	"Last 2 years": "#ea580c",
	"Last 3 years": "#e11d48",
	"Last 5 years": "#c026d3",
	"2020s": "#0d9488",
	"2010s": "#2563eb",
	"2000s": "#6d28d9",
	"1990s": "#be185d",
	"1980s": "#c2410c",
	"1970s": "#a16207",
	"1960s": "#4d7c0f",
	"1950s": "#9f1239",
	"1940s": "#57534e",
	"1930s": "#44403c",
	"1920s": "#3f3f46",
	"After 1950": "#57534e",
	"After 2000": "#475569",
}
export const tint = (label: string) => TINT[label] ?? "#475569"

export interface EraRead {
	id: string
	label: string
	sub?: string
	range: [number, number]
	read: RangeRead
}

/** c's era board with each tile's read (count, top title, picture), and the count for any year (for share bars). */
export function useEraBoard(d: ProtoDiscover) {
	const cols = eras()
	const flat = cols.flatMap((c) => c.items)
	const reads = useRangeReads(
		d,
		"years",
		flat.map((e) => yearsFilter(e.range)),
	)
	// Any year (one more read), for the share bars.
	const all = useRangeReads(d, "years", [null])[0].total
	let i = 0
	const groups = cols.map((c) => ({ ...c, items: c.items.map((e): EraRead => ({ ...e, id: e.label, read: reads[i++] })) }))
	return { groups, all }
}

/** A share of the whole catalog as a thin bar, scaled with transform. */
export function ShareBar({ n, all, className = "inset-x-2.5 bottom-1.5" }: { n: number | null; all: number | null; className?: string }) {
	if (n === null || !all) return null
	return (
		<span className={`pointer-events-none absolute h-[3px] overflow-hidden rounded-full bg-white/15 ${className}`} aria-hidden>
			<span
				className="block h-full w-full origin-left rounded-full bg-white/80 transition-transform duration-300 motion-reduce:transition-none"
				style={{ transform: `scaleX(${Math.min(1, n / all)})` }}
			/>
		</span>
	)
}

/** A small era chip with its picture behind the name, and its count. */
export function EraChip({ e, on, onClick, className = "" }: { e: EraRead; on: boolean; onClick: () => void; className?: string }) {
	const n = e.read.total
	return (
		<motion.button
			type="button"
			role="checkbox"
			aria-checked={on}
			whileTap={{ scale: 0.97 }}
			onClick={onClick}
			className={`relative isolate inline-flex h-10 min-w-0 items-center gap-2 overflow-hidden rounded-xl pl-3 pr-2.5 text-[13px] font-bold text-white cursor-pointer outline-none [text-shadow:0_1px_4px_rgba(0,0,0,.6)] focus-visible:ring-2 focus-visible:ring-white ${
				on ? "ring-2 ring-white" : "ring-1 ring-white/10 hover:ring-white/40"
			} ${!on && n === 0 ? "opacity-40" : ""} ${className}`}
			style={{ boxShadow: on ? `0 6px 22px -8px ${tint(e.label)}` : undefined }}
		>
			<ChoiceArt hues={[tint(e.label)]} path={e.read.backdrop} />
			<span className="truncate">{e.label}</span>
			<span className="ml-auto shrink-0 rounded-md bg-black/30 px-1 text-[11px] tabular-nums">{n === null ? "" : compactCount(n)}</span>
		</motion.button>
	)
}

export function YearFields({ d, className = "", clamp }: { d: ProtoDiscover; className?: string; clamp?: (y: number) => number }) {
	const range = yearRange(d.filters.state)
	const now = yearMax()
	const c = clamp ?? ((y: number) => Math.min(now, Math.max(YEAR_MIN, Number.isFinite(y) ? Math.round(y) : YEAR_MIN)))
	return (
		<div className={`flex items-end gap-3 ${className}`}>
			<YearField label="From" value={range[0]} onCommit={(y) => setYears(d, [Math.min(c(y), range[1]), range[1]])} />
			<span className="pb-2.5 text-gray-600">to</span>
			<YearField label="To" value={range[1]} onCommit={(y) => setYears(d, [range[0], Math.max(c(y), range[0])])} />
		</div>
	)
}
