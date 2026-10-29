// The tiles, chips and blocks the Popularity, Shows and Budget sub-tabs share. Each group draws in its own soft hue
// (ratings blue, popularity rose, budget sage, box office gold, seasons violet, Hit warm orange, Flop steel) with one
// quiet glow from the glyph's corner, stronger for bigger presets. A picked tile fades in a light fill of its hue and its
// glyph turns a deep shade of it. Time to finish and Status stay gray; picked, only the glyph or mark takes a hue.
//
// Only opacity and transform move: the picked fill fades in, colors change at once, taps scale.
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import type { FilterRange, FilterState } from "~/domain/filter-state"
import { RangeSlider } from "~/ui/filter-bar/SheetControls"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import type { SubTabView } from "../DiscoverControls"
import { appliedStateOf } from "../tabs"
import { type GridTones, PresetGlyph, StatusMark } from "./glyphs"
import { BlockHead, ClearLink } from "./parts"
import {
	STEPPED,
	type SteppedField,
	fieldRange,
	isPreset,
	presetCount,
	presetStrength,
	rangeSpan,
	spanRange,
	togglePreset,
} from "./stepped-choices"

export interface Hue {
	h: number
	s: number
	/** The glow's strongest alpha. */
	max: number
}

export const HUES = {
	votes: { h: 205, s: 42, max: 0.3 },
	popularityRank: { h: 338, s: 38, max: 0.34 },
	budget: { h: 152, s: 32, max: 0.3 },
	boxOffice: { h: 40, s: 44, max: 0.3 },
	seasons: { h: 262, s: 30, max: 0.2 },
	hit: { h: 22, s: 50, max: 0.26 },
	flop: { h: 214, s: 30, max: 0.26 },
} satisfies Record<string, Hue>

/** The quiet groups' hues: only a picked glyph or mark shows them. */
const HOURS_HUE = { h: 186, s: 34 }
export const STATUS_HUES = {
	running: { h: 148, s: 38 },
	ended: { h: 214, s: 30 },
	canceled: { h: 2, s: 40 },
} as const

const hsla = (c: Hue, a: number, l = 62) =>
	`hsla(${c.h}, ${c.s}%, ${l}%, ${a.toFixed(3)})`

export interface TileState {
	active: boolean
	dead: boolean
}

/** A glyph's color: the hue at rest, a deep shade on the picked fill, gray when dead. */
const glyphColor = (c: Hue, { active, dead }: TileState) =>
	active
		? `hsl(${c.h}, ${Math.min(c.s + 6, 48)}%, 30%)`
		: dead
			? undefined
			: `hsl(${c.h}, ${c.s + 12}%, 68%)`

/** Seasons' grid shades, best to weakest episode. */
function gridTones(c: Hue, { active }: TileState): GridTones {
	const s = Math.min(c.s + 10, 48)
	return active
		? [
				`hsl(${c.h}, ${s}%, 28%)`,
				`hsl(${c.h}, ${s - 4}%, 42%)`,
				`hsl(${c.h}, ${s - 8}%, 58%)`,
			]
		: [
				`hsl(${c.h}, ${s}%, 76%)`,
				`hsl(${c.h}, ${s - 4}%, 61%)`,
				`hsl(${c.h}, ${s - 8}%, 47%)`,
			]
}

/** The glow behind the glyph, a faint hue edge, and the picked fill. `strength` runs 0 to 1. */
function Glow({
	hue,
	strength,
	active,
	dead,
}: {
	hue: Hue
	strength: number
	active: boolean
	dead: boolean
}) {
	const alpha = hue.max * 0.68 * (0.25 + 0.75 * strength)
	return (
		<span aria-hidden className="pointer-events-none absolute inset-0 -z-10">
			<span className="absolute inset-0" style={{ opacity: dead ? 0.2 : 1 }}>
				<span
					className="absolute inset-0"
					style={{
						background: `radial-gradient(120% 150% at 0% 0%, ${hsla(hue, alpha)} 0%, ${hsla(hue, 0)} 70%)`,
					}}
				/>
				<span
					className="absolute inset-0 rounded-xl"
					style={{
						boxShadow: `inset 0 0 0 1px ${hsla(hue, 0.06 + 0.12 * strength, 70)}`,
					}}
				/>
			</span>
			<motion.span
				initial={false}
				animate={{ opacity: active ? 1 : 0 }}
				transition={{ duration: 0.18 }}
				className="absolute inset-0"
				style={{
					background: `hsl(${hue.h}, ${Math.min(hue.s + 8, 52)}%, 78%)`,
				}}
			/>
		</span>
	)
}

/**
 * A preset tile: the glyph and the count on top, the label and a quiet note under them. With a hue it carries the
 * group's glow and picked fill; without one it is gray and turns white when picked. Nothing moves when it is picked.
 */
export function GlyphTile({
	label,
	note,
	count,
	active,
	onClick,
	hue,
	strength = 1,
	glyph,
}: {
	label: string
	note: string
	count: number | null
	active: boolean
	onClick: () => void
	hue?: Hue
	strength?: number
	glyph: (state: TileState) => ReactNode
}) {
	const dead = !active && count === 0
	const state = { active, dead }
	const soft = hue && !active ? { color: `hsl(${hue.h}, ${hue.s}%, 64%)` } : {}
	const fill = hue
		? `${dead ? "bg-white/[0.015]" : "bg-white/[0.03] hover:bg-white/[0.06]"} ${active ? "text-gray-950" : dead ? "text-gray-600" : "text-gray-100"}`
		: active
			? "bg-white text-gray-950"
			: dead
				? "bg-white/[0.02] text-gray-600"
				: "bg-white/[0.06] text-gray-100 hover:bg-white/[0.11]"
	const tone = active
		? "text-amber-600"
		: dead
			? "text-gray-700"
			: "text-gray-400 group-hover:text-gray-300"
	return (
		<motion.button
			type="button"
			aria-pressed={active}
			whileTap={TAP}
			onClick={onClick}
			className={`group relative isolate flex min-w-0 flex-col items-start gap-1.5 overflow-hidden rounded-xl px-3 py-2.5 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${fill}`}
		>
			{hue && (
				<Glow hue={hue} strength={strength} active={active} dead={dead} />
			)}
			<span className="flex h-4 w-full items-center gap-2">
				<span className={`flex min-w-0 items-center ${tone}`}>
					{glyph(state)}
				</span>
				<span
					className={`ml-auto shrink-0 text-[11px] tabular-nums ${active ? "text-gray-600" : "text-gray-500"}`}
					style={soft}
				>
					{count === null ? "" : compactCount(count)}
				</span>
			</span>
			<span className="flex w-full min-w-0 flex-col gap-0.5">
				<span className="truncate text-[14px] leading-tight font-semibold">
					{label}
				</span>
				<span
					className={`truncate text-[12px] ${active ? "text-gray-600" : "text-gray-500"}`}
					style={soft}
				>
					{note}
				</span>
			</span>
		</motion.button>
	)
}

/** A chip with a mark before the label (Status). Gray; a picked chip turns white and its mark takes its hue. */
export function MarkChip({
	label,
	status,
	count,
	active,
	onClick,
}: {
	label: string
	status: keyof typeof STATUS_HUES
	count: number | null
	active: boolean
	onClick: () => void
}) {
	const dead = !active && count === 0
	const hue = STATUS_HUES[status]
	return (
		<motion.button
			type="button"
			aria-pressed={active}
			whileTap={TAP}
			onClick={onClick}
			className={`group flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-[13px] font-medium whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
				active
					? "bg-white text-gray-950"
					: dead
						? "bg-white/[0.02] text-gray-600"
						: "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white"
			}`}
		>
			<span
				className={`flex ${active ? "" : dead ? "text-gray-700" : "text-gray-400 group-hover:text-gray-300"}`}
				style={active ? { color: `hsl(${hue.h}, ${hue.s}%, 36%)` } : undefined}
			>
				<StatusMark status={status} />
			</span>
			{label}
			<span
				className={`inline-grid w-[6ch] shrink-0 text-right text-[11px] tabular-nums ${active ? "text-gray-600" : "text-gray-500"}`}
			>
				<span aria-hidden="true" className="invisible col-start-1 row-start-1">
					999.9M
				</span>
				<span className="col-start-1 row-start-1">
					{count === null ? "" : compactCount(count)}
				</span>
			</span>
		</motion.button>
	)
}

/** A group's glyph in its color. */
function HueGlyph({
	field,
	i,
	state,
}: {
	field: SteppedField
	i: number
	state: TileState
}) {
	if (field === "hours")
		return (
			<span
				className="flex"
				style={
					state.active
						? { color: `hsl(${HOURS_HUE.h}, ${HOURS_HUE.s}%, 36%)` }
						: undefined
				}
			>
				<PresetGlyph field={field} i={i} />
			</span>
		)
	const hue = HUES[field]
	return (
		<span className="flex" style={{ color: glyphColor(hue, state) }}>
			<PresetGlyph
				field={field}
				i={i}
				tones={
					field === "seasons" && !state.dead ? gridTones(hue, state) : undefined
				}
			/>
		</span>
	)
}

/** The tile for Hit or Flop: the trend line in its hue. */
export function hueGlyph(hue: Hue, state: TileState, glyph: ReactNode) {
	return (
		<span className="flex" style={{ color: glyphColor(hue, state) }}>
			{glyph}
		</span>
	)
}

/** The counts block a field reads. */
export function fieldCounts(
	view: SubTabView,
	field: SteppedField,
): Record<string, number> | null {
	return view.counts?.optionCounts[STEPPED[field].group] ?? null
}

/**
 * One stepped choice: its heading (name, a quiet note, Any once set), the preset tiles and the slider. The slider reads
 * its span as one label and commits after a pause.
 */
export function SteppedBlock({
	view,
	field,
	title,
	note,
	cols,
}: {
	view: SubTabView
	field: SteppedField
	title: string
	note?: string | null
	/** Tile columns: phone, desktop. */
	cols: [string, string]
}) {
	const { state, update } = view.filters
	const scale = STEPPED[field]
	const range = fieldRange(appliedStateOf(state, view.data.context), field)
	const counts = fieldCounts(view, field)
	const set = (next: FilterRange | undefined) =>
		update((st: FilterState) => ({ ...st, [field]: next }))
	return (
		<div className="flex min-w-0 flex-col">
			<BlockHead
				note={note ?? undefined}
				right={
					<ClearLink show={range !== undefined} onClick={() => set(undefined)}>
						Any
					</ClearLink>
				}
			>
				{title}
			</BlockHead>
			<div className={`grid gap-2 ${view.phone ? cols[0] : cols[1]}`}>
				{scale.presets.map((preset, i) => (
					<GlyphTile
						key={preset.key}
						label={preset.label}
						note={preset.note}
						count={presetCount(field, counts, preset)}
						active={isPreset(field, range, preset)}
						onClick={() =>
							update((st) => togglePreset(st, field, preset.range))
						}
						hue={field === "hours" ? undefined : HUES[field]}
						strength={presetStrength(field, i)}
						glyph={(s) => <HueGlyph field={field} i={i} state={s} />}
					/>
				))}
			</div>
			<div className="mt-4">
				<RangeSlider
					label={title}
					min={0}
					max={scale.stops.length - 1}
					step={1}
					value={rangeSpan(field, range)}
					format={scale.stopLabel}
					formatTo={scale.hiLabel}
					readout={(span) => scale.spanLabel(span)}
					onCommit={(span) => set(spanRange(field, span))}
				/>
			</div>
		</div>
	)
}
