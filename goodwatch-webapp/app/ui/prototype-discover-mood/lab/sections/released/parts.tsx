// PROTOTYPE (Discover lab): shared helpers for the Released and Length sections. Year and length ranges as the real
// filter state writes them (released presets, years, runtime), and real counts for ranges the results endpoint
// doesn't count by itself: one cheap results read per range, everything else in the state unchanged.
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import { type FilterRange, type FilterState, RELEASED, type Released } from "~/domain/filter-state"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import type { ProtoDiscover } from "../../../kit"

export const YEAR_MIN = 1920
export const yearMax = () => new Date().getFullYear()

export function releasedRange(released: Released): [number, number] {
	const now = yearMax()
	switch (released) {
		case "recent":
			return [now - 3, now]
		case "2010s":
			return [2010, 2019]
		case "2000s":
			return [2000, 2009]
		case "before2000":
			return [YEAR_MIN, 1999]
		default:
			return [YEAR_MIN, now]
	}
}

export const yearRange = (s: FilterState): [number, number] =>
	s.years ? [s.years.min ?? YEAR_MIN, s.years.max ?? yearMax()] : releasedRange(s.released)

/** Writes a year range: a real preset where one matches, else `years` (open ends left out). */
export function setYears(d: ProtoDiscover, [lo, hi]: [number, number]) {
	const now = yearMax()
	const preset = RELEASED.find((r) => {
		const [a, b] = releasedRange(r)
		return a === lo && b === hi
	})
	if (preset) return d.filters.set({ released: preset, years: undefined })
	d.filters.set({ released: "any", years: { ...(lo > YEAR_MIN ? { min: lo } : {}), ...(hi < now ? { max: hi } : {}) } })
}

export const sameRange = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1]

/** Toggles a year range: on when it's the current one, off (any year) when tapped again. */
export function toggleYears(d: ProtoDiscover, r: [number, number]) {
	if (sameRange(yearRange(d.filters.state), r)) setYears(d, [YEAR_MIN, yearMax()])
	else setYears(d, r)
}

export const fmtYear = (y: number) => (y <= YEAR_MIN ? "Any year" : y >= yearMax() ? "Now" : String(y))

/** A range as the URL writes it, "1990-1999", open ends empty; null for no range at all. */
const rangeParam = (r: FilterRange | undefined) =>
	r && (r.min !== undefined || r.max !== undefined) ? `${r.min ?? ""}-${r.max ?? ""}` : null

/**
 * Real counts for ranges of one kind (years or runtime): what each range would leave with everything else as it is.
 * One results read per range, cached by the rest of the state. Null while loading, and always while a text search
 * is on (its ranked list isn't part of the query here, so the counts wouldn't be honest).
 */
export function useRangeCounts(d: ProtoDiscover, name: "years" | "runtime", ranges: FilterRange[]): (number | null)[] {
	const base = new URLSearchParams(d.filters.query)
	for (const p of name === "years" ? ["years", "released", "minYear", "maxYear"] : ["runtime", "minRuntime", "maxRuntime"]) base.delete(p)
	base.delete("page")
	const baseQuery = base.toString()
	const keys = ranges.map(rangeParam)
	const q = useQuery<(number | null)[]>({
		queryKey: ["lab-range-counts", name, baseQuery, keys.join("|")],
		enabled: d.q === null,
		staleTime: 5 * 60_000,
		placeholderData: (previous) => previous,
		queryFn: async ({ signal }) =>
			Promise.all(
				keys.map(async (k) => {
					const p = new URLSearchParams(base)
					if (k) p.set(name, k)
					p.set("page", "1")
					const r = await fetch(`/api/discover/results?${p}`, { signal })
					if (!r.ok) return null
					const j = (await r.json()) as { total?: number }
					return typeof j.total === "number" ? j.total : null
				}),
			),
	})
	if (d.q !== null) return ranges.map(() => null)
	return q.data ?? ranges.map(() => null)
}

/** A big choice tile: label, a quiet second line, the count it would leave. White when on. */
export function Tile({
	label,
	sub,
	count,
	active,
	onClick,
	className = "",
	children,
}: {
	label: ReactNode
	sub?: ReactNode
	count?: number | null
	active: boolean
	onClick: () => void
	className?: string
	children?: ReactNode
}) {
	const dead = !active && count === 0
	return (
		<motion.button
			type="button"
			aria-pressed={active}
			whileTap={TAP}
			onClick={onClick}
			className={`flex flex-col items-start justify-center gap-0.5 rounded-xl px-3.5 py-2.5 text-left outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${
				active
					? "bg-white text-gray-950"
					: dead
						? "bg-white/[0.02] text-gray-600"
						: "bg-white/[0.06] text-gray-100 hover:bg-white/[0.11]"
			} ${className}`}
		>
			<span className="flex w-full items-baseline gap-2">
				<span className={`text-[14px] ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
				{count != null && !active && <span className="ml-auto text-[11px] tabular-nums text-gray-500">{compactCount(count)}</span>}
			</span>
			{sub && <span className={`text-[12px] ${active ? "text-gray-600" : "text-gray-500"}`}>{sub}</span>}
			{children}
		</motion.button>
	)
}

/** A small uppercase group label, like the sheet's card headings. */
export function GroupLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
	return (
		<div className="mb-2 flex h-5 items-center gap-2">
			<span className="text-[11px] font-bold tracking-wide text-gray-500 uppercase">{children}</span>
			{right && <span className="ml-auto">{right}</span>}
		</div>
	)
}

export function ResetLink({ show, onClick, children = "Any" }: { show: boolean; onClick: () => void; children?: ReactNode }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${show ? "" : "invisible"}`}
		>
			{children}
		</button>
	)
}

/** Section padding: the desktop content area is fixed height; phones stack. */
export const pad = (phone: boolean) => (phone ? "px-4 py-4" : "h-full px-7 py-5")
