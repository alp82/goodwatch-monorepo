// PROTOTYPE (Discover lab, round 21, locked to a in round 22): the header search's results, in place of the open
// tab's content: columns by tab (Search, Mood, Watch, You), each sub-tab's name as a quiet label, picked in place. The
// field keeps its text, so several picks in a row work. ↑ ↓ move, Enter picks the highlighted one (else the best).
// Round 22: titles and people show 4 each, "More titles" / "More people" grows the group in place (12, then 12 more a
// tap); "In Titles" / "In Cast and crew" opens that sub-tab with the text in its field.
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, PlusIcon, Square2StackIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type MutableRefObject, useEffect, useRef, useState } from "react"
import { TAP } from "~/ui/filter-bar/motion"
import type { SegKey, Sub, SubId } from "../layouts"
import { PRIVATE, SEG_LABEL } from "../shell-parts"
import { chipStyle } from "../sections/titles/ghi-parts"
import type { Nav } from "./field"
import type { Hit } from "./hits"

type RowKind = "title" | "person"
export interface Totals {
	title: { n: number; complete: boolean }
	person: { n: number; complete: boolean }
}

export interface FindProps {
	/** Hits in sub-tabs this viewer has (Budget hides with shows only, Age without a ladder). */
	hits: Hit[]
	totals: Totals
	loading: boolean
	text: string
	order: SegKey[]
	subsOf: (seg: SegKey) => Sub[]
	label: (s: Sub) => string
	phone: boolean
	onPick: (h: Hit) => void
	nav: MutableRefObject<Nav | null>
	/** Opens the full search for a group in its sub-tab, with the text in its field. */
	onOpenFull: (kind: RowKind) => void
}

const CHIPS = 12
/** Titles and people at first, after the first More, and added by each More after that. */
const ROWS = 4
const STEP = 12
const LIKE = "#fb7185"
const PURPLE = "#c084fc"
const FULL: Record<RowKind, { more: string; open: string }> = {
	title: { more: "More titles", open: "In Titles" },
	person: { more: "More people", open: "In Cast and crew" },
}

interface SubGroup {
	sub: Sub
	hits: Hit[]
	/** Titles or people in this sub-tab past the shown ones. */
	rest: { kind: RowKind; n: number } | null
}
interface SegGroup {
	seg: SegKey
	subs: SubGroup[]
}

const byScore = (a: Hit, b: Hit) => b.score - a.score

/** Hits by tab and sub-tab in the bar's order, best first inside each; chips capped, titles and people at `rows`. */
function grouped(hits: Hit[], order: SegKey[], subsOf: (seg: SegKey) => Sub[], rows: Record<RowKind, number>): SegGroup[] {
	return order
		.map((seg) => ({
			seg,
			subs: subsOf(seg)
				.map((sub) => {
					const mine = hits.filter((h) => h.seg === seg && h.sub === sub.id).sort(byScore)
					let rest: SubGroup["rest"] = null
					const kept = (["chip", "title", "person"] as const).flatMap((k) => {
						const all = mine.filter((h) => h.kind === k)
						const cap = k === "chip" ? CHIPS : rows[k]
						if (k !== "chip" && all.length > cap) rest = { kind: k, n: all.length - cap }
						return all.slice(0, cap)
					})
					return { sub, hits: kept.sort(byScore), rest }
				})
				.filter((g) => g.hits.length > 0),
		}))
		.filter((g) => g.subs.length > 0)
}

/** ↑ ↓ over `flat`, Enter picks the highlighted one (or the best fit). Resets when the text changes. */
function useNav(flat: Hit[], onPick: (h: Hit) => void, nav: MutableRefObject<Nav | null>, reset: string, box: React.RefObject<HTMLElement>) {
	const [active, setActive] = useState(-1)
	useEffect(() => setActive(-1), [reset])
	const live = useRef({ flat, onPick, active })
	live.current = { flat, onPick, active }
	useEffect(() => {
		nav.current = {
			move: (delta) =>
				setActive((a) => {
					const n = live.current.flat.length
					if (!n) return -1
					return a < 0 ? (delta > 0 ? 0 : n - 1) : (a + delta + n) % n
				}),
			enter: () => {
				const { flat: f, active: a, onPick: pick } = live.current
				const h = f[a] ?? [...f].sort(byScore)[0]
				if (h) pick(h)
			},
		}
		return () => {
			nav.current = null
		}
	}, [nav])
	useEffect(() => {
		if (active >= 0) box.current?.querySelector<HTMLElement>(`[data-hit="${active}"]`)?.scrollIntoView({ block: "nearest" })
	}, [active, box])
	return { active, setActive }
}

export function FindResults(p: FindProps) {
	const box = useRef<HTMLDivElement>(null)
	const [rows, setRows] = useState<Record<RowKind, number>>({ title: ROWS, person: ROWS })
	// biome-ignore lint/correctness/useExhaustiveDependencies: new text, first rows again
	useEffect(() => setRows({ title: ROWS, person: ROWS }), [p.text])
	const groups = grouped(p.hits, p.order, p.subsOf, rows)
	const flat = groups.flatMap((g) => g.subs.flatMap((s) => s.hits))
	const nav = useNav(flat, p.onPick, p.nav, p.text, box)
	const at = (h: Hit) => flat.indexOf(h)
	const grow = (k: RowKind) => setRows((r) => ({ ...r, [k]: r[k] <= ROWS ? STEP : r[k] + STEP }))
	const ctx: Ctx = { p, at, nav, rows, grow }
	return (
		<div ref={box} role="listbox" aria-label="Found in every tab" className={p.phone ? "" : "px-6 py-4"} data-find-results="a">
			{flat.length === 0 ? (
				<p className="flex h-24 items-center justify-center text-[15px] text-gray-400">
					{p.loading ? (
						"Looking…"
					) : (
						<>
							Nothing called <span className={`ml-1 font-semibold text-white ${PRIVATE}`}>“{p.text.trim()}”</span>
						</>
					)}
				</p>
			) : p.phone ? (
				<div className="flex flex-col gap-6">
					{groups.map((g) => (
						<TabBlock key={g.seg} c={ctx} g={g} />
					))}
				</div>
			) : (
				<div className="grid items-start gap-8" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
					{groups.map((g, i) => (
						<div key={g.seg} className={i ? "border-l border-white/[0.06] pl-8" : ""}>
							<TabBlock c={ctx} g={g} />
						</div>
					))}
				</div>
			)}
		</div>
	)
}

type NavState = { active: number; setActive: (i: number) => void }
interface Ctx {
	p: FindProps
	at: (h: Hit) => number
	nav: NavState
	rows: Record<RowKind, number>
	grow: (k: RowKind) => void
}

function TabBlock({ c, g }: { c: Ctx; g: SegGroup }) {
	return (
		<section className="min-w-0">
			<header className="mb-3 flex items-center gap-2.5">
				<span className="h-3.5 w-1 rounded-full bg-amber-400" aria-hidden />
				<h3 className="text-[15px] font-bold text-white">{SEG_LABEL[g.seg]}</h3>
			</header>
			<div className="flex flex-col gap-3.5">
				{g.subs.map((s) => (
					<div key={s.sub.id} className="min-w-0">
						<p className="mb-1.5 text-[12px] text-gray-500">{c.p.label(s.sub)}</p>
						<Items c={c} s={s} />
					</div>
				))}
			</div>
		</section>
	)
}

/** Chips wrap; titles and people are rows, with More and the full search under them. */
function Items({ c, s }: { c: Ctx; s: SubGroup }) {
	const { p, at, nav } = c
	const chips = s.hits.filter((h) => h.kind === "chip")
	const rows = s.hits.filter((h) => h.kind !== "chip")
	const kind = (rows[0]?.kind ?? null) as RowKind | null
	return (
		<div className="flex flex-col gap-2">
			{rows.length > 0 && (
				<div className={`grid gap-1 ${p.phone ? "" : "grid-cols-[repeat(auto-fill,minmax(250px,1fr))]"}`}>
					{rows.map((h) => (
						<HitRow key={h.key} h={h} i={at(h)} nav={nav} onPick={p.onPick} />
					))}
				</div>
			)}
			{kind && <MoreLine c={c} kind={kind} shown={rows.length} rest={s.rest?.kind === kind ? s.rest.n : 0} />}
			{chips.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{chips.map((h) => (
						<HitChip key={h.key} h={h} i={at(h)} nav={nav} onPick={p.onPick} />
					))}
				</div>
			)}
		</div>
	)
}

/**
 * Under a group of titles or people: More (primary, grows the group here) with how many the search found, and the
 * full search in its sub-tab (secondary, quiet, at the right). With nothing more to show, only the second stays.
 */
function MoreLine({ c, kind, shown, rest }: { c: Ctx; kind: RowKind; shown: number; rest: number }) {
	const t = c.p.totals[kind]
	const total = t.complete ? String(t.n) : `${t.n}+`
	return (
		<div className="flex h-9 min-w-0 items-center gap-2" data-find-more-line={kind}>
			{rest > 0 && (
				<motion.button
					type="button"
					whileTap={TAP}
					onClick={() => c.grow(kind)}
					data-find-more={kind}
					className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] pr-3 pl-3.5 text-[13px] font-semibold text-gray-200 ring-1 ring-white/10 cursor-pointer outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					{FULL[kind].more}
					<span className="text-[12px] font-normal tabular-nums text-gray-500">
						{shown} of {total}
					</span>
					<ChevronDownIcon className="h-4 w-4 text-gray-400" aria-hidden />
				</motion.button>
			)}
			<button
				type="button"
				onClick={() => c.p.onOpenFull(kind)}
				data-find-full={kind}
				className="ml-auto flex h-9 min-w-0 items-center gap-1 rounded-full px-2.5 text-[13px] text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<span className="truncate">{FULL[kind].open}</span>
				<ArrowRightIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
			</button>
		</div>
	)
}

function HitChip({ h, i, nav, onPick }: { h: Hit; i: number; nav: NavState; onPick: (h: Hit) => void }) {
	const hot = nav.active === i
	return (
		<motion.button
			type="button"
			data-hit={i}
			data-hit-value={h.value ? "" : undefined}
			role="option"
			aria-selected={hot}
			aria-pressed={h.on}
			aria-disabled={h.locked || undefined}
			whileTap={h.locked ? undefined : TAP}
			onMouseEnter={() => nav.setActive(i)}
			onClick={() => onPick(h)}
			className={`flex h-9 max-w-full items-center gap-2 rounded-full pr-2.5 pl-3 text-sm whitespace-nowrap outline-none transition-colors ${
				h.on
					? "bg-white font-bold text-gray-950 shadow-[0_6px_20px_-6px_rgba(255,255,255,.35)]"
					: h.locked
						? "bg-white/[0.03] text-gray-500 ring-1 ring-white/5 cursor-default"
						: "bg-white/[0.06] text-gray-200 ring-1 ring-white/10 hover:bg-white/10 cursor-pointer"
			} ${hot ? "!ring-2 !ring-amber-400" : ""}`}
		>
			{h.art}
			<span className="truncate">{h.label}</span>
			<span aria-hidden className="shrink-0 text-xs tabular-nums text-gray-500">
				{h.on ? <CheckIcon className="h-3.5 w-3.5" /> : (h.note ?? "")}
			</span>
		</motion.button>
	)
}

/** A title (Like this) or a person (Cast and crew), as titles g shows them. */
function HitRow({ h, i, nav, onPick }: { h: Hit; i: number; nav: NavState; onPick: (h: Hit) => void }) {
	const hot = nav.active === i
	const color = h.kind === "title" ? LIKE : PURPLE
	const action = h.kind === "title" ? "Like this" : "Cast and crew"
	return (
		<button
			type="button"
			data-hit={i}
			data-hit-kind={h.kind}
			role="option"
			aria-selected={hot}
			aria-pressed={h.on}
			onMouseEnter={() => nav.setActive(i)}
			onClick={() => onPick(h)}
			className={`flex h-11 min-w-0 items-center gap-2.5 rounded-xl px-2.5 text-left cursor-pointer outline-none ${hot ? "bg-white/[0.08] ring-1 ring-inset ring-amber-400/70" : "hover:bg-white/[0.04]"}`}
		>
			{h.art}
			<span className="min-w-0 flex-1">
				<span className="block truncate text-[14px] font-semibold text-gray-100">{h.label}</span>
				<span className="block truncate text-[12px] text-gray-500">{h.note}</span>
			</span>
			<span
				className={`flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap ${h.on ? "text-white" : "text-gray-400 ring-1 ring-inset ring-white/10"}`}
				style={h.on ? chipStyle(color) : undefined}
			>
				{h.on ? <CheckIcon className="h-3.5 w-3.5" /> : h.kind === "title" ? <Square2StackIcon className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />}
				{action}
			</span>
		</button>
	)
}
