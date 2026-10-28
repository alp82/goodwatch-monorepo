// PROTOTYPE (Discover lab, mood g and i): a column of choices under a quiet heading. The heading is the filter
// sheet's group heading (FilterGroups: accent bar, name, count badge, note on the right), with the group's own accent,
// over a hairline. Rows sort by fit and glide to their new place; each row's bar is its share of the current list.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { type FitKind, type FitRow, LeaveBar } from "./fit"

/** `kind` picks the group's accent from the filter sheet; without one the bar is a quiet gray. */
export function ColumnHead({ kind, label, picked, note }: { kind?: FitKind; label: string; picked: number; note?: string }) {
	return (
		<header className="flex h-8 shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-1">
			<span className={`h-3.5 w-1 shrink-0 rounded-full ${kind ? FILTER_ACCENTS[kind].bar : "bg-gray-500"}`} aria-hidden />
			<h3 className="text-[15px] font-bold text-white">{label}</h3>
			{picked > 0 && (
				<span className="rounded-full bg-white/10 px-2 text-xs font-bold tabular-nums text-white">
					{picked}
					<span className="sr-only"> picked</span>
				</span>
			)}
			{note && <span className="ml-auto truncate text-xs text-gray-500">{note}</span>}
		</header>
	)
}

export function ColumnRows({ rows, of, phone }: { rows: FitRow[]; of: number; phone: boolean }) {
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
