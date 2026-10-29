// PROTOTYPE (Discover lab, round 16): shared pieces of the popularity, money and show filters (store.ts): simulated
// counts, preset tiles and a stepped range slider.
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useState } from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import type { ProtoDiscover } from "../../../kit"
import { ResetLink, Tile } from "../released/parts"
import {
	type Idx,
	type MoreKey,
	type MoreState,
	PRESETS,
	ROI_SHARE,
	SCALES,
	STATUS_SHARE,
	isAny,
	last,
	sameIdx,
	setMore,
	shareOf,
	spanLabel,
} from "./store"

type Kind = "all" | "movie" | "show"

/** Titles of a kind in the list now: the type's option counts, the list's total for both kinds. */
export function kindBase(d: ProtoDiscover, kind: Kind): number | null {
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
export function shownSpan(k: MoreKey, r: Idx | null) {
	if (isAny(k, r) || !r) return "Any"
	const t = spanLabel(k, r).replace(/^./, (c) => c.toUpperCase())
	return k === "seasons" ? `${t} ${t === "1" ? "season" : "seasons"}` : t
}

/** A heading: name, a quiet note, the choice's span or count, Any on the right once set. */
export function GroupHead({ title, note, set, onAny, right }: { title: ReactNode; note?: ReactNode; set: boolean; onAny: () => void; right?: ReactNode }) {
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

/** Preset tiles with counts: tap picks, tap again clears. */
export function PresetTiles({ k, x, d, cols }: { k: MoreKey; x: MoreState; d: ProtoDiscover; cols: string }) {
	const sim = useSim(d, x)
	return (
		<div className={`grid gap-2 ${cols}`}>
			{PRESETS[k].map((p) => (
				<Tile key={p.label} label={p.label} sub={p.sub} count={sim.range(k, p.range)} active={sameIdx(x[k], p.range)} onClick={() => toggleRange(x, k, p.range)} />
			))}
		</div>
	)
}

/**
 * The sheet's RangeSlider over a scale's stops, with the span read as one label ("Under 10K") so uneven steps read
 * right. Commits after a short pause, like the sheet's.
 */
export function StopSlider({ k, value, label }: { k: MoreKey; value: Idx | null; label: string }) {
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
