// PROTOTYPE (Discover lab) Released f "Timeline": every decade since the 1920s as a column on one timeline, the
// column as wide as the years it holds, so the year slider under it lines up with the bars. Each column shows its top
// title's poster and a bar in its era's tint, as tall as its real count. Tapping a decade picks it, a neighbor widens
// the span (b's rule); dragging across columns picks the decades it spans. New sits above as tinted tiles with After
// 2000 / After 1950 as chips, From / To at the right.
import { motion } from "framer-motion"
import { type PointerEvent, useRef, useState } from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { RangeSlider } from "~/ui/filter-bar/SheetControls"
import { posterUrl } from "~/ui/watch-next/style"
import type { SectionProps } from "../../types"
import { EraChip, type EraRead, ShareBar, YearFields, tint, useEraBoard } from "./art"
import { DECADES, decadeRange, tapDecade } from "./b"
import { GroupLabel, ResetLink, YEAR_MIN, fmtYear, pad, sameRange, setYears, toggleYears, useRangeReads, yearMax, yearRange } from "./parts"

/** Movement before a press turns into a drag. Touch needs it sideways, so vertical scrolling stays the page's. */
const SLOP = 8

/**
 * Drag across the decade columns to pick the span. A press without a drag stays a tap (the button's click). Capture
 * starts only once the pointer moves sideways or onto another column.
 */
function useDecadeDrag(onPick: (from: number, to: number) => void) {
	const [span, setSpan] = useState<[number, number] | null>(null)
	const press = useRef<{ id: number; x: number; y: number; from: number; rects: DOMRect[]; dragging: boolean } | null>(null)
	const swallow = useRef(false)
	const at = (rects: DOMRect[], x: number) => {
		const i = rects.findIndex((r) => x < r.right)
		return i < 0 ? rects.length - 1 : i
	}
	const end = () => {
		press.current = null
		setSpan(null)
	}
	return {
		span,
		/** The button's click runs only when it wasn't the end of a drag. */
		click: (run: () => void) => () => {
			if (swallow.current) swallow.current = false
			else run()
		},
		bind: {
			onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
				if (e.button !== 0) return
				const rects = [...e.currentTarget.children].map((c) => c.getBoundingClientRect())
				press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: at(rects, e.clientX), rects, dragging: false }
			},
			onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
				const p = press.current
				if (!p || p.id !== e.pointerId) return
				const to = at(p.rects, e.clientX)
				if (!p.dragging) {
					const dx = Math.abs(e.clientX - p.x)
					const dy = Math.abs(e.clientY - p.y)
					const sideways = dx > SLOP && dx > dy
					if (e.pointerType === "touch" ? !sideways : !sideways && to === p.from) return
					p.dragging = true
					e.currentTarget.setPointerCapture(e.pointerId)
				}
				setSpan([Math.min(p.from, to), Math.max(p.from, to)])
			},
			onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
				const p = press.current
				if (!p || p.id !== e.pointerId) return
				if (p.dragging) {
					const to = at(p.rects, e.clientX)
					swallow.current = true
					// No click follows a captured drag on some browsers; don't eat the next tap.
					setTimeout(() => {
						swallow.current = false
					}, 0)
					onPick(Math.min(p.from, to), Math.max(p.from, to))
				}
				end()
			},
			onPointerCancel: end,
		},
	}
}

/** A New tile: the era's tint as a wash from the left, its count and its share of every year. */
function NewTile({ e, on, all, onClick }: { e: EraRead; on: boolean; all: number | null; onClick: () => void }) {
	const n = e.read.total
	const hue = tint(e.label)
	return (
		<motion.button
			type="button"
			aria-pressed={on}
			whileTap={TAP}
			onClick={onClick}
			className={`relative isolate flex h-[3.5rem] min-w-0 flex-col justify-center overflow-hidden rounded-xl px-3 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white ${
				on ? "ring-2 ring-white" : "ring-1 ring-white/10 hover:ring-white/30"
			} ${!on && n === 0 ? "opacity-40" : ""}`}
			style={{ background: `linear-gradient(100deg, ${hue}${on ? "e6" : "59"} 0%, ${hue}14 85%)`, boxShadow: on ? `0 6px 22px -8px ${hue}` : undefined }}
		>
			<span className="flex items-baseline gap-2">
				<span className="truncate text-[14px] font-bold text-white">{e.label}</span>
				<span className="ml-auto shrink-0 text-[11px] font-semibold tabular-nums text-white/70">{n === null ? "" : compactCount(n)}</span>
			</span>
			<span className="truncate text-[12px] text-white/60">{e.sub ?? `Since ${e.range[0]}`}</span>
			<ShareBar n={n} all={all} className="inset-x-3 bottom-1" />
		</motion.button>
	)
}

export function ReleasedF({ d, phone }: SectionProps) {
	const range = yearRange(d.filters.state)
	const now = yearMax()
	const any = sameRange(range, [YEAR_MIN, now])
	const { groups, all } = useEraBoard(d)
	const [news, , older] = groups
	const before = older.items.filter((e) => e.label.startsWith("After"))
	// b's decade reads (same query, shared cache).
	const reads = useRangeReads(
		d,
		"years",
		DECADES.map((y) => {
			const [a, b] = decadeRange(y)
			return { min: a, ...(b < now ? { max: b } : {}) }
		}),
	)
	// Square root, so the older decades still read next to the 2010s.
	const top = Math.sqrt(Math.max(1, ...reads.map((r) => r.total ?? 0)))
	const BAR = phone ? 72 : 84
	const inRange = (y: number) => {
		const [a, b] = decadeRange(y)
		return a <= range[1] && b >= range[0]
	}
	const weights = DECADES.map((y) => decadeRange(y)[1] - y + 1)
	// One column dragged over is the same as tapping it; more pick their whole span.
	const drag = useDecadeDrag((a, b) => (a === b ? tapDecade(d, DECADES[a]) : setYears(d, [DECADES[a], decadeRange(DECADES[b])[1]])))
	const showAny = any && !drag.span
	const lit = (i: number) => (drag.span ? i >= drag.span[0] && i <= drag.span[1] : any || inRange(DECADES[i]))

	const strip = (
		<div>
			<GroupLabel right={<ResetLink show={!any} onClick={() => setYears(d, [YEAR_MIN, now])}>Any year</ResetLink>}>Decades</GroupLabel>
			{/* Inset by half a slider thumb so the columns line up with the slider's years. */}
			<div className="px-[10px]">
				<div
					{...drag.bind}
					className="grid touch-pan-y gap-px select-none"
					style={{ gridTemplateColumns: weights.map((w) => `${w}fr`).join(" ") }}
				>
					{DECADES.map((y, i) => {
						const r = reads[i]
						const n = r.total
						const on = lit(i)
						const h = n === null ? 0.05 : Math.max(0.04, Math.sqrt(n) / top)
						const hue = tint(`${y}s`)
						return (
							<motion.button
								key={y}
								type="button"
								aria-pressed={!any && inRange(y)}
								aria-label={`${y}s${n === null ? "" : `, ${n.toLocaleString("en")} titles`}`}
								whileTap={drag.span ? undefined : TAP}
								onClick={drag.click(() => tapDecade(d, y))}
								className="group relative flex min-w-0 flex-col items-center gap-1 rounded-lg pt-0.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								{/* The span being dragged. */}
								<span
									className="pointer-events-none absolute inset-0 rounded-lg bg-white/[0.07] transition-opacity duration-150"
									style={{ opacity: drag.span && on ? 1 : 0 }}
								/>
								<span
									className={`relative block aspect-[2/3] overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10 transition-opacity duration-300 ${phone ? "h-[36px]" : "w-[42px]"} ${on ? "opacity-100" : "opacity-35 group-hover:opacity-70"}`}
								>
									{r.poster && <img src={posterUrl(r.poster, "w154")} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
								</span>
								<span className="relative w-full" style={{ height: BAR }}>
									<span
										className="absolute inset-x-0 bottom-0 h-full origin-bottom rounded-t-md transition-[transform,opacity] duration-300 motion-reduce:transition-none"
										style={{
											transform: `scaleY(${h})`,
											opacity: showAny ? 0.75 : on ? 1 : 0.22,
											background: `linear-gradient(to top, ${hue}, ${hue}b3)`,
										}}
									/>
									{!phone && (
										<span
											className={`absolute inset-x-0 top-0 text-center text-[11px] font-semibold tabular-nums transition-transform duration-300 ${any || inRange(y) ? "text-white" : "text-gray-500"}`}
											style={{ transform: `translateY(${Math.max(0, (1 - h) * BAR - 17)}px)` }}
										>
											{n === null ? "" : compactCount(n)}
										</span>
									)}
								</span>
								<span className={`w-full border-t pt-1 text-center tabular-nums ${phone ? "text-[10px]" : "text-[12px]"} ${!any && inRange(y) ? "border-white/40 font-semibold text-white" : "border-white/10 text-gray-400"}`}>
									{phone ? `’${String(y).slice(2)}` : `${y}s`}
								</span>
							</motion.button>
						)
					})}
				</div>
			</div>
			<div className="mt-2">
				<RangeSlider label="Released" min={YEAR_MIN} max={now} step={1} value={range} format={fmtYear} onCommit={(r) => setYears(d, r)} />
			</div>
		</div>
	)
	const newRow = (
		<div className={phone ? "grid grid-cols-2 gap-2" : "grid grid-cols-4 gap-2.5"}>
			{news.items.map((e) => (
				<NewTile key={e.id} e={e} on={sameRange(range, e.range)} all={all} onClick={() => toggleYears(d, e.range)} />
			))}
		</div>
	)
	const beforeRow = (
		<div className={phone ? "grid grid-cols-2 gap-2" : "flex flex-col gap-1.5"}>
			{before.map((e) => (
				<EraChip key={e.id} e={e} on={sameRange(range, e.range)} onClick={() => toggleYears(d, e.range)} className={phone ? "" : "h-[1.6rem] w-[9.5rem] rounded-lg text-[12px]"} />
			))}
		</div>
	)

	if (phone)
		return (
			<div className={`${pad(true)} flex flex-col gap-5`}>
				<div>
					<GroupLabel>{news.label}</GroupLabel>
					{newRow}
				</div>
				{strip}
				{beforeRow}
				<YearFields d={d} />
			</div>
		)
	return (
		<div className={`${pad(false)} flex flex-col gap-3`}>
			<div className="flex items-end gap-6">
				<div className="min-w-0 flex-1">
					<GroupLabel>{news.label}</GroupLabel>
					{newRow}
				</div>
				{beforeRow}
				<div className="border-l border-white/[0.07] pl-6">
					<YearFields d={d} />
				</div>
			</div>
			{strip}
		</div>
	)
}
