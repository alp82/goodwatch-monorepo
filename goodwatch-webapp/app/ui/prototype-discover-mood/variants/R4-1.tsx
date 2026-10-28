// PROTOTYPE - throwaway. Round 4 variant 1, "More with sub-tabs": V's segmented bar and morphing panel (Search, Mood,
// Streaming, Watched, More). Search finds a mood, a title or "like <title>": its panel teaches by one example of each,
// and while typing offers the search itself plus up to four title matches with "Like this" (Similar to). More gets a
// row of sub-tabs (Story and form, Scores, Titles and people, Origin and age), each showing all its filters
// at once at full size in two columns, with a count of what's set per tab and "Find a filter" at the row's right end.
// Phones: the stacked bar card; a bottom sheet with the segments as tabs, More's sub-tabs scrolling sideways.
import { ArrowTurnDownLeftIcon, CheckIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups, FilterSearchField, ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { type CardKey, cardOf } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { Chip, byCount } from "~/ui/filter-bar/SheetControls"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import type { TitleKey } from "~/utils/title-key"
import { type ProtoDiscover, TAGS, useFilterPieces } from "../kit"
import {
	CardsGate,
	CountryLine,
	GenreControl,
	GridUnder,
	NICHE,
	NicheControl,
	NotSeenControl,
	POSTER_SMALL,
	PRIVATE,
	PageTitle,
	PhoneBar,
	type Pieces,
	ReleasedControl,
	SEG_LABEL,
	SEG_ORDER,
	ScoreControl,
	SearchInput,
	type SegKey,
	SegmentBar,
	ServiceLogos,
	StatusLine,
	StreamingModes,
	TagChips,
	TypeControl,
	chipsOf,
	clearCard,
	segValues,
	tagOption,
	useClearAll,
	useOutsideClose,
	useQuickTitles,
	useSlashKey,
} from "./R4-1-parts"

export const NAME = "More with sub-tabs"

const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"
const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ${className}`}>{children}</div>
}

// ---------------------------------------------------------------------------------------------------------------
// Search: one example of each kind; while typing, the search itself and up to four titles.

const EXAMPLES = [
	{ kind: "Mood", text: "cozy rainy day mystery" },
	{ kind: "Title", text: "Arrival" },
	{ kind: "Similar", text: "like Severance" },
]

function TitleMatches({ d, text, onRun, onDone }: { d: ProtoDiscover; text: string; onRun: (t: string) => void; onDone: () => void }) {
	const { found, loading } = useQuickTitles(text)
	const similar = d.filters.state.similarTo ?? []
	const toggleLike = (key: TitleKey) => {
		const on = similar.includes(key)
		const next = on ? similar.filter((k) => k !== key) : [...similar, key]
		d.filters.set({ similarTo: next.length ? next : undefined })
		if (!on) onDone()
	}
	return (
		<div className="mt-5">
			<h3 className={`${SECTION_LABEL} mb-1.5 flex h-5 items-center gap-2 px-1 text-gray-500`}>
				Titles
				{loading && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-500 motion-reduce:animate-none" />}
			</h3>
			<div className="flex min-h-[232px] flex-col gap-0.5">
				{found.map((t) => {
					const liked = similar.includes(t.key)
					return (
						<div key={t.key} className="group flex h-14 items-center gap-1 rounded-xl pr-2 hover:bg-white/[0.05]">
							<button
								type="button"
								onClick={() => onRun(t.title)}
								className="flex h-full min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								{t.poster ? (
									<img src={`${POSTER_SMALL}${t.poster}`} alt="" loading="lazy" className="h-11 w-[30px] shrink-0 rounded object-cover" />
								) : (
									<span className="h-11 w-[30px] shrink-0 rounded bg-white/[0.06]" />
								)}
								<span className="min-w-0">
									<span className="block truncate text-[15px] font-semibold text-gray-100">{t.title}</span>
									<span className="block text-[12px] text-gray-500">{t.year}</span>
								</span>
							</button>
							<button
								type="button"
								onClick={() => toggleLike(t.key)}
								aria-pressed={liked}
								className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
									liked
										? "bg-white/[0.12] text-white ring-1 ring-white/30"
										: "text-amber-300/90 ring-1 ring-white/10 hover:bg-white/[0.06] hover:text-amber-200"
								}`}
							>
								{liked ? <CheckIcon className="h-3.5 w-3.5" aria-hidden /> : <PlusIcon className="h-3.5 w-3.5" aria-hidden />}
								Like this
							</button>
						</div>
					)
				})}
				{!loading && found.length === 0 && <p className="px-1 py-2 text-[13px] text-gray-600">No titles by that name</p>}
			</div>
		</div>
	)
}

function SearchLayout({
	d,
	text,
	typing,
	onRun,
	onDone,
	input,
	phone,
}: {
	d: ProtoDiscover
	text: string
	typing: boolean
	onRun: (t: string) => void
	onDone: () => void
	input?: ReactNode
	phone: boolean
}) {
	return (
		<div className={phone ? "flex flex-col gap-6" : "grid h-full min-h-0 grid-cols-[minmax(0,6fr)_minmax(0,5fr)]"}>
			<div className={phone ? "" : "min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-6 py-5"}>
				{input && (
					<div className="mb-4 flex h-14 items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)]">
						<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
						{input}
					</div>
				)}
				{typing ? (
					<>
						<button
							type="button"
							onClick={() => onRun(text)}
							className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-2xl bg-amber-400/[0.12] px-4 text-left ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search:</span>
							<span className={`brand-header min-w-0 flex-1 truncate text-[22px] text-white ${PRIVATE}`}>{text}</span>
							<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-1 font-sans text-xs font-semibold text-amber-200/80 sm:flex">
								<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
								Enter
							</kbd>
						</button>
						<TitleMatches d={d} text={text} onRun={onRun} onDone={onDone} />
					</>
				) : (
					<>
						{d.q && (
							<div className="mb-5 rounded-2xl bg-amber-500/[0.07] p-4 ring-1 ring-inset ring-amber-400/25">
								<h3 className={`${SECTION_LABEL} mb-1.5 text-amber-300/90`}>Searching</h3>
								<div className="flex items-center gap-3">
									<span className={`brand-header min-w-0 truncate text-[22px] text-white ${PRIVATE}`}>{d.q}</span>
									<button
										type="button"
										onClick={() => d.setQ(null)}
										className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 cursor-pointer outline-none hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-amber-400"
									>
										<XMarkIcon className="h-4 w-4" aria-hidden />
										Clear
									</button>
								</div>
								{d.reading.length > 0 && (
									<div className="mt-3 flex flex-wrap items-center gap-2">
										<span className="text-[12px] text-gray-400">Read as</span>
										<ReadAsChips reading={d.reading} />
									</div>
								)}
							</div>
						)}
						<h3 className={`${SECTION_LABEL} mb-1.5 px-1 text-gray-500`}>Try</h3>
						<div className="flex flex-col gap-0.5">
							{EXAMPLES.map((ex) => (
								<button
									key={ex.kind}
									type="button"
									onClick={() => onRun(ex.text)}
									className="flex h-14 min-w-0 items-center gap-4 rounded-xl px-3 text-left cursor-pointer outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400 group"
								>
									<span className="w-16 shrink-0 text-[12px] font-semibold text-gray-500">{ex.kind}</span>
									<span className="brand-header truncate text-[19px] text-gray-200 group-hover:text-white">{ex.text}</span>
								</button>
							))}
						</div>
					</>
				)}
			</div>
			<div className={phone ? "" : "min-h-0 overflow-y-auto overscroll-contain px-6 py-5"}>
				<TagChips d={d} group="moods" />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Common segments (as V)

function MoodLayout({ d, phone }: { d: ProtoDiscover; phone: boolean }) {
	return (
		<div className={phone ? "flex flex-col gap-6" : "grid h-full min-h-0 grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}>
			<div className={phone ? "" : "min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-6 py-5"}>
				<TagChips d={d} group="moods" big />
			</div>
			<div className={phone ? "flex flex-col gap-6" : "flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain px-6 py-5"}>
				<TypeControl d={d} />
				<GenreControl d={d} limit={phone ? 10 : 16} />
			</div>
		</div>
	)
}

function StreamingLayout({ d, pieces, phone }: { d: ProtoDiscover; pieces: Pieces; phone: boolean }) {
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

function WatchedLayout({ d, pieces, phone }: { d: ProtoDiscover; pieces: Pieces; phone: boolean }) {
	return (
		<div className={phone ? "flex flex-col gap-3" : "grid h-full min-h-0 auto-rows-min grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-3 overflow-y-auto px-6 py-5"}>
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

// ---------------------------------------------------------------------------------------------------------------
// More: sub-tabs, each with all of its filters at once.

type SubKey = "story" | "scores" | "people" | "origin"
/** Each sub-tab's filters as two columns (desktop); phones read them top to bottom. */
const SUBTABS: { key: SubKey; label: string; columns: CardKey[][] }[] = [
	{ key: "story", label: "Story and form", columns: [["themes"], ["styles", "runtime"]] },
	{ key: "scores", label: "Scores", columns: [["minMatch", "scoreGap"], ["sourceScores"]] },
	{ key: "people", label: "Titles and people", columns: [["similarTo", "people"], ["loved", "disliked"]] },
	{ key: "origin", label: "Origin and age", columns: [["productionCountries"], ["ageLimit"]] },
]
const TITLE = new Map<CardKey, string>(NICHE.flatMap((g) => g.items.map((i) => [i.k, i.title] as const)))
const subOfCard = (k: CardKey) => SUBTABS.find((t) => t.columns.flat().includes(k))?.key

const keep = (pieces: Pieces) => (k: CardKey) => k !== "ageLimit" || !!pieces.groups.ladder
const subCount = (pieces: Pieces, t: (typeof SUBTABS)[number]) =>
	t.columns.flat().reduce((n, k) => n + chipsOf(pieces, k).length, 0)

/** More opens at the first sub-tab with something set, else Story and form. */
const firstSub = (pieces: Pieces): SubKey =>
	pieces.chips.map((c) => cardOf(c.group)).map((k) => (k ? subOfCard(k) : undefined)).find(Boolean) ?? "story"

function FilterBlock({ d, pieces, k }: { d: ProtoDiscover; pieces: Pieces; k: CardKey }) {
	const set = chipsOf(pieces, k).length > 0
	const tags = k === "themes" || k === "styles" ? k : null
	const picks = tags ? d.picked.filter((t) => t.group === tags).length : 0
	return (
		<section aria-label={TITLE.get(k)} className="min-w-0 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
			<div className="mb-3 flex h-6 items-center gap-2">
				<span className={`h-2 w-2 shrink-0 rounded-full ${FILTER_ACCENTS[k].dot}`} />
				<h3 className="truncate text-[15px] font-bold text-white">{TITLE.get(k)}</h3>
				{tags && <span className="text-[12px] text-gray-500">{picks ? `Any of these · ${picks} of 3` : "Up to 3"}</span>}
				{set && (
					<button
						type="button"
						onClick={() => clearCard(d, pieces, k)}
						className="ml-auto rounded-md px-1.5 py-0.5 text-[12px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						Clear
					</button>
				)}
			</div>
			{tags ? (
				<div className="flex flex-wrap gap-1.5">
					{byCount(TAGS.filter((t) => t.group === tags).map((t) => tagOption(d, t))).map((o) => (
						<Chip key={o.id} o={o} />
					))}
				</div>
			) : (
				<NicheControl d={d} pieces={pieces} k={k} />
			)}
		</section>
	)
}

function SubTabRow({
	pieces,
	sub,
	onSub,
	finding,
	right,
	phone,
}: {
	pieces: Pieces
	sub: SubKey
	onSub: (k: SubKey) => void
	finding: boolean
	right?: ReactNode
	phone: boolean
}) {
	return (
		<div className={`flex items-center gap-4 border-b border-white/[0.07] ${phone ? "-mx-5 px-5" : "px-6"}`}>
			<div
				role="tablist"
				aria-label="More filters"
				className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{SUBTABS.map((t) => {
					const on = !finding && t.key === sub
					const n = subCount(pieces, t)
					return (
						<button
							key={t.key}
							type="button"
							role="tab"
							aria-selected={on}
							onClick={() => onSub(t.key)}
							className={`-mb-px flex h-[52px] shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 text-[14px] font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
								on ? "border-amber-400 text-white" : "border-transparent text-gray-400 hover:text-gray-100"
							}`}
						>
							{t.label}
							{n > 0 && (
								<span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold tabular-nums text-gray-950">
									{n}
								</span>
							)}
						</button>
					)
				})}
			</div>
			{right}
		</div>
	)
}

const FIND_CSS = `.r41-find > .flex-col { display: block; column-count: 2; column-gap: 40px }
.r41-find > .flex-col > section { break-inside: avoid; margin-bottom: 28px }`

function MoreLayout({
	d,
	pieces,
	sub,
	onSub,
	phone,
}: { d: ProtoDiscover; pieces: Pieces; sub: SubKey; onSub: (k: SubKey) => void; phone: boolean }) {
	const [find, setFind] = useState("")
	const finding = find.trim() !== ""
	const tab = SUBTABS.find((t) => t.key === sub) ?? SUBTABS[0]
	const columns = tab.columns.map((c) => c.filter(keep(pieces))).filter((c) => c.length)
	const pick = (k: SubKey) => {
		setFind("")
		onSub(k)
	}
	const field = (
		<FilterSearchField value={find} onChange={setFind} className={phone ? "w-full" : "h-10 w-[300px] shrink-0"} />
	)
	const body = finding ? (
		<div>
			{!phone && <style dangerouslySetInnerHTML={{ __html: FIND_CSS }} />}
			<FilterGroups data={pieces.groups} query={find} className={phone ? "" : "r41-find"} />
		</div>
	) : (
		<CardsGate pieces={pieces}>
			<AnimatePresence mode="wait" initial={false}>
				<motion.div
					key={tab.key}
					role="tabpanel"
					aria-label={tab.label}
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.14 }}
					className={phone ? "flex flex-col gap-3" : "grid grid-cols-2 items-start gap-4"}
				>
					{columns.map((col) => (
						<div key={col.join()} className={`flex min-w-0 flex-col gap-3 ${phone ? "" : "gap-4"}`}>
							{col.map((k) => (
								<FilterBlock key={k} d={d} pieces={pieces} k={k} />
							))}
						</div>
					))}
				</motion.div>
			</AnimatePresence>
		</CardsGate>
	)
	if (phone)
		return (
			<div>
				{field}
				<SubTabRow pieces={pieces} sub={sub} onSub={pick} finding={finding} phone />
				<div className="pt-4">{body}</div>
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			<SubTabRow pieces={pieces} sub={sub} onSub={pick} finding={finding} right={field} phone={false} />
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{body}</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function Footer({ d, pieces, onDone }: { d: ProtoDiscover; pieces: Pieces; onDone: () => void }) {
	const clearAll = useClearAll(d)
	const n = pieces.secondaryCount + (d.q ? 1 : 0)
	return (
		<div className="flex shrink-0 items-center gap-4 border-t border-white/[0.06] bg-gray-950/85 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:pb-3">
			<button
				type="button"
				onClick={clearAll}
				disabled={!n}
				className="rounded-md px-2 py-1 text-sm text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
			>
				{n ? `Clear all ${n}` : "Clear all"}
			</button>
			<span className="hidden items-center gap-2.5 text-sm text-gray-400 lg:flex">
				<HiddenMeter counts={d.counts} className="w-24" />
				{d.counts && d.counts.hidden > 0 && (
					<span>
						<RollingNumber value={d.counts.hidden} className="font-semibold text-gray-200" /> hidden
					</span>
				)}
			</span>
			<ShowTitlesButton counts={d.counts} onClick={onDone} className="ml-auto h-11 min-w-48 max-sm:flex-1" />
		</div>
	)
}

interface SearchProps {
	text: string
	typing: boolean
	onRun: (t: string) => void
	onDone: () => void
	input?: ReactNode
}

function Layout({
	seg,
	d,
	pieces,
	phone,
	search,
	more,
}: {
	seg: SegKey
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	search: SearchProps
	more: { sub: SubKey; onSub: (k: SubKey) => void }
}) {
	switch (seg) {
		case "search":
			return <SearchLayout d={d} phone={phone} {...search} />
		case "mood":
			return <MoodLayout d={d} phone={phone} />
		case "streaming":
			return <StreamingLayout d={d} pieces={pieces} phone={phone} />
		case "watched":
			return <WatchedLayout d={d} pieces={pieces} phone={phone} />
		case "more":
			return <MoreLayout d={d} pieces={pieces} phone={phone} {...more} />
	}
}

function useSegState(pieces: Pieces) {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [sub, setSub] = useState<SubKey | null>(null)
	const go = (k: SegKey | null) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		if (k === "more" && seg !== "more") setSub((p) => p ?? firstSub(pieces))
		setSeg(k)
	}
	return { seg, dir, go, sub: sub ?? firstSub(pieces), setSub }
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const values = segValues(d, pieces)
	const { seg, dir, go, sub, setSub } = useSegState(pieces)
	const [text, setText] = useState("")
	const panel = useRef<HTMLDivElement>(null)
	const open = seg !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const close = () => go(null)
	useOutsideClose(open, close, panel)
	const pick = (k: SegKey) => {
		if (k === "search") setText(d.q ?? "")
		go(k)
	}
	useSlashKey(() => pick("search"))
	const typed = text.trim()
	const typing = seg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="r41"
					values={values}
					active={seg}
					onPick={pick}
					onClearSearch={() => d.setQ(null)}
					searchInput={
						seg === "search" ? (
							<SearchInput value={text} onChange={setText} onEnter={() => (typed ? run(typed) : close())} onEscape={close} />
						) : undefined
					}
				/>
				<AnimatePresence>
					{open && (
						<motion.div
							ref={panel}
							role="dialog"
							aria-label={SEG_LABEL[seg]}
							initial={{ opacity: 0, y: -8, scaleY: 0.97 }}
							animate={{ opacity: 1, y: 0, scaleY: 1 }}
							exit={{ opacity: 0, y: -6, scaleY: 0.98 }}
							transition={MORPH_T}
							style={{ transformOrigin: "top center" }}
							className="absolute inset-x-0 top-[calc(76px+10px)] z-40 flex h-[min(580px,calc(100vh-200px))] flex-col overflow-hidden rounded-[24px] bg-[#0b1120] shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,0.09)]"
						>
							<div className="relative min-h-0 flex-1 overflow-hidden">
								<AnimatePresence initial={false} custom={dir}>
									<motion.div
										key={seg}
										custom={dir}
										variants={MORPH}
										initial="enter"
										animate="center"
										exit="exit"
										transition={MORPH_T}
										className="absolute inset-0"
									>
										<Layout
											seg={seg}
											d={d}
											pieces={pieces}
											phone={false}
											search={{ text: typed, typing, onRun: run, onDone: close }}
											more={{ sub, onSub: setSub }}
										/>
									</motion.div>
								</AnimatePresence>
							</div>
							<Footer d={d} pieces={pieces} onDone={close} />
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={pick} className="mt-3" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones

function Tabs({ seg, onPick, values }: { seg: SegKey; onPick: (k: SegKey) => void; values: ReturnType<typeof segValues> }) {
	return (
		<div role="tablist" aria-label="Filters" className="flex gap-0.5 px-2 pt-1 pb-2">
			{SEG_ORDER.map((k) => {
				const on = seg === k
				const badge = values[k].badge
				const set = k !== "more" && values[k].value !== null
				return (
					<motion.button
						key={k}
						type="button"
						role="tab"
						aria-selected={on}
						whileTap={TAP}
						onClick={() => onPick(k)}
						className={`relative flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "text-gray-950" : "text-gray-300"}`}
					>
						{on && (
							<motion.span
								layoutId="r41-tab"
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-0 rounded-full bg-white"
							/>
						)}
						<span className="relative flex items-center gap-1.5">
							{k === "search" && <MagnifyingGlassIcon className="h-4 w-4" aria-hidden />}
							{SEG_LABEL[k]}
							{set && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="set" />}
							{badge ? (
								<span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] text-gray-950">
									{badge}
								</span>
							) : null}
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

function Phone({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const values = segValues(d, pieces)
	const { seg, dir, go, sub, setSub } = useSegState(pieces)
	const [last, setLast] = useState<SegKey>("mood")
	const [text, setText] = useState("")
	const shownSeg = seg ?? last
	const openAt = (k: SegKey) => {
		if (k === "search") setText(d.q ?? "")
		setLast(k)
		go(k)
	}
	const typed = text.trim()
	const typing = shownSeg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar values={values} onPick={openAt} onClearSearch={() => d.setQ(null)} />
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={openAt} className="mt-2" />
			<SnapSheet
				index={seg ? 0 : -1}
				onIndex={(i) => i < 0 && go(null)}
				snaps={[0.94]}
				label="Filters"
				header={<Tabs seg={shownSeg} onPick={openAt} values={values} />}
				footer={<Footer d={d} pieces={pieces} onDone={() => go(null)} />}
			>
				<div className="relative overflow-hidden px-5 pt-3 pb-8">
					<AnimatePresence initial={false} custom={dir} mode="popLayout">
						<motion.div key={shownSeg} custom={dir} variants={MORPH} initial="enter" animate="center" exit="exit" transition={MORPH_T}>
							<Layout
								seg={shownSeg}
								d={d}
								pieces={pieces}
								phone
								search={{
									text: typed,
									typing,
									onRun: run,
									onDone: () => go(null),
									input: (
										<SearchInput
											value={text}
											onChange={setText}
											onEnter={() => (typed ? run(typed) : go(null))}
											size="md"
											autoFocus={false}
										/>
									),
								}}
								more={{ sub, onSub: setSub }}
							/>
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantR4_1({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const [dim, setDim] = useState(false)
	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8 lg:pt-6">
				<PageTitle />
				<Desktop d={d} pieces={pieces} onOpenChange={setDim} />
				<Phone d={d} pieces={pieces} />
				<GridUnder d={d} dim={dim} />
			</div>
		</MotionConfig>
	)
}
