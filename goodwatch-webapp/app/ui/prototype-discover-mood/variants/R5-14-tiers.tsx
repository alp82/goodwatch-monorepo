// PROTOTYPE - throwaway. Round 5 variant 14: one tab's body, in tiers. A tab opens on its essentials, laid out big
// for that tab's job (lanes for Search, a tag mixer for Mood, logos for Streaming, tiles for Watched). Under them a
// quiet list, "More in <tab>", names that tab's deeper filters; picking one swaps the whole view in place for that
// filter, with a back link to the essentials. The list ends with "Find a filter": typing swaps the essentials for
// matches from every filter (and offers the same text as a search). No sub-tab row.
import { ChevronLeftIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type ReactNode, useRef } from "react"
import { FilterGroups } from "~/ui/filter-bar"
import { FilterSearchField } from "~/ui/filter-bar/FilterGroups"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import type { ProtoDiscover } from "../kit"
import { SearchLanes } from "./R5-14-lanes"
import {
	ClearLink,
	CountryLine,
	type DeepItem,
	GenreControl,
	NicheControl,
	NicheRow,
	NotSeenControl,
	PRIVATE,
	type Pieces,
	ReleasedControl,
	SEG_LABEL,
	ScoreControl,
	type SegKey,
	ServiceLogos,
	StreamingModes,
	TagChips,
	TypeControl,
	chipsOf,
	clearCard,
	deeperFor,
	useKeepTop,
} from "./R5-14-parts"

const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"

export interface SearchProps {
	text: string
	typing: boolean
	onRun: (t: string) => void
	onFill: (t: string) => void
	input?: ReactNode
}

export interface TierView {
	deep: CardKey | null
	onDeep: (k: CardKey | null) => void
	find: string
	onFind: (t: string) => void
}

function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ${className}`}>{children}</div>
}

// ---------------------------------------------------------------------------------------------------------------
// Essentials, one shape per tab

function MoodEssentials({ d, phone }: { d: ProtoDiscover; phone: boolean }) {
	return (
		<div className={phone ? "flex flex-col gap-6" : "grid h-full min-h-0 grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}>
			<div className={phone ? "" : "min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-6 py-5"}>
				<TagChips d={d} group="moods" big />
			</div>
			<div className={phone ? "flex flex-col gap-6" : "flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain px-6 py-5"}>
				<TypeControl d={d} />
				<GenreControl d={d} limit={phone ? 10 : 14} />
			</div>
		</div>
	)
}

function StreamingEssentials({ d, pieces, phone }: { d: ProtoDiscover; pieces: Pieces; phone: boolean }) {
	return (
		<div className={phone ? "" : "h-full min-h-0 overflow-y-auto overscroll-contain px-6 py-5"}>
			<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
				<div className="w-full max-w-md">
					<StreamingModes d={d} pieces={pieces} />
				</div>
				<CountryLine d={d} pieces={pieces} />
			</div>
			<div className="mt-5">
				<ServiceLogos d={d} pieces={pieces} layout="grid" limit={phone ? 12 : 18} />
			</div>
		</div>
	)
}

function WatchedEssentials({ d, pieces, phone }: { d: ProtoDiscover; pieces: Pieces; phone: boolean }) {
	return (
		<div
			className={
				phone
					? "flex flex-col gap-3"
					: "grid h-full min-h-0 auto-rows-min grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-3 overflow-y-auto px-6 py-5"
			}
		>
			<Tile>
				<h4 className="mb-3 text-[14px] font-semibold text-gray-100">Seen</h4>
				<NotSeenControl pieces={pieces} />
			</Tile>
			<Tile>
				<ScoreControl d={d} />
			</Tile>
			<Tile>
				<ReleasedControl d={d} />
			</Tile>
		</div>
	)
}

function Essentials({ seg, d, pieces, phone, search }: { seg: SegKey; d: ProtoDiscover; pieces: Pieces; phone: boolean; search: SearchProps }) {
	switch (seg) {
		case "search":
			return <SearchLanes d={d} phone={phone} {...search} />
		case "mood":
			return <MoodEssentials d={d} phone={phone} />
		case "streaming":
			return <StreamingEssentials d={d} pieces={pieces} phone={phone} />
		case "watched":
			return <WatchedEssentials d={d} pieces={pieces} phone={phone} />
	}
}

// ---------------------------------------------------------------------------------------------------------------
// The quiet list, a deeper filter's own view, and Find a filter

function BackLink({ seg, onClick }: { seg: SegKey; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="-ml-2 flex h-9 shrink-0 items-center gap-1 rounded-lg pr-2.5 pl-1.5 text-[14px] font-semibold text-gray-300 cursor-pointer outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<ChevronLeftIcon className="h-4.5 w-4.5" aria-hidden />
			{SEG_LABEL[seg]}
		</button>
	)
}

function DeepView({
	seg,
	item,
	d,
	pieces,
	phone,
	onBack,
}: { seg: SegKey; item: DeepItem; d: ProtoDiscover; pieces: Pieces; phone: boolean; onBack: () => void }) {
	const scroller = useRef<HTMLDivElement>(null)
	useKeepTop(scroller, item.k)
	const set = chipsOf(pieces, item.k).length > 0
	const head = (
		<div className={`flex shrink-0 items-center gap-3 ${phone ? "mb-5 min-h-11" : "h-14 border-b border-white/[0.06] px-5"}`}>
			<BackLink seg={seg} onClick={onBack} />
			<span aria-hidden className="h-5 w-px bg-white/10" />
			<span className={`h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[item.k].dot}`} />
			<h3 className="min-w-0 truncate text-[16px] font-bold text-white">{item.title}</h3>
			{!phone && <span className="truncate text-[13px] text-gray-500">{item.hint}</span>}
			{set && (
				<span className="ml-auto shrink-0">
					<ClearLink onClick={() => clearCard(d, pieces, item.k)} />
				</span>
			)}
		</div>
	)
	if (phone)
		return (
			<div>
				{head}
				<NicheControl d={d} pieces={pieces} k={item.k} />
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			{head}
			<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 py-5">
				<div className="max-w-3xl">
					<NicheControl d={d} pieces={pieces} k={item.k} />
				</div>
			</div>
		</div>
	)
}

/** Matches from every filter, in columns on desktop so the list stays short; the same text can run as a search. */
function FindView({
	seg,
	d,
	pieces,
	phone,
	view,
	onRun,
}: { seg: SegKey; d: ProtoDiscover; pieces: Pieces; phone: boolean; view: TierView; onRun: (t: string) => void }) {
	const scroller = useRef<HTMLDivElement>(null)
	const text = view.find.trim()
	useKeepTop(scroller, text)
	const css = phone
		? ""
		: `.find-all-14 > .flex-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 2rem; row-gap: 1.75rem; align-items: start }`
	const head = (
		<div className={`flex shrink-0 items-center gap-3 ${phone ? "mb-4 flex-wrap" : "h-14 border-b border-white/[0.06] px-5"}`}>
			<BackLink seg={seg} onClick={() => view.onFind("")} />
			<span aria-hidden className="h-5 w-px bg-white/10" />
			<h3 className={`${SECTION_LABEL} text-gray-400`}>Filters</h3>
			<button
				type="button"
				onClick={() => onRun(text)}
				className={`flex h-9 min-w-0 items-center gap-2 rounded-full bg-amber-400/[0.1] px-3.5 text-[13px] ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400 ${phone ? "" : "ml-auto"}`}
			>
				<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
				<span className="shrink-0 font-semibold text-amber-200/80">Search:</span>
				<span className={`truncate font-semibold text-white ${PRIVATE}`}>{text}</span>
			</button>
		</div>
	)
	const results = (
		<>
			{css && <style dangerouslySetInnerHTML={{ __html: css }} />}
			<FilterGroups data={pieces.groups} query={text} className="find-all-14" />
		</>
	)
	if (phone)
		return (
			<div className="mt-5">
				{head}
				{results}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			{head}
			<div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-7 py-5">
				{results}
			</div>
		</div>
	)
}

function QuietList({ seg, pieces, phone, view }: { seg: SegKey; pieces: Pieces; phone: boolean; view: TierView }) {
	const items = deeperFor(pieces, seg)
	const finding = view.find.trim() !== ""
	const field = <FilterSearchField value={view.find} onChange={view.onFind} className="h-10" />
	if (phone)
		return (
			<section aria-label={`More in ${SEG_LABEL[seg]}`} className={finding ? "" : "mt-8 border-t border-white/[0.06] pt-5"}>
				{!finding && (
					<>
						<h3 className={`${SECTION_LABEL} mb-2 px-1 text-gray-500`}>More in {SEG_LABEL[seg]}</h3>
						<div className="mb-4 flex flex-col">
							{items.map((item) => (
								<NicheRow key={item.k} item={item} pieces={pieces} open={false} onClick={() => view.onDeep(item.k)} />
							))}
						</div>
					</>
				)}
				{field}
			</section>
		)
	return (
		<section
			aria-label={`More in ${SEG_LABEL[seg]}`}
			className="flex h-[76px] shrink-0 items-center gap-4 border-t border-white/[0.06] bg-white/[0.015] px-5"
		>
			<h3 className={`${SECTION_LABEL} w-[76px] shrink-0 leading-tight text-gray-500`}>More in {SEG_LABEL[seg]}</h3>
			<div
				className={`grid min-w-0 flex-1 gap-1 transition-opacity ${finding ? "opacity-40" : ""}`}
				style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
			>
				{items.map((item) => (
					<NicheRow key={item.k} item={item} pieces={pieces} open={false} onClick={() => view.onDeep(item.k)} />
				))}
			</div>
			<div className="w-[300px] shrink-0">{field}</div>
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------------

/** A tab's body: essentials and the quiet list, or one deeper filter, or Find a filter's matches. */
export function TierBody({
	seg,
	d,
	pieces,
	phone,
	view,
	search,
}: { seg: SegKey; d: ProtoDiscover; pieces: Pieces; phone: boolean; view: TierView; search: SearchProps }) {
	const item = view.deep ? deeperFor(pieces, seg).find((i) => i.k === view.deep) : undefined
	const finding = view.find.trim() !== ""
	const run = (t: string) => {
		view.onFind("")
		search.onRun(t)
	}
	if (item)
		return (
			<motion.div
				key={`deep-${item.k}`}
				initial={{ opacity: 0, x: 18 }}
				animate={{ opacity: 1, x: 0 }}
				transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
				className={phone ? "" : "h-full"}
			>
				<DeepView seg={seg} item={item} d={d} pieces={pieces} phone={phone} onBack={() => view.onDeep(null)} />
			</motion.div>
		)
	// The find field keeps its place in the tree while the essentials swap for matches, so typing keeps focus.
	if (phone)
		return (
			<div>
				{!finding && <Essentials seg={seg} d={d} pieces={pieces} phone search={search} />}
				<QuietList seg={seg} pieces={pieces} phone view={view} />
				{finding && <FindView seg={seg} d={d} pieces={pieces} phone view={view} onRun={run} />}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="relative min-h-0 flex-1 overflow-hidden">
				{finding ? (
					<FindView seg={seg} d={d} pieces={pieces} phone={false} view={view} onRun={run} />
				) : (
					<Essentials seg={seg} d={d} pieces={pieces} phone={false} search={search} />
				)}
			</div>
			<QuietList seg={seg} pieces={pieces} phone={false} view={view} />
		</div>
	)
}
