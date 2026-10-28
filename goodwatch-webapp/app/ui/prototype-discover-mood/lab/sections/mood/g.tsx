// PROTOTYPE (Discover lab, mood g): d's mixer with picture headers. The recipe line stays on top; each of the four
// columns (Feel, About, Style, Genre) gets a picture header showing its best fit, and its rows sort by what fits your
// mix: picks first, then the choice that leaves the most. Bars are each choice's share of the current list, scaled
// with transform only, and rows glide to their new place when a pick changes the order.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { ChoiceArt } from "~/ui/watch-next/TasteShelf"
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import { type FitKind, type FitRow, LeaveBar, RecipeLine, byFit, fitRows } from "./fit"
import { TypeSwitch, type WorldArt, useMoods, useWorldArt } from "./parts"

const COLUMNS: { kind: FitKind; label: string; note: string }[] = [
	{ kind: "moods", label: "Feel", note: "Up to 3" },
	{ kind: "themes", label: "About", note: "Any of" },
	{ kind: "styles", label: "Style", note: "Any of" },
	{ kind: "genres", label: "Genre", note: "Any of" },
]

function Header({ label, note, rows, art, d }: { label: string; note: string; rows: FitRow[]; art: WorldArt; d: ProtoDiscover }) {
	const picked = rows.filter((r) => r.on)
	const best = picked[0] ?? rows.find((r) => !r.dead && r.n !== null) ?? rows[0]
	// Genre has no island: its picture is the list's top title.
	const path = best?.island ? (art.get(best.island)?.path ?? null) : (d.cards.find((c) => c.backdrop_path)?.backdrop_path ?? null)
	const hues = picked.length ? picked.slice(0, 2).map((r) => r.color) : [best?.color ?? "#374151"]
	return (
		<div className="relative isolate flex h-14 shrink-0 items-end justify-between gap-2 overflow-hidden rounded-xl px-3 pb-2 text-white ring-1 ring-white/10">
			<motion.span key={`${path}|${hues.join()}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="absolute inset-0 -z-10" aria-hidden>
				<ChoiceArt hues={hues} path={path} split={hues.length > 1} />
			</motion.span>
			<span className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 to-transparent" aria-hidden />
			<span className="flex min-w-0 items-baseline gap-2 [text-shadow:0_1px_6px_rgba(0,0,0,.7)]">
				<span className="text-[15px] font-bold">{label}</span>
				<span className="truncate text-xs text-white/80">{picked.length ? `${picked.length} · any of` : note}</span>
			</span>
			{best && !picked.length && best.n !== null && (
				<span className="truncate text-xs font-semibold text-white/85 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">{best.name}</span>
			)}
		</div>
	)
}

function Rows({ rows, of, phone }: { rows: FitRow[]; of: number; phone: boolean }) {
	return (
		<div className={phone ? "grid grid-cols-2 gap-x-2 gap-y-0.5" : "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]"}>
			{rows.map((r) => (
				<motion.button
					key={r.id}
					layout="position"
					transition={{ type: "spring", stiffness: 500, damping: 40 }}
					type="button"
					role="checkbox"
					aria-checked={r.on}
					title={r.title}
					onClick={r.toggle}
					whileTap={{ scale: 0.98 }}
					className={`relative flex h-[26px] w-full shrink-0 cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
						r.on ? "bg-white/[0.12] font-semibold text-white ring-1 ring-white/40" : r.dead ? "text-gray-600" : "text-gray-200 hover:bg-white/[0.06]"
					}`}
				>
					<LeaveBar n={r.n} of={of} color={r.color} on={r.on} />
					<span className="relative h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
					<span className="relative min-w-0 flex-1 truncate">{r.name}</span>
					<span className="relative flex shrink-0 items-center text-[11px] tabular-nums text-gray-400">
						{r.on ? <XMarkIcon className="h-3.5 w-3.5 text-white/80" aria-hidden /> : r.search ? <MagnifyingGlassIcon className="h-3 w-3" aria-hidden /> : r.short}
					</span>
				</motion.button>
			))}
		</div>
	)
}

export function MoodG({ d, phone }: SectionProps) {
	const m = useMoods(d)
	const art = useWorldArt()
	const all = fitRows(d, m)
	const columns = COLUMNS.map((c) => {
		const rows = byFit(all.filter((r) => r.kind === c.kind))
		// Bars are a share of the current list; a group's "any of" count can pass it, so the column max caps the scale.
		const of = Math.max(d.total ?? 0, ...rows.map((r) => r.n ?? 0), 1)
		return (
			<div key={c.kind} className={`flex min-h-0 min-w-0 flex-col gap-1.5 ${phone ? "" : "flex-1"}`}>
				<Header label={c.label} note={c.note} rows={rows} art={art} d={d} />
				<Rows rows={rows} of={of} phone={phone} />
			</div>
		)
	})
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<RecipeLine d={d} m={m} size="text-[17px]" />
				<div className="flex">
					<TypeSwitch d={d} />
				</div>
				{columns}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col gap-3 px-6 py-3">
			<div className="flex items-center gap-4">
				<div className="min-w-0 flex-1">
					<RecipeLine d={d} m={m} />
				</div>
				<TypeSwitch d={d} />
			</div>
			<div className="flex min-h-0 flex-1 gap-4">{columns}</div>
		</div>
	)
}
