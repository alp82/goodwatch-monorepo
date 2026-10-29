// PROTOTYPE (Discover lab, round 21): the header search's results, in place of the open tab's content.
// a: grouped by tab (Search, Mood, Watch, You), each sub-tab's name as a quiet label, picked in place.
// b: one ranked list with a breadcrumb per row; a pick toggles it, jumps to its tab and sub-tab and marks it there.
// c: the open tab's matches first (its open sub-tab leading), then "In other tabs"; the tabs carry match counts.
// The field keeps its text in a and c, so several picks in a row work. ↑ ↓ move, Enter picks (the first by default).
import { ArrowTurnDownLeftIcon, CheckIcon, LockClosedIcon, PlusIcon, Square2StackIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type MutableRefObject, type ReactNode, useEffect, useRef, useState } from "react"
import { TAP } from "~/ui/filter-bar/motion"
import type { SegKey, Sub, SubId } from "../layouts"
import { PRIVATE, SEG_LABEL } from "../shell-parts"
import type { HeaderKey } from "../sections/header"
import { SECTION_LABEL } from "../sections/titles/shared"
import { chipStyle } from "../sections/titles/ghi-parts"
import type { Nav } from "./field"
import type { Hit } from "./hits"

export interface FindProps {
	variant: HeaderKey
	/** Hits in sub-tabs this viewer has (Budget hides with shows only, Age without a ladder). */
	hits: Hit[]
	loading: boolean
	text: string
	seg: SegKey
	sub: SubId
	order: SegKey[]
	subsOf: (seg: SegKey) => Sub[]
	label: (s: Sub) => string
	phone: boolean
	onPick: (h: Hit) => void
	nav: MutableRefObject<Nav | null>
}

const CAP = { chip: 12, title: 4, person: 4 } as const
const LIKE = "#fb7185"
const PURPLE = "#c084fc"

interface SubGroup {
	sub: Sub
	hits: Hit[]
}
interface SegGroup {
	seg: SegKey
	subs: SubGroup[]
}

const byScore = (a: Hit, b: Hit) => b.score - a.score

/** Hits by tab and sub-tab in the bar's order, best first inside each, capped per kind. */
function grouped(hits: Hit[], order: SegKey[], subsOf: (seg: SegKey) => Sub[]): SegGroup[] {
	return order
		.map((seg) => ({
			seg,
			subs: subsOf(seg)
				.map((sub) => {
					const mine = hits.filter((h) => h.seg === seg && h.sub === sub.id).sort(byScore)
					const kept = (["chip", "title", "person"] as const).flatMap((k) => mine.filter((h) => h.kind === k).slice(0, CAP[k]))
					return { sub, hits: kept.sort(byScore) }
				})
				.filter((g) => g.hits.length > 0),
		}))
		.filter((g) => g.subs.length > 0)
}

/** Count of hits per tab and per sub-tab, for c's badges. */
export function matchCounts(hits: Hit[]) {
	const seg: Partial<Record<SegKey, number>> = {}
	const sub: Partial<Record<string, number>> = {}
	for (const h of hits) {
		seg[h.seg] = (seg[h.seg] ?? 0) + 1
		sub[h.sub] = (sub[h.sub] ?? 0) + 1
	}
	return { seg, sub }
}

/** ↑ ↓ over `flat`, Enter picks the highlighted one (or the first). Resets when the text changes. */
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
				const h = f[a] ?? f[0]
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
	const groups = grouped(p.hits, p.order, p.subsOf)
	let flat: Hit[]
	let body: (at: (h: Hit) => number, nav: { active: number; setActive: (i: number) => void }) => ReactNode
	if (p.variant === "b") {
		const ranked = groups
			.flatMap((g) => g.subs.flatMap((s) => s.hits.map((h) => ({ h, o: p.order.indexOf(g.seg) }))))
			.sort((a, b) => b.h.score - a.h.score || a.o - b.o)
			.slice(0, p.phone ? 12 : 16)
			.map((x) => x.h)
		flat = ranked
		body = (at, nav) => <Ranked p={p} hits={ranked} at={at} nav={nav} />
	} else if (p.variant === "c") {
		const here = groups.find((g) => g.seg === p.seg)
		const first = here ? { ...here, subs: [...here.subs].sort((a, b) => Number(b.sub.id === p.sub) - Number(a.sub.id === p.sub)) } : null
		const rest = groups.filter((g) => g.seg !== p.seg)
		flat = [...(first ? first.subs.flatMap((s) => s.hits) : []), ...rest.flatMap((g) => g.subs.flatMap((s) => s.hits))]
		body = (at, nav) => <HereFirst p={p} first={first} rest={rest} at={at} nav={nav} />
	} else {
		flat = groups.flatMap((g) => g.subs.flatMap((s) => s.hits))
		body = (at, nav) => <ByTab p={p} groups={groups} at={at} nav={nav} />
	}
	const nav = useNav(flat, p.onPick, p.nav, p.text, box)
	const at = (h: Hit) => flat.indexOf(h)
	const empty = flat.length === 0
	return (
		<div ref={box} role="listbox" aria-label="Found in every tab" className={p.phone ? "" : "px-6 py-4"} data-find-results={p.variant}>
			{empty ? (
				<p className="flex h-24 items-center justify-center text-[15px] text-gray-400">
					{p.loading ? (
						"Looking…"
					) : (
						<>
							Nothing called <span className={`ml-1 font-semibold text-white ${PRIVATE}`}>“{p.text.trim()}”</span>
						</>
					)}
				</p>
			) : (
				body(at, nav)
			)}
		</div>
	)
}

type At = (h: Hit) => number
type NavState = { active: number; setActive: (i: number) => void }

// ---------------------------------------------------------------------------------------------------------------
// a: grouped by tab

function ByTab({ p, groups, at, nav }: { p: FindProps; groups: SegGroup[]; at: At; nav: NavState }) {
	if (p.phone)
		return (
			<div className="flex flex-col gap-6">
				{groups.map((g) => (
					<TabBlock key={g.seg} p={p} g={g} at={at} nav={nav} />
				))}
			</div>
		)
	return (
		<div className="grid items-start gap-8" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
			{groups.map((g, i) => (
				<div key={g.seg} className={i ? "border-l border-white/[0.06] pl-8" : ""}>
					<TabBlock p={p} g={g} at={at} nav={nav} />
				</div>
			))}
		</div>
	)
}

function TabBlock({ p, g, at, nav, quiet = false, lead }: { p: FindProps; g: SegGroup; at: At; nav: NavState; quiet?: boolean; lead?: SubId }) {
	return (
		<section className="min-w-0">
			<header className={`flex items-center gap-2.5 ${quiet ? "mb-2" : "mb-3"}`}>
				<span className="h-3.5 w-1 rounded-full bg-amber-400" aria-hidden />
				<h3 className={`${quiet ? "text-[14px]" : "text-[15px]"} font-bold text-white`}>{SEG_LABEL[g.seg]}</h3>
			</header>
			<div className="flex flex-col gap-3.5">
				{g.subs.map((s) => (
					<div key={s.sub.id} className="min-w-0">
						<p className={`mb-1.5 text-[12px] ${lead === s.sub.id ? "font-semibold text-amber-300/90" : "text-gray-500"}`}>{p.label(s.sub)}</p>
						<Items p={p} hits={s.hits} at={at} nav={nav} />
					</div>
				))}
			</div>
		</section>
	)
}

/** Chips wrap; titles and people are rows. */
function Items({ p, hits, at, nav }: { p: FindProps; hits: Hit[]; at: At; nav: NavState }) {
	const chips = hits.filter((h) => h.kind === "chip")
	const rows = hits.filter((h) => h.kind !== "chip")
	return (
		<div className="flex flex-col gap-2">
			{rows.length > 0 && (
				<div className={`grid gap-1 ${p.phone ? "" : "grid-cols-[repeat(auto-fill,minmax(250px,1fr))]"}`}>
					{rows.map((h) => (
						<HitRow key={h.key} h={h} i={at(h)} nav={nav} onPick={p.onPick} />
					))}
				</div>
			)}
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

function HitChip({ h, i, nav, onPick }: { h: Hit; i: number; nav: NavState; onPick: (h: Hit) => void }) {
	const hot = nav.active === i
	return (
		<motion.button
			type="button"
			data-hit={i}
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

// ---------------------------------------------------------------------------------------------------------------
// b: one ranked list with breadcrumbs

function Ranked({ p, hits, at, nav }: { p: FindProps; hits: Hit[]; at: At; nav: NavState }) {
	const subOf = (h: Hit) => p.subsOf(h.seg).find((s) => s.id === h.sub)
	return (
		<div className={`grid gap-x-4 gap-y-1 ${p.phone ? "" : "grid-cols-2"}`}>
			{hits.map((h) => {
				const i = at(h)
				const hot = nav.active === i
				const sub = subOf(h)
				return (
					<button
						key={h.key}
						type="button"
						data-hit={i}
						role="option"
						aria-selected={hot}
						aria-pressed={h.on}
						onMouseEnter={() => nav.setActive(i)}
						onClick={() => p.onPick(h)}
						className={`flex h-12 min-w-0 items-center gap-3 rounded-xl px-3 text-left cursor-pointer outline-none ${hot ? "bg-white/[0.08] ring-1 ring-inset ring-amber-400/70" : "hover:bg-white/[0.04]"}`}
					>
						<span className="grid w-7 shrink-0 place-items-center">{h.art ?? <span className="h-2 w-2 rounded-full bg-white/25" aria-hidden />}</span>
						<span className="min-w-0 flex-1">
							<span className={`block truncate text-[14px] font-semibold ${h.locked ? "text-gray-400" : "text-gray-100"}`}>{h.label}</span>
							<span className="block truncate text-[12px] text-gray-500">
								{SEG_LABEL[h.seg]}
								{sub ? ` · ${p.label(sub)}` : ""}
								{h.part && h.part !== sub?.label ? ` · ${h.part}` : ""}
							</span>
						</span>
						{h.note && h.kind === "chip" && <span className="shrink-0 text-[12px] tabular-nums text-gray-500">{h.note}</span>}
						<span className="grid w-6 shrink-0 place-items-center">
							{h.on ? (
								<CheckIcon className="h-4 w-4 text-amber-300" aria-label="On" />
							) : h.locked ? (
								<LockClosedIcon className="h-3.5 w-3.5 text-amber-500/70" aria-hidden />
							) : (
								<ArrowTurnDownLeftIcon className={`h-3.5 w-3.5 text-amber-200/80 transition-opacity ${hot ? "opacity-100" : "opacity-0"}`} aria-hidden />
							)}
						</span>
					</button>
				)
			})}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// c: the open tab first, then the others

function HereFirst({ p, first, rest, at, nav }: { p: FindProps; first: SegGroup | null; rest: SegGroup[]; at: At; nav: NavState }) {
	const here = first ? (
		<TabBlock p={p} g={first} at={at} nav={nav} lead={p.sub} />
	) : (
		<section>
			<header className="mb-3 flex items-center gap-2.5">
				<span className="h-3.5 w-1 rounded-full bg-white/20" aria-hidden />
				<h3 className="text-[15px] font-bold text-gray-400">{SEG_LABEL[p.seg]}</h3>
			</header>
			<p className="text-[13px] text-gray-500">None in this tab</p>
		</section>
	)
	const others = rest.length > 0 && (
		<section className="min-w-0">
			<h3 className={`${SECTION_LABEL} mb-3 text-gray-500`}>In other tabs</h3>
			<div className="flex flex-col gap-5">
				{rest.map((g) => (
					<TabBlock key={g.seg} p={p} g={g} at={at} nav={nav} quiet />
				))}
			</div>
		</section>
	)
	if (p.phone)
		return (
			<div className="flex flex-col gap-7">
				{here}
				{others}
			</div>
		)
	return (
		<div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start gap-8">
			<div className="min-w-0">{here}</div>
			<div className="min-w-0 border-l border-white/[0.06] pl-8">{others || <p className="pt-1 text-[13px] text-gray-500">None in other tabs</p>}</div>
		</div>
	)
}
