// PROTOTYPE (Discover lab, mood h): one ranked list. The recipe line on top, then every mood, theme, style and genre
// in a single list ranked by how many titles it would leave, all on one scale, so "what goes with this" reads straight
// down. Kind pills narrow the list to one kind. Search moods (no count) sit at the end.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useState } from "react"
import type { SectionProps } from "../../types"
import { FIT_KIND_LABEL, type FitKind, type FitRow, LeaveBar, RecipeLine, byFit, fitRows } from "./fit"
import { useMoods } from "./parts"

type Filter = "all" | FitKind
const FILTERS: Filter[] = ["all", "moods", "themes", "styles", "genres"]

function KindPills({ value, onChange, rows }: { value: Filter; onChange: (f: Filter) => void; rows: FitRow[] }) {
	return (
		<div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
			{FILTERS.map((f) => {
				const on = value === f
				const inKind = f === "all" ? rows : rows.filter((r) => r.kind === f)
				const picked = inKind.filter((r) => r.on).length
				return (
					<button
						key={f}
						type="button"
						aria-pressed={on}
						onClick={() => onChange(f)}
						className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors ${on ? "bg-white font-semibold text-gray-950" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11]"}`}
					>
						{f === "all" ? "All" : FIT_KIND_LABEL[f]}
						<span className={`text-[11px] tabular-nums ${on ? "text-gray-600" : "text-gray-500"}`}>{inKind.length}</span>
						{picked > 0 && <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-bold tabular-nums text-black">{picked}</span>}
					</button>
				)
			})}
		</div>
	)
}

function Row({ r, rank, of, kindShown }: { r: FitRow; rank: number | null; of: number; kindShown: boolean }) {
	return (
		<motion.button
			layout="position"
			transition={{ type: "spring", stiffness: 500, damping: 40 }}
			type="button"
			role="checkbox"
			aria-checked={r.on}
			title={r.title}
			onClick={r.toggle}
			whileTap={{ scale: 0.98 }}
			className={`relative flex h-[26px] w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
				r.on ? "bg-white/[0.12] font-semibold text-white ring-1 ring-white/40" : r.dead ? "text-gray-600" : "text-gray-200 hover:bg-white/[0.06]"
			}`}
		>
			<LeaveBar n={r.n} of={of} color={r.color} on={r.on} />
			<span className="relative w-5 shrink-0 text-right text-[11px] tabular-nums text-gray-500">{rank ?? ""}</span>
			<span className="relative h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
			<span className="relative min-w-0 flex-1 truncate">
				{r.name}
				{kindShown && <span className="ml-1.5 text-[11px] font-normal text-gray-500">{FIT_KIND_LABEL[r.kind]}</span>}
			</span>
			<span className="relative flex shrink-0 items-center text-[11px] tabular-nums text-gray-400">
				{r.on ? <XMarkIcon className="h-3.5 w-3.5 text-white/80" aria-hidden /> : r.search ? <MagnifyingGlassIcon className="h-3 w-3" aria-hidden /> : r.short}
			</span>
		</motion.button>
	)
}

const PHONE_FIRST = 14

export function MoodH({ d, phone }: SectionProps) {
	const m = useMoods(d)
	const [filter, setFilter] = useState<Filter>("all")
	const [more, setMore] = useState(false)
	const all = fitRows(d, m)
	const rows = byFit(filter === "all" ? all : all.filter((r) => r.kind === filter))
	const of = Math.max(d.total ?? 0, ...rows.map((r) => r.n ?? 0), 1)
	let rank = 0
	const items = rows.map((r) => {
		const shown = r.on || r.n === null ? null : ++rank
		return <Row key={r.id} r={r} rank={shown} of={of} kindShown={filter === "all"} />
	})
	if (phone)
		return (
			<div className="flex flex-col gap-3">
				<RecipeLine d={d} m={m} size="text-[17px]" />
				<KindPills value={filter} onChange={setFilter} rows={all} />
				<div className="flex flex-col gap-0.5">{more ? items : items.slice(0, PHONE_FIRST)}</div>
				{items.length > PHONE_FIRST && (
					<button
						type="button"
						onClick={() => setMore(!more)}
						className="h-9 cursor-pointer rounded-xl bg-white/5 text-sm font-semibold text-gray-200 ring-1 ring-white/10 hover:bg-white/10"
					>
						{more ? "Fewer" : `All ${items.length}`}
					</button>
				)}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col gap-2.5 px-6 py-3">
			<div className="flex items-center gap-4">
				<div className="min-w-0 flex-1">
					<RecipeLine d={d} m={m} />
				</div>
			</div>
			<KindPills value={filter} onChange={setFilter} rows={all} />
			<div className="grid min-h-0 flex-1 auto-cols-[minmax(13rem,1fr)] grid-flow-col grid-rows-[repeat(10,26px)] content-start gap-x-4 gap-y-0.5 overflow-x-auto overscroll-contain [scrollbar-width:thin]">
				{items}
			</div>
		</div>
	)
}
