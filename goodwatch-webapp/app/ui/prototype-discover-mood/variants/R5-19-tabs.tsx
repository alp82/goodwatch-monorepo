// PROTOTYPE - throwaway. Round 5 variant 19: the three filter tabs (Mood, Streaming, For you), each with one calm row
// of sub-tabs, and the field every tab shares at the right of that row ("Search, or find a filter"): typing there
// offers "Search: <text>" and lists the matching options of every filter in place of the sub-tab.
import { ArrowTurnDownLeftIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, type Ref, useRef, useState } from "react"
import { FilterGroups } from "~/ui/filter-bar"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { useTitleNames } from "~/ui/filter-bar/useFilterData"
import type { ProtoDiscover } from "../kit"
import { AddRow, ExampleRow, LaneHead, PickedPoster } from "./R5-19-lanes"
import {
	ClearLink,
	CountryLine,
	EXAMPLE_TITLES,
	GenreControl,
	NotSeenControl,
	OneCard,
	PRIVATE,
	type Pieces,
	ReleasedControl,
	ScoreControl,
	type SegKey,
	ServiceLogos,
	StreamingModes,
	type SubTab,
	TagChips,
	TitleRowsLoading,
	TypeControl,
	chipsOf,
	clearCard,
	subCount,
	subsFor,
	useKeepTop,
	useQuickTitles,
	useSimilar,
} from "./R5-19-parts"

// ---------------------------------------------------------------------------------------------------------------
// The sub-tab row

export function SubTabs({
	id,
	d,
	pieces,
	seg,
	sub,
	onSub,
	dimmed,
	phone,
	right,
}: {
	id: string
	d: ProtoDiscover
	pieces: Pieces
	seg: SegKey
	sub: string
	onSub: (s: string) => void
	dimmed: boolean
	phone: boolean
	right?: ReactNode
}) {
	const tabs = subsFor(pieces, seg)
	return (
		<div
			role="tablist"
			aria-label="Sub-tabs"
			className={`flex shrink-0 items-center gap-1 border-b border-white/[0.07] ${phone ? "-mx-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "px-5"}`}
		>
			{tabs.map((t) => {
				const on = t.id === sub && !dimmed
				const n = subCount(d, pieces, t)
				return (
					<button
						key={t.id}
						type="button"
						role="tab"
						aria-selected={on}
						onClick={() => onSub(t.id)}
						className={`relative flex h-12 shrink-0 items-center gap-2 px-3 text-[14px] font-semibold whitespace-nowrap cursor-pointer outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
							on ? "text-white" : "text-gray-400 hover:text-gray-200"
						} ${dimmed ? "opacity-50" : ""}`}
					>
						{t.label}
						{n > 0 && (
							<span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 tabular-nums">
								{n}
							</span>
						)}
						{on && (
							<motion.span
								layoutId={`${id}-sub-${seg}`}
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-amber-400"
							/>
						)}
					</button>
				)
			})}
			{right && <div className="ml-auto w-[min(360px,38%)] shrink-0 py-1.5">{right}</div>}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The shared field: search, or find a filter

export function FindField({
	value,
	onChange,
	onEnter,
	inputRef,
}: {
	value: string
	onChange: (v: string) => void
	onEnter: () => void
	inputRef?: Ref<HTMLInputElement>
}) {
	return (
		<label className="flex h-10 items-center gap-2.5 rounded-xl bg-white/[0.06] px-3.5 ring-1 ring-white/10 focus-within:ring-amber-500/70">
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-300/80" aria-hidden />
			<span className="sr-only">Search, or find a filter</span>
			<input
				ref={inputRef}
				type="search"
				value={value}
				autoComplete="off"
				enterKeyHint="search"
				data-ph-no-capture
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault()
						onEnter()
					}
				}}
				placeholder="Search, or find a filter"
				className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${PRIVATE}`}
			/>
			{value && (
				<button type="button" onClick={() => onChange("")} aria-label="Clear" className="text-gray-500 cursor-pointer hover:text-white">
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</label>
	)
}

/** What the shared field offers: run it as the search, and the matching options of every filter. */
function FindResults({ pieces, text, phone, onRun }: { pieces: Pieces; text: string; phone: boolean; onRun: (t: string) => void }) {
	const css = phone
		? ""
		: `.find-all-19 > .flex-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 2rem; row-gap: 1.75rem; align-items: start }`
	return (
		<div>
			<button
				type="button"
				onClick={() => onRun(text.trim())}
				className="mb-5 flex h-14 w-full min-w-0 items-center gap-3 rounded-2xl bg-amber-400/[0.12] px-4 text-left ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search:</span>
				<span className={`brand-header min-w-0 flex-1 truncate text-[19px] text-white ${PRIVATE}`}>{text.trim()}</span>
				<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-1 font-sans text-xs font-semibold text-amber-200/80 sm:flex">
					<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
					Enter
				</kbd>
			</button>
			{css && <style dangerouslySetInnerHTML={{ __html: css }} />}
			<FilterGroups data={pieces.groups} query={text} className="find-all-19" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Pieces of the tab bodies

const HINT: Partial<Record<CardKey, string>> = {
	runtime: "Short movies, short episodes",
	sourceScores: "IMDb, Rotten Tomatoes, Metacritic",
	scoreGap: "Where they disagree",
	productionCountries: "Where it was made",
	ageLimit: "Age rating, violence, language",
	minMatch: "How well it fits your taste",
	loved: "Steer toward these",
	disliked: "Steer away from these",
}
const TITLE: Partial<Record<CardKey, string>> = {
	runtime: "Length",
	sourceScores: "Scores by source",
	scoreGap: "Critics vs audiences",
	productionCountries: "Production country",
	ageLimit: "Age and content",
	minMatch: "Taste match",
	loved: "Loved",
	disliked: "Disliked",
}

/** One real filter card under a heading, with Clear once set. */
function CardColumn({ d, pieces, k }: { d: ProtoDiscover; pieces: Pieces; k: CardKey }) {
	const set = chipsOf(pieces, k).length > 0
	return (
		<section aria-label={TITLE[k]} className="min-w-0">
			<header className="mb-3 flex min-h-[38px] items-start gap-2">
				<span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[k].dot}`} />
				<div className="min-w-0 flex-1">
					<h4 className="text-[15px] font-bold leading-tight text-white">{TITLE[k]}</h4>
					<p className="truncate text-[12px] text-gray-500">{HINT[k]}</p>
				</div>
				{set && <ClearLink onClick={() => clearCard(d, pieces, k)} />}
			</header>
			<OneCard key={k} pieces={pieces} k={k} />
		</section>
	)
}

function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ${className}`}>{children}</div>
}

/** Columns side by side on desktop (each scrolls on its own), stacked on phones. */
function Cols({ phone, widths, children }: { phone: boolean; widths: string; children: ReactNode[] }) {
	if (phone) return <div className="flex flex-col gap-7">{children}</div>
	return (
		<div className="grid h-full min-h-0" style={{ gridTemplateColumns: widths }}>
			{children.map((c, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed columns
				<div key={i} className={`min-h-0 overflow-y-auto overscroll-contain px-6 py-5 ${i ? "border-l border-white/[0.06]" : ""}`}>
					{c}
				</div>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Mood: what the title is, and how good

function MoodBody({ d, pieces, sub, phone }: { d: ProtoDiscover; pieces: Pieces; sub: string; phone: boolean }) {
	switch (sub) {
		case "story":
			return (
				<Cols phone={phone} widths="minmax(0,1.3fr) minmax(0,1fr)">
					<TagChips d={d} group="themes" />
					<TagChips d={d} group="styles" />
				</Cols>
			)
		case "when":
			return (
				<Cols phone={phone} widths="minmax(0,1fr) minmax(0,1.2fr)">
					<CardColumn d={d} pieces={pieces} k="runtime" />
					<ReleasedControl d={d} />
				</Cols>
			)
		case "good":
			return (
				<Cols phone={phone} widths="minmax(0,0.9fr) minmax(0,1.2fr) minmax(0,1fr)">
					<ScoreControl d={d} />
					<CardColumn d={d} pieces={pieces} k="sourceScores" />
					<CardColumn d={d} pieces={pieces} k="scoreGap" />
				</Cols>
			)
		default:
			return (
				<Cols phone={phone} widths="minmax(0,3fr) minmax(0,2fr)">
					<TagChips d={d} group="moods" big />
					<div className="flex flex-col gap-6">
						<TypeControl d={d} />
						<GenreControl d={d} limit={phone ? 10 : 16} />
					</div>
				</Cols>
			)
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Streaming: where, and for whom

function StreamingBody({ d, pieces, sub, phone }: { d: ProtoDiscover; pieces: Pieces; sub: string; phone: boolean }) {
	switch (sub) {
		case "made":
			return (
				<Cols phone={phone} widths="minmax(0,1fr) minmax(0,1fr)">
					<CardColumn d={d} pieces={pieces} k="productionCountries" />
					<div />
				</Cols>
			)
		case "age":
			return (
				<Cols phone={phone} widths="minmax(0,1.4fr) minmax(0,1fr)">
					<CardColumn d={d} pieces={pieces} k="ageLimit" />
					<div />
				</Cols>
			)
		default:
			return (
				<div className={phone ? "" : "h-full min-h-0 overflow-y-auto overscroll-contain px-6 py-5"}>
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
}

// ---------------------------------------------------------------------------------------------------------------
// For you: about the viewer

function SimilarBody({ d, phone }: { d: ProtoDiscover; phone: boolean }) {
	const similar = useSimilar(d)
	const [text, setText] = useState("")
	const titles = useQuickTitles(text)
	const names = useTitleNames(similar.list, "")
	const asking = text.trim().length >= 2
	const adds = titles.found.filter((t) => !similar.has(t.key)).slice(0, 5)
	const examples = EXAMPLE_TITLES.filter((t) => !similar.has(t.key))
	const picked = (
		<div>
			<LaneHead icon={<PlusIcon />}>Picked</LaneHead>
			{similar.list.length ? (
				<div className="flex flex-wrap gap-3 px-1 pt-1.5">
					{similar.list.map((k) => (
						<PickedPoster key={k} t={names.byKey.get(k) ?? titles.found.find((t) => t.key === k)} onRemove={() => similar.toggle(k)} />
					))}
				</div>
			) : (
				<div className="flex flex-col">
					{examples.map((t) => (
						<ExampleRow key={t.key} icon={<PlusIcon />} text={`Like ${t.title}`} onClick={() => similar.toggle(t.key)} />
					))}
				</div>
			)}
		</div>
	)
	const add = (
		<div>
			<LaneHead icon={<MagnifyingGlassIcon />}>Add a title</LaneHead>
			<label className="mb-3 flex h-11 items-center gap-2.5 rounded-xl bg-white/[0.06] px-3.5 ring-1 ring-white/10 focus-within:ring-amber-500/70">
				<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
				<input
					type="search"
					value={text}
					autoComplete="off"
					aria-label="Add a title"
					onChange={(e) => setText(e.target.value)}
					placeholder="A movie or show you liked"
					className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden ${PRIVATE}`}
				/>
			</label>
			{asking &&
				(adds.length ? (
					<div className={titles.loading ? "opacity-70 transition-opacity" : ""}>
						{adds.map((t) => (
							<AddRow key={t.key} t={t} onAdd={() => similar.toggle(t.key)} />
						))}
					</div>
				) : titles.loading ? (
					<TitleRowsLoading n={3} />
				) : (
					<p className="px-2 py-3 text-[13px] text-gray-500">No title called “{text.trim()}”</p>
				))}
		</div>
	)
	return (
		<Cols phone={phone} widths="minmax(0,1.3fr) minmax(0,1fr)">
			{picked}
			{add}
		</Cols>
	)
}

function ForYouBody({ d, pieces, sub, phone }: { d: ProtoDiscover; pieces: Pieces; sub: string; phone: boolean }) {
	switch (sub) {
		case "similar":
			return <SimilarBody d={d} phone={phone} />
		case "loved":
			return (
				<Cols phone={phone} widths="minmax(0,1fr) minmax(0,1fr)">
					<CardColumn d={d} pieces={pieces} k="loved" />
					<CardColumn d={d} pieces={pieces} k="disliked" />
				</Cols>
			)
		default:
			return (
				<Cols phone={phone} widths="minmax(0,1fr) minmax(0,1.3fr)">
					<Tile>
						<h4 className="mb-3 text-[15px] font-bold text-white">Seen</h4>
						<NotSeenControl pieces={pieces} />
					</Tile>
					<CardColumn d={d} pieces={pieces} k="minMatch" />
				</Cols>
			)
	}
}

// ---------------------------------------------------------------------------------------------------------------
// A filter tab: the sub-tab row (with the shared field), then the open sub-tab or the field's matches.

export function FilterTab({
	id,
	d,
	pieces,
	seg,
	sub,
	onSub,
	find,
	onFind,
	onRun,
	phone,
}: {
	id: string
	d: ProtoDiscover
	pieces: Pieces
	seg: Exclude<SegKey, "search">
	sub: string
	onSub: (s: string) => void
	find: string
	onFind: (t: string) => void
	onRun: (t: string) => void
	phone: boolean
}) {
	const finding = find.trim() !== ""
	const tabs: SubTab[] = subsFor(pieces, seg)
	const open = tabs.find((t) => t.id === sub)?.id ?? tabs[0].id
	const scroller = useRef<HTMLDivElement>(null)
	useKeepTop(scroller, `${seg}|${open}|${finding ? "find" : ""}`, phone ? undefined : ".overflow-y-auto")
	const field = <FindField value={find} onChange={onFind} onEnter={() => find.trim() && onRun(find.trim())} />
	const Body = seg === "mood" ? MoodBody : seg === "streaming" ? StreamingBody : ForYouBody
	const body = finding ? (
		<div className={phone ? "" : "h-full overflow-y-auto overscroll-contain px-7 py-5"}>
			<FindResults pieces={pieces} text={find} phone={phone} onRun={onRun} />
		</div>
	) : (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={open}
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.14 }}
				className={phone ? "" : "h-full min-h-0"}
			>
				<Body d={d} pieces={pieces} sub={open} phone={phone} />
			</motion.div>
		</AnimatePresence>
	)
	const strip = (
		<SubTabs
			id={id}
			d={d}
			pieces={pieces}
			seg={seg}
			sub={open}
			dimmed={finding}
			phone={phone}
			onSub={(s) => {
				onFind("")
				onSub(s)
			}}
			right={phone ? undefined : field}
		/>
	)
	if (phone)
		return (
			<div ref={scroller}>
				<div className="mb-2">{field}</div>
				{strip}
				<div className="pt-5">{body}</div>
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="shrink-0 pt-1">{strip}</div>
			<div ref={scroller} className="min-h-0 flex-1 overflow-hidden">
				{body}
			</div>
		</div>
	)
}
