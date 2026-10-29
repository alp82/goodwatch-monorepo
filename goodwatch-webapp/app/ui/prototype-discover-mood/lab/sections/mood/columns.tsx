// PROTOTYPE (Discover lab, mood g and i): a column of choices under a quiet heading. The heading is the filter
// sheet's group heading (FilterGroups: accent bar, name, count badge, note on the right), with the group's own accent,
// over a hairline. Rows sort by fit and glide to their new place; each row's bar is its share of the current list.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { type FitKind, type FitRow, LeaveBar } from "./fit"

/** `kind` picks the group's accent from the filter sheet; without one the bar is a quiet gray. */
export function ColumnHead({ kind, label, picked, note, right }: { kind?: FitKind; label: string; picked: number; note?: string; right?: ReactNode }) {
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
			{right && <span className="ml-auto shrink-0">{right}</span>}
		</header>
	)
}

/** Round 13 (k): how a group's picks join, "all of" (each pick) or "any of" (Discover's own rule). */
export function ModeToggle({ label, any, onChange }: { label: string; any: boolean; onChange: (any: boolean) => void }) {
	return (
		<span role="radiogroup" aria-label={`${label}: how picks join`} className="flex h-6 items-center rounded-full bg-white/[0.05] p-0.5">
			{(
				[
					[false, "all of"],
					[true, "any of"],
				] as const
			).map(([v, text]) => {
				const on = any === v
				return (
					<button
						key={text}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a two-way switch; the buttons carry the radio role
						role="radio"
						aria-checked={on}
						onClick={() => onChange(v)}
						className={`relative h-5 cursor-pointer rounded-full px-2 text-[11px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "text-white" : "text-gray-500 hover:text-gray-200"}`}
					>
						{on && <motion.span layoutId={`mode-${label}`} transition={{ type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-0 rounded-full bg-white/[0.16]" />}
						<span className="relative">{text}</span>
					</button>
				)
			})}
		</span>
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
