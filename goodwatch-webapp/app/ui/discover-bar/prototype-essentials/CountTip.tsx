// PROTOTYPE: the status line's count with a wider hidden meter, and a tooltip (hover, focus, or tap) with the whole
// distribution: shown, what each filter alone keeps out, and what several filters keep out together. The parts add up
// to every title that fits the rest of the choices.
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useId, useRef, useState } from "react"
import type { FilterState } from "~/domain/filter-state"
import { FILTER_ACCENTS, METER_COLORS, compactCount, recoveryLabel } from "~/ui/filter-bar/labels"
import { MENU, METER_TRANSITION } from "~/ui/filter-bar/motion"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import { CountText } from "../PanelFooter"

interface Part {
	key: string
	label: string
	n: number
	color: string
}

function partsOf(counts: FilterBarCounts | null, state: FilterState): Part[] {
	if (!counts) return []
	const single = counts.recoveries.map((r) => ({
		key: r.filter,
		label: recoveryLabel(r.filter, r.titles, state)
			.replace(/^[\d,.k]+\s*/, "")
			.replace(/^./, (c) => c.toUpperCase()),
		n: r.titles,
		// Every filter its own hue; amber stays for what's shown.
		color:
			METER_COLORS[r.filter] ??
			(FILTER_ACCENTS[r.filter]?.bar.includes("amber")
				? "bg-gray-400"
				: (FILTER_ACCENTS[r.filter]?.bar ?? "bg-gray-400")),
	}))
	const several = Math.max(0, counts.hidden - single.reduce((sum, p) => sum + p.n, 0))
	return [
		{ key: "shown", label: "Shown", n: counts.total, color: "bg-amber-500" },
		...single,
		...(several ? [{ key: "several", label: "Kept out by several filters", n: several, color: "bg-gray-600" }] : []),
	]
}

function Stack({ parts, className }: { parts: Part[]; className: string }) {
	const all = parts.reduce((sum, p) => sum + p.n, 0)
	return (
		<span aria-hidden className={`flex overflow-hidden rounded-full bg-white/5 ${className}`}>
			{parts.map((p, i) =>
				p.n ? (
					<motion.span
						key={p.key}
						layout
						transition={METER_TRANSITION}
						className={`h-full ${p.color} ${i ? "ml-px" : ""}`}
						style={{ width: `${all ? Math.max(1.5, (p.n / all) * 100) : 0}%` }}
					/>
				) : null,
			)}
		</span>
	)
}

const pct = (n: number, all: number) => {
	if (!all) return "0%"
	const v = (n / all) * 100
	return v > 0 && v < 1 ? "<1%" : `${Math.round(v)}%`
}

export function CountTip({
	counts,
	searching,
	state,
}: {
	counts: FilterBarCounts | null
	searching: boolean
	state: FilterState
}) {
	const [open, setOpen] = useState(false)
	const id = useId()
	const ref = useRef<HTMLSpanElement>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>()
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
	const show = () => {
		clearTimeout(timer.current)
		setOpen(true)
	}
	const hide = () => {
		clearTimeout(timer.current)
		timer.current = setTimeout(() => setOpen(false), 120)
	}
	const parts = partsOf(counts, state)
	const all = parts.reduce((sum, p) => sum + p.n, 0)
	const hidden = counts?.hidden ?? 0
	return (
		<span
			ref={ref}
			className="relative flex shrink-0"
			onPointerEnter={(e) => e.pointerType === "mouse" && show()}
			onPointerLeave={(e) => e.pointerType === "mouse" && hide()}
		>
			<button
				type="button"
				aria-describedby={open ? id : undefined}
				aria-expanded={open}
				onFocus={show}
				onBlur={hide}
				onClick={show}
				className="flex cursor-help flex-col gap-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<CountText counts={counts} searching={searching} />
				<span className="flex h-3 items-center gap-2">
					<Stack parts={parts} className="h-2 w-28" />
					<span className="text-[11px] leading-none whitespace-nowrap text-gray-500">
						{hidden > 0 ? `${compactCount(hidden)} hidden` : ""}
					</span>
				</span>
			</button>
			<AnimatePresence>
				{open && counts && (
					<motion.div
						id={id}
						role="tooltip"
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						transition={{ duration: 0.14 }}
						className={`absolute top-full left-0 z-50 mt-2 w-80 p-3.5 text-[13px] ${MENU}`}
					>
						<p className="text-sm font-bold text-white">
							{counts.total.toLocaleString("en")} of {all.toLocaleString("en")} titles
						</p>
						<Stack parts={parts} className="mt-2.5 h-2.5 w-full" />
						<ul className="mt-3 flex flex-col gap-1.5">
							{parts.map((p) => (
								<li key={p.key} className="flex items-center gap-2.5">
									<span className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.color}`} aria-hidden />
									<span
										className={`min-w-0 flex-1 truncate ${p.key === "shown" ? "font-bold text-white" : "text-gray-300"}`}
									>
										{p.label}
									</span>
									<span className="w-12 shrink-0 text-right tabular-nums text-gray-300">{compactCount(p.n)}</span>
									<span className="w-10 shrink-0 text-right tabular-nums text-gray-500">{pct(p.n, all)}</span>
								</li>
							))}
						</ul>
					</motion.div>
				)}
			</AnimatePresence>
		</span>
	)
}
