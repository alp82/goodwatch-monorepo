// PROTOTYPE (Discover lab, round 16): shared pieces of the popularity, money and show filters (store.ts): simulated
// counts, a stepped range slider, the section's layout (MoreView, which takes a skin) and the groups' hues.
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useState } from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import type { ProtoDiscover } from "../../../kit"
import type { SectionProps } from "../../types"
import { ResetLink, pad } from "../released/parts"
import { type Idx, type MoreKey, type MoreState, ROI_SHARE, SCALES, type Roi, STATUS_SHARE, isAny, last, sameIdx, setMore, shareOf, spanLabel, useMore } from "./store"

type Kind = "all" | "movie" | "show"

/** Titles of a kind in the list now: the type's option counts, the list's total for both kinds. */
function kindBase(d: ProtoDiscover, kind: Kind): number | null {
	const type = d.filters.state.type
	if (kind === "all") return d.total
	if (type !== "all") return type === kind ? d.total : 0
	return d.counts?.optionCounts.type?.[kind] ?? null
}

/** The other lab-only choices of the same kind (or both) narrow too, as if independent. */
function others(x: MoreState, except: string, kind: Kind) {
	let f = 1
	for (const k of Object.keys(SCALES) as MoreKey[]) {
		const s = SCALES[k]
		if (k === except || (s.kind !== "all" && kind !== "all" && s.kind !== kind)) continue
		f *= shareOf(k, x[k])
	}
	if (except !== "roi" && x.roi && kind !== "show") f *= ROI_SHARE[x.roi]
	if (except !== "status" && x.status && kind !== "movie") f *= STATUS_SHARE[x.status]
	return f
}

/** What a choice would leave, simulated; null while the list is counting. */
export function useSim(d: ProtoDiscover, x: MoreState) {
	const pending = !d.countsFresh
	const of = (key: string, kind: Kind, share: number) => {
		const base = kindBase(d, kind)
		return base == null || pending ? null : Math.round(base * share * others(x, key, kind))
	}
	return {
		range: (k: MoreKey, r: Idx | null) => of(k, SCALES[k].kind, shareOf(k, r)),
		roi: (v: keyof typeof ROI_SHARE) => of("roi", "movie", ROI_SHARE[v]),
		status: (v: keyof typeof STATUS_SHARE) => of("status", "show", STATUS_SHARE[v]),
		/** The kind's titles with this key's own choice off. */
		base: (k: MoreKey) => of(k, SCALES[k].kind, 1),
	}
}

export const toggleRange = (x: MoreState, k: MoreKey, r: Idx) => setMore({ [k]: sameIdx(x[k], r) ? null : r })

/** The range as shown: Any, or "Under 10K" style spans. */
function shownSpan(k: MoreKey, r: Idx | null) {
	if (isAny(k, r) || !r) return "Any"
	const t = spanLabel(k, r).replace(/^./, (c) => c.toUpperCase())
	return k === "seasons" ? `${t} ${t === "1" ? "season" : "seasons"}` : t
}

/** A heading: name, a quiet note, the choice's span or count, Any on the right once set. */
function GroupHead({ title, note, set, onAny, right }: { title: ReactNode; note?: ReactNode; set: boolean; onAny: () => void; right?: ReactNode }) {
	return (
		<div className="flex h-7 items-center gap-2.5">
			<h4 className="text-[15px] font-semibold text-gray-100">{title}</h4>
			{note != null && <span className="text-[13px] tabular-nums text-gray-500">{note}</span>}
			<span className="ml-auto flex items-center gap-2">
				{right}
				<ResetLink show={set} onClick={onAny} />
			</span>
		</div>
	)
}

/**
 * The sheet's RangeSlider over a scale's stops, with the span read as one label ("Under 10K") so uneven steps read
 * right. Commits after a short pause, like the sheet's.
 */
function StopSlider({ k, value, label }: { k: MoreKey; value: Idx | null; label: string }) {
	const n = last(k)
	const cur: Idx = value ?? [0, n]
	const [v, setV] = useState<Idx>(cur)
	const key = cur.join(",")
	useEffect(() => setV(cur), [key])
	useEffect(() => {
		if (v.join(",") === key) return
		const id = setTimeout(() => setMore({ [k]: v[0] <= 0 && v[1] >= n ? null : v }), 350)
		return () => clearTimeout(id)
	})
	const pct = (i: number) => (i / n) * 100
	const full = v[0] <= 0 && v[1] >= n
	const s = SCALES[k]
	const thumb =
		"pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,.6)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
	return (
		<div>
			<div className="mb-1 flex justify-between text-[13px] tabular-nums">
				<span className={full || v[0] <= 0 ? "text-gray-500" : "font-semibold text-white"}>{s.fmt(v[0])}</span>
				<span className="font-semibold text-amber-300">{full ? "" : shownSpan(k, v)}</span>
				<span className={full || v[1] >= n ? "text-gray-500" : "font-semibold text-white"}>{(s.hi ?? s.fmt)(v[1])}</span>
			</div>
			<div className="relative h-6">
				<div className="absolute inset-x-0 top-[10px] h-1 rounded-full bg-white/10" />
				<div
					className={`absolute top-[10px] h-1 rounded-full ${full ? "bg-white/25" : "bg-amber-400"}`}
					style={{ left: `${pct(v[0])}%`, right: `${100 - pct(v[1])}%` }}
				/>
				<input
					type="range"
					aria-label={`${label} from`}
					min={0}
					max={n}
					step={1}
					value={v[0]}
					onChange={(e) => setV([Math.min(Number(e.target.value), v[1] - 1), v[1]])}
					className={thumb}
				/>
				<input
					type="range"
					aria-label={`${label} to`}
					min={0}
					max={n}
					step={1}
					value={v[1]}
					onChange={(e) => setV([v[0], Math.max(Number(e.target.value), v[0] + 1)])}
					className={thumb}
				/>
			</div>
		</div>
	)
}

/** A chip with the quiet count, white when on (SheetControls' Chip, without its Option object). */
export function CountChip({ label, count, active, onClick }: { label: string; count: number | null; active: boolean; onClick: () => void }) {
	const dead = !active && count === 0
	return (
		<motion.button
			type="button"
			aria-pressed={active}
			whileTap={TAP}
			onClick={onClick}
			className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				active ? "bg-white font-semibold text-gray-950" : dead ? "bg-white/[0.02] text-gray-600" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white"
			}`}
		>
			{label}
			{!active && count != null && <span className="text-[11px] tabular-nums text-gray-500">{compactCount(count)}</span>}
		</motion.button>
	)
}

// The view, shared by every skin (round 16 a's structure).

const NAME: Record<MoreKey, string> = {
	votes: "How many ratings",
	rank: "Popularity",
	budget: "Budget",
	revenue: "Box office",
	seasons: "Seasons",
	finish: "Time to finish",
}

/** Dims a block whose kind is out of the list (Movies only hides shows' facts), as Length d does. */
function offFor(d: ProtoDiscover, kind: "movie" | "show" | "all") {
	const t = d.filters.state.type
	return kind !== "all" && t !== "all" && t !== kind
}

function Block({ off, children }: { off?: boolean; children: ReactNode }) {
	return <div className={`flex min-w-0 flex-col gap-3 transition-opacity ${off ? "opacity-45" : ""}`}>{children}</div>
}

export interface PresetsProps {
	k: MoreKey
	x: MoreState
	d: ProtoDiscover
	cols: string
}
type Part = { d: ProtoDiscover; x: MoreState }

/** How the choices look: preset tiles per range, the Hit and Flop pair, the Status chips. */
export interface Skin {
	Presets: (p: PresetsProps) => JSX.Element
	Roi: (p: Part) => JSX.Element
	Status: (p: Part) => JSX.Element
}

function RangeBlock({ k, d, x, phone, cols, skin }: { k: MoreKey; d: ProtoDiscover; x: MoreState; phone: boolean; cols: [string, string]; skin: Skin }) {
	const base = useSim(d, x).base(k)
	return (
		<>
			<GroupHead title={NAME[k]} note={base != null ? compactCount(base) : ""} set={!isAny(k, x[k])} onAny={() => setMore({ [k]: null })} />
			<skin.Presets k={k} x={x} d={d} cols={phone ? cols[0] : cols[1]} />
			<StopSlider k={k} value={x[k]} label={NAME[k]} />
		</>
	)
}

function Page({ phone, children }: { phone: boolean; children: ReactNode }) {
	return <div className={`${pad(phone)} ${phone ? "flex flex-col gap-7" : "grid grid-cols-2 gap-10"}`}>{children}</div>
}

/** The section's layout (one Watch sub-tab per part) with a skin. */
export function MoreView({ d, phone, morePart: part = "reach", skin }: SectionProps & { skin: Skin }) {
	const x = useMore()
	const two: [string, string] = ["grid-cols-2", "grid-cols-2"]
	if (part === "reach")
		return (
			<Page phone={phone}>
				<Block>
					<RangeBlock k="votes" d={d} x={x} phone={phone} cols={two} skin={skin} />
				</Block>
				<Block>
					<RangeBlock k="rank" d={d} x={x} phone={phone} cols={["grid-cols-2", "grid-cols-3"]} skin={skin} />
				</Block>
			</Page>
		)
	if (part === "money") {
		const off = offFor(d, "movie")
		return (
			<Page phone={phone}>
				<Block off={off}>
					<RangeBlock k="budget" d={d} x={x} phone={phone} cols={two} skin={skin} />
				</Block>
				<Block off={off}>
					<RangeBlock k="revenue" d={d} x={x} phone={phone} cols={["grid-cols-2", "grid-cols-3"]} skin={skin} />
					<skin.Roi d={d} x={x} />
				</Block>
			</Page>
		)
	}
	const off = offFor(d, "show")
	return (
		<Page phone={phone}>
			<Block off={off}>
				<RangeBlock k="seasons" d={d} x={x} phone={phone} cols={two} skin={skin} />
				{/* Round 20: Status under Seasons, so the Seasons and Time to finish tiles line up. */}
				<div className="mt-2 flex flex-col gap-3">
					<GroupHead title="Status" set={x.status !== null} onAny={() => setMore({ status: null })} />
					<skin.Status d={d} x={x} />
				</div>
			</Block>
			<Block off={off}>
				<RangeBlock k="finish" d={d} x={x} phone={phone} cols={two} skin={skin} />
			</Block>
		</Page>
	)
}

/** Round 17: each group's soft hue. */
type Wash = "diagonal" | "corner" | "rise" | "flat"
export interface Hue {
	h: number
	/** Saturation of the wash, kept low. */
	s: number
	wash: Wash
	/** The strongest alpha a wash reaches; quieter groups get less. */
	max: number
}

export const HUES: Partial<Record<MoreKey | Roi, Hue>> = {
	votes: { h: 205, s: 42, wash: "diagonal", max: 0.3 },
	rank: { h: 338, s: 38, wash: "corner", max: 0.34 },
	budget: { h: 152, s: 32, wash: "rise", max: 0.3 },
	revenue: { h: 40, s: 44, wash: "rise", max: 0.3 },
	seasons: { h: 262, s: 30, wash: "flat", max: 0.2 },
	hit: { h: 22, s: 50, wash: "diagonal", max: 0.26 },
	flop: { h: 214, s: 30, wash: "diagonal", max: 0.26 },
}

export const hsla = (c: Hue, a: number, l = 62) => `hsla(${c.h}, ${c.s}%, ${l}%, ${a.toFixed(3)})`
