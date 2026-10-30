// PROTOTYPE: the count at the top right (fixed width, so it doesn't jump) with its colored line, and a popout that
// shows what each filter hides, adding up to 100%. Each row can be switched off and on again (the filter's choices wait
// here, so trying combinations needs no trip back into the panel) or removed.
//
// "Hides" is an estimate: the server counts only titles that one filter alone hides (recoveries); titles that several
// filters keep out are shared among those filters by their sole-hide counts, so the rows add up to the hidden total.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useId, useRef, useState } from "react"
import type { FilterName, FilterState } from "~/domain/filter-state"
import { FILTER_ACCENTS, METER_COLORS, compactCount } from "~/ui/filter-bar/labels"
import { Knob, MENU, METER_TRANSITION, TAP } from "~/ui/filter-bar/motion"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import { CountText } from "../PanelFooter"
import type { BarChip } from "../chips"

export const colorOf = (group: FilterName | string): string => {
	const meter = METER_COLORS[group as FilterName]
	if (meter) return meter
	const bar = FILTER_ACCENTS[group as FilterName]?.bar
	if (bar?.includes("orange")) return "bg-rose-500"
	return !bar || bar.includes("amber") ? "bg-gray-400" : bar
}

interface Row {
	group: string
	label: string
	color: string
	hides: number
	chips: BarChip[]
	off: boolean
}

const removeAll = (chips: BarChip[], s: FilterState) =>
	chips.reduce((acc, chip) => (chip.remove ? chip.remove(acc) : acc), s)

/** The fields `after` changed, with their values in `before`. */
function diff(before: FilterState, after: FilterState): Partial<FilterState> {
	const out: Record<string, unknown> = {}
	const keys = new Set([...Object.keys(before), ...Object.keys(after)])
	for (const key of keys) {
		const a = (before as unknown as Record<string, unknown>)[key]
		const b = (after as unknown as Record<string, unknown>)[key]
		if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = a
	}
	return out as Partial<FilterState>
}

function Stack({
	shown,
	rows,
	className,
}: {
	shown: number
	rows: Row[]
	className: string
}) {
	const live = rows.filter((r) => !r.off && r.hides > 0)
	const all = shown + live.reduce((sum, r) => sum + r.hides, 0)
	const width = (n: number) => `${all ? Math.max(2, (n / all) * 100) : 0}%`
	return (
		<span aria-hidden className={`flex overflow-hidden rounded-full bg-white/5 ${className}`}>
			<motion.span layout transition={METER_TRANSITION} className="h-full bg-amber-500" style={{ width: width(shown) }} />
			{live.map((r) => (
				<motion.span
					key={r.group}
					layout
					transition={METER_TRANSITION}
					className={`ml-px h-full ${r.color}`}
					style={{ width: width(r.hides) }}
				/>
			))}
		</span>
	)
}

export function FilterMix({
	counts,
	searching,
	chips,
	update,
	phone,
	side = "right",
}: {
	/** Left: the count and the popout start at the left; the popout opens upward (the panel footer). */
	side?: "right" | "left"
	counts: FilterBarCounts | null
	searching: boolean
	state: FilterState
	chips: BarChip[]
	update: (change: (state: FilterState) => FilterState) => void
	phone: boolean
}) {
	const [open, setOpen] = useState(false)
	const id = useId()
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const down = (e: Event) => !ref.current?.contains(e.target as Node) && setOpen(false)
		const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("pointerdown", down)
		document.addEventListener("keydown", key)
		return () => {
			document.removeEventListener("pointerdown", down)
			document.removeEventListener("keydown", key)
		}
	}, [open])

	// Switched-off filters: their choices, label and place, until switched on or removed.
	const [parked, setParked] = useState<
		{ group: string; label: string; restore: Partial<FilterState> }[]
	>([])

	// Rows keep the place they first took, also while switched off.
	const seen = useRef<string[]>([])
	const total = counts?.total ?? 0
	const hidden = counts?.hidden ?? 0
	const sole = new Map((counts?.recoveries ?? []).map((r) => [r.filter as string, r.titles]))
	const groups: { group: string; chips: BarChip[] }[] = []
	for (const chip of chips) {
		if (chip.kind === "query" || !chip.group) continue
		const at = groups.find((g) => g.group === chip.group)
		if (at) at.chips.push(chip)
		else groups.push({ group: chip.group, chips: [chip] })
	}
	const soleSum = groups.reduce((sum, g) => sum + (sole.get(g.group) ?? 0), 0)
	const shared = Math.max(0, hidden - soleSum)
	const weight = (g: string) => (sole.get(g) ?? 0) + 1
	const weights = groups.reduce((sum, g) => sum + weight(g.group), 0)
	const live: Row[] = groups.map((g) => ({
		group: g.group,
		label: g.chips.map((c) => c.label).join(" · "),
		color: colorOf(g.group),
		hides: Math.round((sole.get(g.group) ?? 0) + (weights ? (shared * weight(g.group)) / weights : 0)),
		chips: g.chips,
		off: false,
	}))
	const unsorted: Row[] = [
		...live,
		...parked
			.filter((p) => !live.some((r) => r.group === p.group))
			.map((p) => ({ group: p.group, label: p.label, color: colorOf(p.group), hides: 0, chips: [], off: true })),
	]
	for (const row of unsorted) if (!seen.current.includes(row.group)) seen.current.push(row.group)
	const rows = [...unsorted].sort((a, b) => seen.current.indexOf(a.group) - seen.current.indexOf(b.group))

	const switchOff = (row: Row) => {
		update((s) => {
			const after = removeAll(row.chips, s)
			const restore = diff(s, after)
			setParked((list) => [...list.filter((p) => p.group !== row.group), { group: row.group, label: row.label, restore }])
			return after
		})
	}
	const switchOn = (row: Row) => {
		const p = parked.find((x) => x.group === row.group)
		if (p) update((s) => ({ ...s, ...p.restore }))
		setParked((list) => list.filter((x) => x.group !== row.group))
	}
	const remove = (row: Row) => {
		if (!row.off) update((s) => removeAll(row.chips, s))
		setParked((list) => list.filter((x) => x.group !== row.group))
		seen.current = seen.current.filter((g) => g !== row.group)
	}

	return (
		<div ref={ref} className="relative shrink-0">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={id}
				onClick={() => setOpen((o) => !o)}
				className={`flex h-12 flex-col justify-center gap-1 rounded-lg px-1.5 ${side === "left" ? "items-start text-left" : "items-end text-right"} cursor-pointer outline-none hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-amber-400 ${phone ? "w-[150px]" : "w-[188px]"}`}
			>
				<span className="flex w-full items-baseline justify-between gap-2">
					<CountText counts={counts} searching={searching} />
					<span className="text-[11px] whitespace-nowrap text-gray-500">
						{hidden > 0 ? `${compactCount(hidden)} hidden` : ""}
					</span>
				</span>
				<Stack shown={total} rows={rows} className="h-2 w-full" />
			</button>
			<AnimatePresence>
				{open && counts && (
					<motion.div
						id={id}
						role="dialog"
						aria-label="What your filters hide"
						initial={{ opacity: 0, y: side === "left" ? 4 : -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: side === "left" ? 4 : -4 }}
						transition={{ duration: 0.14 }}
						className={`absolute z-50 p-3.5 ${side === "left" ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2"} text-[13px] ${phone ? "w-[min(340px,calc(100vw-32px))]" : "w-[360px]"} ${MENU}`}
					>
						<p className="text-sm font-bold text-white">
							{total.toLocaleString("en")} of {(total + hidden).toLocaleString("en")} titles
						</p>
						<Stack shown={total} rows={rows} className="mt-2.5 h-2.5 w-full" />
						<ul className="mt-3 flex flex-col gap-1">
							<li className="flex h-8 items-center gap-2.5">
								<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
								<span className="flex-1 font-bold text-white">Shown</span>
								<span className="tabular-nums text-gray-300">{total.toLocaleString("en")}</span>
								<span className="w-[86px]" aria-hidden />
							</li>
							{rows.map((row) => (
								<li key={row.group} className="flex h-9 items-center gap-1">
									<motion.button
										type="button"
										role="switch"
										aria-checked={!row.off}
										aria-label={row.label}
										whileTap={{ scale: 0.985 }}
										onClick={() => (row.off ? switchOn(row) : switchOff(row))}
										className="-ml-2 flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-lg pr-1 pl-2 text-left cursor-pointer outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-amber-400"
									>
										<span
											className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.color} ${row.off ? "opacity-40" : ""}`}
											aria-hidden
										/>
										<span
											className={`min-w-0 flex-1 truncate ${row.off ? "text-gray-500 line-through decoration-gray-600" : "text-gray-200"}`}
										>
											{row.label}
										</span>
										<span className="shrink-0 text-xs tabular-nums text-gray-500">
											{row.off ? "off" : row.hides < 1 ? "no effect" : `hides ~${compactCount(row.hides)}`}
										</span>
										<span className="shrink-0 origin-center scale-75" aria-hidden>
											<Knob on={!row.off} />
										</span>
									</motion.button>
									<button
										type="button"
										aria-label={`Remove ${row.label}`}
										onClick={() => remove(row)}
										className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-gray-500 cursor-pointer outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
									>
										<XMarkIcon className="h-4 w-4" />
									</button>
								</li>
							))}
							{rows.length === 0 && <li className="text-xs text-gray-500">No filters.</li>}
						</ul>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
