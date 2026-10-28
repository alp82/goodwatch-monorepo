// PROTOTYPE - throwaway. Round 5 variant 11: what each tab shows. One row of sub-tabs per tab (SUBTABS in the parts),
// and each tab shaped for its job:
// - Search: "Mood or title" (the three lanes), "Cast and crew", "Find a filter" (the bar's field finds filters).
// - Mood: a mixer. The open sub-tab's chips on the left, "Your mix" on the right on every sub-tab (the picks per kind
//   and what pairs with them, with honest counts).
// - Streaming: service logos first, then Length, Age and content, Made in, one filter per sub-tab.
// - Watched: Seen (Not seen yet, Loved, Disliked side by side), Scores (four score filters side by side), Released.
import { ArrowTurnDownLeftIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useRef } from "react"
import { NotSeenSwitch } from "~/ui/filter-bar/controls"
import { FilterGroups } from "~/ui/filter-bar"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { type ProtoDiscover, TAGS, type Tag, short, tagId } from "../kit"
import { SearchLanes } from "./R5-11-lanes"
import {
	ClearLink,
	CountryLine,
	GenreControl,
	NicheControl,
	type Pieces,
	PRIVATE,
	ReleasedControl,
	ScoreControl,
	type SegKey,
	ServiceLogos,
	StreamingModes,
	type SubTab,
	TagChips,
	TypeControl,
	chipsOf,
	clearCard,
	subCount,
	subTabsFor,
	useKeepTop,
} from "./R5-11-parts"

const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"

// ---------------------------------------------------------------------------------------------------------------
// The sub-tab row

export function SubTabRow({
	id,
	d,
	pieces,
	seg,
	sub,
	onPick,
	right,
	phone,
}: {
	id: string
	d: ProtoDiscover
	pieces: Pieces
	seg: SegKey
	sub: string
	onPick: (sub: string) => void
	right?: ReactNode
	phone: boolean
}) {
	const tabs = subTabsFor(seg, pieces)
	return (
		<div className={`flex shrink-0 items-center gap-1 border-b border-white/[0.07] ${phone ? "px-3" : "px-4"}`}>
			<div
				role="tablist"
				aria-label="Sub-tabs"
				className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{tabs.map((t) => {
					const on = t.id === sub
					const n = subCount(d, pieces, t)
					return (
						<button
							key={t.id}
							type="button"
							role="tab"
							aria-selected={on}
							onClick={() => onPick(t.id)}
							className={`relative flex shrink-0 items-center gap-1.5 px-3 font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
								phone ? "h-11 text-[13px]" : "h-12 text-[14px]"
							} ${on ? "text-white" : "text-gray-400 hover:text-gray-200"}`}
						>
							{t.label}
							{n > 0 && (
								<span className="grid h-[17px] min-w-[17px] place-items-center rounded-full bg-amber-500 px-1 text-[10.5px] font-bold text-gray-950 tabular-nums">
									{n}
								</span>
							)}
							{on && (
								<motion.span
									layoutId={`${id}-sub`}
									transition={{ type: "spring", stiffness: 520, damping: 42 }}
									className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-amber-400"
								/>
							)}
						</button>
					)
				})}
			</div>
			{right}
		</div>
	)
}

/** The way into Find a filter from any tab. */
export function FindButton({ onClick, phone }: { onClick: () => void; phone: boolean }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Find a filter"
			className={`flex shrink-0 items-center gap-1.5 rounded-full text-[13px] font-semibold text-gray-300 cursor-pointer outline-none ring-1 ring-inset ring-white/10 hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${
				phone ? "h-9 w-9 justify-center" : "h-8 px-3"
			}`}
		>
			<MagnifyingGlassIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden />
			{!phone && "Find a filter"}
		</button>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// A filter as a column: its name, a short hint, Clear once set, and the control.

interface Item {
	k: CardKey
	title: string
	hint: string
	w?: number
}

function FilterColumn({ d, pieces, item, children }: { d: ProtoDiscover; pieces: Pieces; item: Item; children?: ReactNode }) {
	const set = chipsOf(pieces, item.k).length > 0
	return (
		<section aria-label={item.title} className="min-w-0">
			<header className="mb-3 flex min-h-[38px] items-start gap-2">
				<span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[item.k].dot}`} />
				<div className="min-w-0 flex-1">
					<h4 className="text-[15px] font-bold leading-tight text-white">{item.title}</h4>
					<p className="truncate text-[12px] text-gray-500">{item.hint}</p>
				</div>
				{set && <ClearLink onClick={() => clearCard(d, pieces, item.k)} />}
			</header>
			{children ?? <NicheControl d={d} pieces={pieces} k={item.k} />}
		</section>
	)
}

/** Filters side by side (stacked on phones), each in its own column. */
function Columns({ d, pieces, items, phone, lead, keepKey }: { d: ProtoDiscover; pieces: Pieces; items: Item[]; phone: boolean; lead?: ReactNode; keepKey: string }) {
	const scroller = useRef<HTMLDivElement>(null)
	useKeepTop(scroller, keepKey)
	const cols = [...(lead ? ["minmax(0,0.8fr)"] : []), ...items.map((i) => `minmax(0,${i.w ?? 1}fr)`)]
	return (
		<div ref={scroller} className={phone ? "" : "h-full min-h-0 overflow-y-auto overscroll-contain px-7 py-5"}>
			<div className={phone ? "flex flex-col gap-7" : "grid gap-x-8"} style={phone ? undefined : { gridTemplateColumns: cols.join(" ") }}>
				{lead && <div>{lead}</div>}
				{items.map((item, i) => (
					<div key={item.k} className={!phone && (i || lead) ? "-ml-4 border-l border-white/[0.06] pl-4" : ""}>
						<FilterColumn d={d} pieces={pieces} item={item} />
					</div>
				))}
			</div>
		</div>
	)
}

/** One filter, given room but not stretched across the whole panel. */
function Single({ d, pieces, item, phone, children }: { d: ProtoDiscover; pieces: Pieces; item: Item; phone: boolean; children?: ReactNode }) {
	const scroller = useRef<HTMLDivElement>(null)
	useKeepTop(scroller, item.k)
	return (
		<div ref={scroller} className={phone ? "" : "h-full min-h-0 overflow-y-auto overscroll-contain px-7 py-5"}>
			<div className="max-w-2xl">
				<FilterColumn d={d} pieces={pieces} item={item}>
					{children}
				</FilterColumn>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Search

export interface SearchProps {
	text: string
	typing: boolean
	onRun: (t: string) => void
	onFill: (t: string) => void
	/** Phones: the field, shown at the top of the tab. */
	input?: ReactNode
}

const FIND_EXAMPLES = ["Horror", "Netflix", "Tom Hanks", "Japan", "Short episodes"]

function RunRow({ text, onRun }: { text: string; onRun: (t: string) => void }) {
	return (
		<button
			type="button"
			onClick={() => onRun(text)}
			className="flex h-12 w-full min-w-0 items-center gap-3 rounded-xl bg-amber-400/[0.1] px-4 text-left ring-1 ring-inset ring-amber-400/25 cursor-pointer outline-none hover:bg-amber-400/[0.16] focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search:</span>
			<span className={`brand-header min-w-0 flex-1 truncate text-[18px] text-white ${PRIVATE}`}>{text}</span>
			<ArrowTurnDownLeftIcon className="hidden h-4 w-4 shrink-0 text-amber-200/70 sm:block" aria-hidden />
		</button>
	)
}

/** Find a filter: the field's text across every filter's options, in columns so the list stays short. */
function FindBody({ pieces, search, phone }: { pieces: Pieces; search: SearchProps; phone: boolean }) {
	const text = search.text.trim()
	const scroller = useRef<HTMLDivElement>(null)
	useKeepTop(scroller, text ? "find" : "examples")
	const css = phone
		? ""
		: `.find-all-11 > .flex-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 2rem; row-gap: 1.75rem; align-items: start }`
	return (
		<div ref={scroller} className={phone ? "" : "h-full min-h-0 overflow-y-auto overscroll-contain px-7 py-5"}>
			{search.input && (
				<div className="mb-4 flex h-14 items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)]">
					<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
					{search.input}
				</div>
			)}
			{text ? (
				<>
					<div className="mb-5 max-w-xl">
						<RunRow text={text} onRun={search.onRun} />
					</div>
					{css && <style dangerouslySetInnerHTML={{ __html: css }} />}
					<FilterGroups data={pieces.groups} query={text} className="find-all-11" />
				</>
			) : (
				<div className="max-w-md">
					<h3 className={`${SECTION_LABEL} mb-2 px-1 text-gray-400`}>Find a filter</h3>
					{FIND_EXAMPLES.map((e) => (
						<button
							key={e}
							type="button"
							onClick={() => search.onFill(e)}
							className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] text-gray-300 cursor-pointer outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-400/70" aria-hidden />
							{e}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

export function SearchTab({ d, pieces, sub, phone, search }: { d: ProtoDiscover; pieces: Pieces; sub: string; phone: boolean; search: SearchProps }) {
	if (sub === "people")
		return <Single d={d} pieces={pieces} phone={phone} item={{ k: "people", title: "Cast and crew", hint: "Actors, directors, writers" }} />
	if (sub === "find") return <FindBody pieces={pieces} search={search} phone={phone} />
	return <SearchLanes d={d} phone={phone} {...search} />
}

// ---------------------------------------------------------------------------------------------------------------
// Mood: a mixer

const KIND_OF: Record<Tag["group"], string> = { moods: "Mood", themes: "About", styles: "Style" }

function MixRow({ label, sub, onOpen, children, empty }: { label: string; sub: string; onOpen: (s: string) => void; children: ReactNode; empty: boolean }) {
	return (
		<div className="flex min-h-9 items-start gap-3 py-1">
			<button
				type="button"
				onClick={() => onOpen(sub)}
				className="mt-1.5 w-16 shrink-0 text-left text-[12px] font-semibold text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				{label}
			</button>
			<div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{empty ? <span className="mt-1.5 text-[13px] text-gray-600">Any</span> : children}</div>
		</div>
	)
}

function PickChip({ name, color, onRemove }: { name: string; color?: string; onRemove: () => void }) {
	return (
		<motion.button
			type="button"
			layout="position"
			whileTap={TAP}
			onClick={onRemove}
			aria-label={`Remove ${name}`}
			className="inline-flex h-7 items-center gap-1.5 rounded-full pr-1.5 pl-2.5 text-[12.5px] font-semibold text-white cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			style={color ? { background: `${color}2e`, boxShadow: `inset 0 0 0 1px ${color}88` } : { background: "rgba(255,255,255,0.08)" }}
		>
			{color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
			{name}
			<XMarkIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden />
		</motion.button>
	)
}

/** What pairs with the picks: tags of kinds not picked yet, each with what it would leave (the intersection). */
function pairings(d: ProtoDiscover, n: number) {
	const pickedGroups = new Set(d.picked.map((t) => t.group))
	return TAGS.filter((t) => !pickedGroups.has(t.group))
		.map((t) => ({ t, c: d.countFor(t) }))
		.filter((x): x is { t: Tag; c: number } => x.c !== null && x.c > 0)
		.sort((a, b) => b.c - a.c)
		.slice(0, n)
}

function MixPanel({ d, pieces, onOpen, phone }: { d: ProtoDiscover; pieces: Pieces; onOpen: (s: string) => void; phone: boolean }) {
	const s = d.filters.state
	const by = (g: Tag["group"]) => d.picked.filter((t) => t.group === g)
	const genres = chipsOf(pieces, "genres")
	const pairs = d.picked.length ? pairings(d, phone ? 4 : 6) : []
	return (
		<div className={phone ? "rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]" : ""}>
			<div className="mb-2 flex items-baseline gap-2">
				<h3 className={`${SECTION_LABEL} text-gray-400`}>Your mix</h3>
				<span className="ml-auto text-[13px] text-gray-400">
					{d.total == null ? "…" : <RollingNumber value={d.total} className="font-semibold text-white" />} titles
				</span>
			</div>
			{(["moods", "themes", "styles"] as const).map((g) => (
				<MixRow key={g} label={KIND_OF[g]} sub={g} onOpen={onOpen} empty={!by(g).length}>
					{by(g).map((t) => (
						<PickChip key={tagId(t)} name={t.name} color={t.color} onRemove={() => d.toggle(t)} />
					))}
				</MixRow>
			))}
			<MixRow label="Genre" sub="genres" onOpen={onOpen} empty={!genres.length && s.type === "all"}>
				{s.type !== "all" && <PickChip name={s.type === "movie" ? "Movies" : "Shows"} onRemove={() => d.filters.set({ type: "all" })} />}
				{genres.map((c) => (
					<PickChip key={c.key} name={c.label} onRemove={() => d.filters.update((x) => c.remove(x))} />
				))}
			</MixRow>
			<div className="mt-4 border-t border-white/[0.06] pt-3">
				<h3 className={`${SECTION_LABEL} mb-2 text-gray-500`}>Pairs well</h3>
				<div className="flex min-h-[72px] flex-wrap content-start gap-1.5">
					{pairs.length ? (
						pairs.map(({ t, c }) => (
							<motion.button
								key={tagId(t)}
								type="button"
								whileTap={TAP}
								onClick={() => d.toggle(t)}
								className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.05] px-3 text-[13px] text-gray-200 ring-1 ring-inset ring-white/10 cursor-pointer outline-none hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<PlusIcon className="h-3.5 w-3.5 text-gray-500" aria-hidden />
								<span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
								{t.name}
								<span className="text-[11px] text-gray-500">{KIND_OF[t.group]}</span>
								<span className="text-[12px] text-gray-400 tabular-nums">{short(c)}</span>
							</motion.button>
						))
					) : (
						<span className="text-[13px] text-gray-600">{d.picked.length ? "Nothing to add" : "Pick a mood first"}</span>
					)}
				</div>
			</div>
		</div>
	)
}

export function MoodTab({ d, pieces, sub, phone, onSub }: { d: ProtoDiscover; pieces: Pieces; sub: string; phone: boolean; onSub: (s: string) => void }) {
	const scroller = useRef<HTMLDivElement>(null)
	useKeepTop(scroller, sub)
	const main =
		sub === "genres" ? (
			<div className="flex flex-col gap-6">
				<TypeControl d={d} />
				<GenreControl d={d} limit={phone ? 12 : 24} />
			</div>
		) : (
			<TagChips d={d} group={sub as Tag["group"]} big />
		)
	const body = (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div key={sub} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
				{main}
			</motion.div>
		</AnimatePresence>
	)
	if (phone)
		return (
			<div className="flex flex-col gap-6">
				{body}
				<MixPanel d={d} pieces={pieces} onOpen={onSub} phone />
			</div>
		)
	return (
		<div className="grid h-full min-h-0 grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
			<div ref={scroller} className="min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-7 py-5">
				{body}
			</div>
			<div className="min-h-0 overflow-y-auto overscroll-contain bg-white/[0.015] px-6 py-5">
				<MixPanel d={d} pieces={pieces} onOpen={onSub} phone={false} />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Streaming

const STREAM_ITEMS: Record<string, Item> = {
	runtime: { k: "runtime", title: "Length", hint: "Short movies, short episodes" },
	ageLimit: { k: "ageLimit", title: "Age and content", hint: "Age rating, violence, language" },
	productionCountries: { k: "productionCountries", title: "Made in", hint: "Where it was produced" },
}

export function StreamingTab({ d, pieces, sub, phone }: { d: ProtoDiscover; pieces: Pieces; sub: string; phone: boolean }) {
	const scroller = useRef<HTMLDivElement>(null)
	useKeepTop(scroller, sub)
	const item = STREAM_ITEMS[sub]
	if (item) return <Single key={sub} d={d} pieces={pieces} item={item} phone={phone} />
	return (
		<div ref={scroller} className={phone ? "" : "h-full min-h-0 overflow-y-auto overscroll-contain px-7 py-5"}>
			<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
				<div className="w-full max-w-md">
					<StreamingModes d={d} pieces={pieces} />
				</div>
				<CountryLine d={d} pieces={pieces} />
			</div>
			<div className="mt-5">
				<ServiceLogos d={d} pieces={pieces} layout="grid" limit={phone ? 12 : 24} />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Watched

function NotSeenColumn({ pieces }: { pieces: Pieces }) {
	return (
		<section aria-label="Not seen yet" className="min-w-0">
			<header className="mb-3 flex min-h-[38px] items-start gap-2">
				<span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS.notSeenYet.dot}`} />
				<div className="min-w-0 flex-1">
					<h4 className="text-[15px] font-bold leading-tight text-white">Not seen yet</h4>
					<p className="truncate text-[12px] text-gray-500">Hide what you watched</p>
				</div>
			</header>
			<NotSeenSwitch {...pieces.notSeenProps} />
		</section>
	)
}

export function WatchedTab({ d, pieces, sub, phone }: { d: ProtoDiscover; pieces: Pieces; sub: string; phone: boolean }) {
	if (sub === "scores")
		return (
			<Columns
				key="scores"
				keepKey="scores"
				d={d}
				pieces={pieces}
				phone={phone}
				lead={<ScoreControl d={d} />}
				items={[
					{ k: "minMatch", title: "Taste match", hint: "How well it fits your taste" },
					{ k: "sourceScores", title: "Scores by source", hint: "IMDb, Rotten Tomatoes, Metacritic", w: 1.2 },
					{ k: "scoreGap", title: "Critics vs audiences", hint: "Where they disagree" },
				]}
			/>
		)
	if (sub === "released")
		return (
			<div className={phone ? "" : "h-full min-h-0 px-7 py-5"}>
				<div className="max-w-2xl">
					<ReleasedControl d={d} />
				</div>
			</div>
		)
	return (
		<Columns
			key="seen"
			keepKey="seen"
			d={d}
			pieces={pieces}
			phone={phone}
			lead={<NotSeenColumn pieces={pieces} />}
			items={[
				{ k: "loved", title: "Loved", hint: "Steer toward these" },
				{ k: "disliked", title: "Disliked", hint: "Steer away from these" },
			]}
		/>
	)
}

export const subLabel = (seg: SegKey, sub: string, pieces: Pieces): SubTab | undefined =>
	subTabsFor(seg, pieces).find((t) => t.id === sub)
