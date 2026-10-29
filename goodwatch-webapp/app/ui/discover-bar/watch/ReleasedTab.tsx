// Watch > Released. New as tinted tiles (This year, Last 2, 3 and 5 years) with a count, "Since <year>" and a share
// bar; After 2000 and After 1950 as picture chips; From and To fields. Under them a decade timeline from the 1920s to
// now: one column per decade as wide as its years, so the year slider under it lines up. Each column has the decade's
// top poster and a tinted bar (square root scale) with the real count. A tap picks a decade, a neighbor widens, an end
// narrows, the lone pick clears; dragging across columns picks the span.
//
// Counts sum `optionCounts.years` (with `counts=released`) and show only when the response has them; pictures come
// from the panel's `part=released`.
import { motion } from "framer-motion"
import { type PointerEvent, useRef, useState } from "react"
import type { FilterRange } from "~/domain/filter-state"
import {
	YEAR_MIN,
	type YearPreset,
	afterYearPresets,
	currentYear,
	newYearPresets,
} from "~/domain/title-scales"
import { RangeSlider } from "~/ui/filter-bar/SheetControls"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { ChoiceArt } from "~/ui/watch-next/PickChip"
import { posterUrl } from "~/ui/watch-next/style"
import type { SubTabView } from "../DiscoverControls"
import { ClearLink, tabPad } from "./parts"
import {
	PANEL_PRESET_IDS,
	type YearSpan,
	anyYear,
	anyYearPatch,
	decadeCounts,
	decadeInSpan,
	dragDecadesPatch,
	panelDecadeId,
	sameSpan,
	spanOf,
	tapDecadePatch,
	togglePresetPatch,
	yearSpan,
	yearsCount,
	yearsPatch,
} from "./released-choices"
import { type ReleasedTop, useReleasedTops } from "./useReleasedTops"

const LABEL = "text-[11px] font-bold tracking-wide text-gray-500 uppercase"

/** One hue per era: warm for new, cool through the 2000s, then the film stock colors of each older decade. */
const TINT: Record<string, string> = {
	"last-1": "#d97706",
	"last-2": "#ea580c",
	"last-3": "#e11d48",
	"last-5": "#c026d3",
	"after-2000": "#475569",
	"after-1950": "#57534e",
	"2020": "#0d9488",
	"2010": "#2563eb",
	"2000": "#6d28d9",
	"1990": "#be185d",
	"1980": "#c2410c",
	"1970": "#a16207",
	"1960": "#4d7c0f",
	"1950": "#9f1239",
	"1940": "#57534e",
	"1930": "#44403c",
	"1920": "#3f3f46",
}
const tint = (key: string | number) => TINT[String(key)] ?? "#475569"

/** Movement before a press turns into a drag. Touch needs it sideways, so vertical scrolling stays the page's. */
const SLOP = 8

/**
 * Drag across the decade columns to pick their span. A press without a drag stays a tap (the column's click). Capture
 * starts only once the pointer moves sideways, or with a mouse onto another column.
 */
function useDecadeDrag(onPick: (from: number, to: number) => void) {
	const [span, setSpan] = useState<[number, number] | null>(null)
	const press = useRef<{
		id: number
		x: number
		y: number
		from: number
		rects: DOMRect[]
		dragging: boolean
	} | null>(null)
	const swallow = useRef(false)
	const at = (rects: DOMRect[], x: number) => {
		const i = rects.findIndex((rect) => x < rect.right)
		return i < 0 ? rects.length - 1 : i
	}
	const end = () => {
		press.current = null
		setSpan(null)
	}
	return {
		span,
		/** The column's click runs only when it wasn't the end of a drag. */
		click: (run: () => void) => () => {
			if (swallow.current) swallow.current = false
			else run()
		},
		bind: {
			onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
				if (event.button !== 0) return
				const rects = [...event.currentTarget.children].map((child) =>
					child.getBoundingClientRect(),
				)
				press.current = {
					id: event.pointerId,
					x: event.clientX,
					y: event.clientY,
					from: at(rects, event.clientX),
					rects,
					dragging: false,
				}
			},
			onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
				const p = press.current
				if (!p || p.id !== event.pointerId) return
				const to = at(p.rects, event.clientX)
				if (!p.dragging) {
					const dx = Math.abs(event.clientX - p.x)
					const dy = Math.abs(event.clientY - p.y)
					const sideways = dx > SLOP && dx > dy
					if (
						event.pointerType === "touch"
							? !sideways
							: !sideways && to === p.from
					)
						return
					p.dragging = true
					event.currentTarget.setPointerCapture(event.pointerId)
				}
				setSpan([Math.min(p.from, to), Math.max(p.from, to)])
			},
			onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
				const p = press.current
				if (!p || p.id !== event.pointerId) return
				if (p.dragging) {
					swallow.current = true
					// Some browsers send no click after a captured drag; don't eat the next tap.
					setTimeout(() => {
						swallow.current = false
					}, 0)
					onPick(p.from, at(p.rects, event.clientX))
				}
				end()
			},
			onPointerCancel: end,
		},
	}
}

/** A share of every year as a thin bar, scaled with transform. */
function ShareBar({ n, all }: { n: number | null; all: number | null }) {
	if (n === null || !all) return null
	return (
		<span
			aria-hidden
			className="pointer-events-none absolute inset-x-3 bottom-1 h-[3px] overflow-hidden rounded-full bg-white/15"
		>
			<span
				className="block h-full w-full origin-left rounded-full bg-white/80 transition-transform duration-300 motion-reduce:transition-none"
				style={{ transform: `scaleX(${Math.min(1, n / all)})` }}
			/>
		</span>
	)
}

/** A New tile: its tint as a wash from the left, its count, "Since <year>" and its share of every year. */
function NewTile({
	preset,
	on,
	n,
	all,
	now,
	onClick,
}: {
	preset: YearPreset
	on: boolean
	n: number | null
	all: number | null
	now: number
	onClick: () => void
}) {
	const hue = tint(preset.key)
	return (
		<motion.button
			type="button"
			aria-pressed={on}
			whileTap={TAP}
			onClick={onClick}
			className={`relative isolate flex h-14 min-w-0 flex-col justify-center overflow-hidden rounded-xl px-3 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white ${
				on ? "ring-2 ring-white" : "ring-1 ring-white/10 hover:ring-white/30"
			} ${!on && n === 0 ? "opacity-40" : ""}`}
			style={{
				background: `linear-gradient(100deg, ${hue}${on ? "e6" : "59"} 0%, ${hue}14 85%)`,
			}}
		>
			<span className="flex items-baseline gap-2">
				<span className="truncate text-[14px] font-bold text-white">
					{preset.label}
				</span>
				<span className="ml-auto shrink-0 text-[11px] font-semibold tabular-nums text-white/70">
					{n === null ? "" : compactCount(n)}
				</span>
			</span>
			<span className="truncate text-[12px] text-white/60">
				Since {preset.years.min ?? now}
			</span>
			<ShareBar n={n} all={all} />
		</motion.button>
	)
}

/** An After chip: the top title's backdrop behind the name, and the count. */
function AfterChip({
	preset,
	on,
	n,
	top,
	phone,
	onClick,
}: {
	preset: YearPreset
	on: boolean
	n: number | null
	top: ReleasedTop | undefined
	phone: boolean
	onClick: () => void
}) {
	return (
		<motion.button
			type="button"
			aria-pressed={on}
			whileTap={TAP}
			onClick={onClick}
			className={`relative isolate inline-flex min-w-0 items-center gap-2 overflow-hidden pr-2 pl-3 font-bold text-white cursor-pointer outline-none [text-shadow:0_1px_4px_rgba(0,0,0,.6)] focus-visible:ring-2 focus-visible:ring-white ${
				phone
					? "h-10 rounded-xl text-[13px]"
					: "h-[26px] w-[152px] rounded-lg text-[12px]"
			} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10 hover:ring-white/40"} ${!on && n === 0 ? "opacity-40" : ""}`}
		>
			<ChoiceArt hues={[tint(preset.key)]} path={top?.backdrop_path ?? null} />
			<span className="truncate">{preset.label}</span>
			<span className="ml-auto shrink-0 rounded-md bg-black/30 px-1 text-[11px] tabular-nums">
				{n === null ? "" : compactCount(n)}
			</span>
		</motion.button>
	)
}

function YearField({
	label,
	value,
	now,
	onCommit,
}: {
	label: string
	value: number
	now: number
	onCommit: (year: number) => void
}) {
	const commit = (text: string) => {
		const year = Number(text)
		if (text.trim() && Number.isFinite(year))
			onCommit(Math.min(now, Math.max(YEAR_MIN, Math.round(year))))
	}
	return (
		<label className="flex flex-col gap-1">
			<span className={LABEL}>{label}</span>
			<input
				key={value}
				type="number"
				inputMode="numeric"
				min={YEAR_MIN}
				max={now}
				defaultValue={value}
				onBlur={(event) => commit(event.currentTarget.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") commit(event.currentTarget.value)
				}}
				className="h-10 w-24 rounded-lg border-0 bg-white/[0.06] px-3 text-[15px] tabular-nums text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-amber-400"
			/>
		</label>
	)
}

function YearFields({
	span,
	now,
	onSpan,
}: {
	span: YearSpan
	now: number
	onSpan: (span: YearSpan) => void
}) {
	return (
		<div className="flex items-end gap-3">
			<YearField
				label="From"
				value={span[0]}
				now={now}
				onCommit={(year) => onSpan([Math.min(year, span[1]), span[1]])}
			/>
			<span className="pb-2.5 text-gray-600">to</span>
			<YearField
				label="To"
				value={span[1]}
				now={now}
				onCommit={(year) => onSpan([span[0], Math.max(year, span[0])])}
			/>
		</div>
	)
}

export function ReleasedTab({ view }: { view: SubTabView }) {
	const { phone } = view
	const { state, set } = view.filters
	const now = currentYear()
	const span = yearSpan(state, now)
	const any = anyYear(span, now)
	const years = view.counts?.optionCounts.years
	const count = (range: FilterRange) => yearsCount(years, range)
	const all = count({})
	const params = new URLSearchParams(view.filters.query)
	if (view.page.ranked !== null)
		params.set("ranked", view.page.ranked.join(","))
	const tops = useReleasedTops(
		params.toString(),
		view.data.context.member,
		view.page.countsFresh &&
			(!view.filters.searching || view.page.ranked !== null),
	)
	const news = newYearPresets(now)
	const afters = afterYearPresets(now)
	const presetOn = (preset: YearPreset) =>
		sameSpan(span, spanOf(preset.years, now))
	const toggle = (preset: YearPreset) =>
		set(togglePresetPatch(state, preset.years, now))
	const setSpan = (next: YearSpan) => set(yearsPatch(next, now))

	const decades = decadeCounts(years, now)
	// Square root, so the older decades still read next to the 2010s.
	const tallest = Math.sqrt(Math.max(1, ...decades.map((d) => d.count ?? 0)))
	const BAR = phone ? 64 : 80
	const drag = useDecadeDrag((a, b) =>
		set(dragDecadesPatch(state, decades[a].start, decades[b].start, now)),
	)
	const lit = (i: number) =>
		drag.span
			? i >= drag.span[0] && i <= drag.span[1]
			: any || decadeInSpan(decades[i].start, span, now)

	const newRow = (
		<div className={`grid gap-2 ${phone ? "grid-cols-2" : "grid-cols-4"}`}>
			{news.map((preset) => (
				<NewTile
					key={preset.key}
					preset={preset}
					on={presetOn(preset)}
					n={count(preset.years)}
					all={all}
					now={now}
					onClick={() => toggle(preset)}
				/>
			))}
		</div>
	)
	const afterRow = (
		<div className={phone ? "grid grid-cols-2 gap-2" : "flex flex-col gap-1.5"}>
			{afters.map((preset) => (
				<AfterChip
					key={preset.key}
					preset={preset}
					on={presetOn(preset)}
					n={count(preset.years)}
					top={tops.get(PANEL_PRESET_IDS[preset.key])}
					phone={phone}
					onClick={() => toggle(preset)}
				/>
			))}
		</div>
	)
	const timeline = (
		<div>
			<div className="mb-2 flex h-5 items-center gap-2">
				<span className={LABEL}>Decades</span>
				<span className="ml-auto">
					<ClearLink show={!any} onClick={() => set(anyYearPatch())}>
						Any year
					</ClearLink>
				</span>
			</div>
			{/* Inset by half a slider thumb, so the columns line up with the slider's years. */}
			<div className="px-[10px]">
				<div
					{...drag.bind}
					className="grid touch-pan-y gap-px select-none"
					style={{
						gridTemplateColumns: decades
							.map(({ start }) => `${Math.min(start + 9, now) - start + 1}fr`)
							.join(" "),
					}}
				>
					{decades.map(({ start, count: n }, i) => {
						const on = lit(i)
						const picked = !any && decadeInSpan(start, span, now)
						const h = n === null ? 0.05 : Math.max(0.04, Math.sqrt(n) / tallest)
						const hue = tint(start)
						const poster = tops.get(panelDecadeId(start))?.poster_path ?? null
						return (
							<motion.button
								key={start}
								type="button"
								aria-pressed={picked}
								aria-label={`The ${start}s${n === null ? "" : `, ${n.toLocaleString("en")} titles`}`}
								whileTap={drag.span ? undefined : TAP}
								onClick={drag.click(() =>
									set(tapDecadePatch(state, start, now)),
								)}
								className="group relative flex min-w-0 flex-col items-center gap-1 rounded-lg pt-0.5 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								{/* The span being dragged. */}
								<span
									className="pointer-events-none absolute inset-0 rounded-lg bg-white/[0.07] transition-opacity duration-150"
									style={{ opacity: drag.span && on ? 1 : 0 }}
								/>
								<span
									className={`relative block aspect-[2/3] max-w-full overflow-hidden rounded-md bg-white/[0.06] ring-1 ring-white/10 transition-opacity duration-300 ${phone ? "h-[36px]" : "w-[42px]"} ${on ? "opacity-100" : "opacity-35 group-hover:opacity-70"}`}
								>
									{poster && (
										<img
											src={posterUrl(poster, "w154")}
											alt=""
											loading="lazy"
											draggable={false}
											className="absolute inset-0 h-full w-full object-cover"
										/>
									)}
								</span>
								<span className="relative w-full" style={{ height: BAR }}>
									<span
										className="absolute inset-x-0 bottom-0 h-full origin-bottom rounded-t-md transition-[transform,opacity] duration-300 motion-reduce:transition-none"
										style={{
											transform: `scaleY(${h})`,
											opacity: any && !drag.span ? 0.75 : on ? 1 : 0.22,
											background: `linear-gradient(to top, ${hue}, ${hue}b3)`,
										}}
									/>
									{!phone && (
										<span
											className={`absolute inset-x-0 top-0 text-center text-[11px] font-semibold tabular-nums transition-transform duration-300 ${any || picked ? "text-white" : "text-gray-500"}`}
											style={{
												transform: `translateY(${Math.max(0, (1 - h) * BAR - 17)}px)`,
											}}
										>
											{n === null ? "" : compactCount(n)}
										</span>
									)}
								</span>
								<span
									className={`w-full border-t pt-1 text-center tabular-nums ${phone ? "text-[10px]" : "text-[12px]"} ${picked ? "border-white/40 font-semibold text-white" : "border-white/10 text-gray-400"}`}
								>
									{phone ? `’${String(start).slice(2)}` : `${start}s`}
								</span>
							</motion.button>
						)
					})}
				</div>
			</div>
			<div className="mt-2">
				<RangeSlider
					label="Released"
					min={YEAR_MIN}
					max={now}
					step={1}
					value={span}
					format={(year) =>
						year <= YEAR_MIN ? "Any year" : year >= now ? "Now" : String(year)
					}
					onCommit={setSpan}
				/>
			</div>
		</div>
	)

	if (phone)
		return (
			<div className={`${tabPad(true)} flex flex-col gap-5`}>
				<div>
					<div className={`mb-2 flex h-5 items-center ${LABEL}`}>New</div>
					{newRow}
				</div>
				{timeline}
				{afterRow}
				<YearFields span={span} now={now} onSpan={setSpan} />
			</div>
		)
	return (
		<div className={`${tabPad(false)} flex flex-col gap-3`}>
			<div className="flex items-end gap-6">
				<div className="min-w-0 flex-1">
					<div className={`mb-2 flex h-5 items-center ${LABEL}`}>New</div>
					{newRow}
				</div>
				{afterRow}
				<div className="border-l border-white/[0.07] pl-6">
					<YearFields span={span} now={now} onSpan={setSpan} />
				</div>
			</div>
			{timeline}
		</div>
	)
}
