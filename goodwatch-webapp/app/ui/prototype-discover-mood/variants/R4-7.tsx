// PROTOTYPE - throwaway. Round 4 variant 7, "Find a filter in the bar": V's segmented bar (Search, Mood, Streaming,
// Watched, More) ends with a small "Find a filter" segment. Typing there opens the panel with matches from every
// filter at once, grouped by the segment they live in (Mood, Streaming, Watched, More), each settable in place; a pick
// briefly lights its segment in the bar. The Search segment stays the big one: what to watch (a mood, a title, or
// like a title). More is sub-tabs, one per kind, each showing all its filters at once.
// Phones: the stacked bar card with a magnifier cell; the sheet has the segments as tabs and the find field under them.
import { ArrowTurnDownLeftIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { FilterSearchField } from "~/ui/filter-bar/FilterGroups"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { EXAMPLE_PROMPTS, type ProtoDiscover, useFilterPieces } from "../kit"
import { FindResults } from "./R4-7-find"
import {
	CountryLine,
	EXAMPLE_TITLES,
	GenreControl,
	GridUnder,
	MoreTabs,
	NotSeenControl,
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
	TitleRow,
	TitleRowsLoading,
	TypeControl,
	WarmCards,
	firstMoreTab,
	segValues,
	useClearAll,
	useOutsideClose,
	useQuickTitles,
	useScrollTopOn,
	useSimilar,
	useSlashKey,
} from "./R4-7-parts"

export const NAME = "Find a filter in the bar"

type PanelKey = SegKey | "find"
const ORDER: PanelKey[] = [...SEG_ORDER, "find"]
const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"
const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

// ---------------------------------------------------------------------------------------------------------------
// Search: what to watch. One example of each kind; typing offers the search and the titles by that name.

function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ${className}`}>{children}</div>
}

function ExampleRow({ text, kind, onClick }: { text: string; kind: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex h-11 min-w-0 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-gray-200 cursor-pointer outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-400/70" aria-hidden />
			<span className="min-w-0 flex-1 truncate">{text}</span>
			<span className="shrink-0 text-[12px] text-gray-600">{kind}</span>
		</button>
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
	const similar = useSimilar(d)
	const titles = useQuickTitles(typing ? text : "")
	const like = EXAMPLE_TITLES[1]
	return (
		<div className={phone ? "flex flex-col gap-5" : "grid h-full min-h-0 grid-cols-[minmax(0,6fr)_minmax(0,5fr)]"}>
			<div className={phone ? "" : "min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-6 py-5"}>
				{input && (
					<div className="mb-4 flex h-14 items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)]">
						<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
						{input}
					</div>
				)}
				{typing ? (
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
				) : d.q ? (
					<div className="rounded-2xl bg-amber-500/[0.07] p-4 ring-1 ring-inset ring-amber-400/25">
						<h3 className={`${SECTION_LABEL} mb-1.5 text-amber-300/90`}>Searching</h3>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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
				) : null}
				<h3 className={`${SECTION_LABEL} mt-5 mb-2 px-1 text-gray-500 first:mt-0`}>Try</h3>
				<div className="flex flex-col">
					<ExampleRow text={EXAMPLE_PROMPTS[0]} kind="Mood" onClick={() => onRun(EXAMPLE_PROMPTS[0])} />
					<ExampleRow text={EXAMPLE_TITLES[0].title} kind="Title" onClick={() => onRun(EXAMPLE_TITLES[0].title)} />
					<ExampleRow
						text={`like ${like.title}`}
						kind="Similar to"
						onClick={() => {
							if (!similar.has(like.key)) similar.toggle(like.key)
							onDone()
						}}
					/>
					<ExampleRow text={EXAMPLE_PROMPTS[1]} kind="Mood" onClick={() => onRun(EXAMPLE_PROMPTS[1])} />
					<ExampleRow text={EXAMPLE_PROMPTS[2]} kind="Mood" onClick={() => onRun(EXAMPLE_PROMPTS[2])} />
				</div>
			</div>
			<div className={phone ? "" : "min-h-0 overflow-y-auto overscroll-contain px-6 py-5"}>
				{typing ? (
					<>
						<h3 className={`${SECTION_LABEL} mb-2 px-2 text-gray-400`}>Titles</h3>
						{titles.found.length > 0 ? (
							titles.found
								.slice(0, 4)
								.map((t) => <TitleRow key={t.key} t={t} liked={similar.has(t.key)} onLike={() => similar.toggle(t.key)} />)
						) : titles.loading || text.length < 2 ? (
							<TitleRowsLoading />
						) : (
							<p className="px-2 text-[13px] text-gray-500">No title called “{text}”</p>
						)}
					</>
				) : (
					<TagChips d={d} group="moods" />
				)}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The other segments, as in V.

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

interface LayoutProps {
	seg: PanelKey
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	search: { text: string; typing: boolean; onRun: (t: string) => void; onDone: () => void; input?: ReactNode }
	more: { tab: string; onTab: (t: string) => void }
	find: { text: string; onText: (t: string) => void; onPicked: (k: SegKey) => void }
}

function Layout({ seg, d, pieces, phone, search, more, find }: LayoutProps) {
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
			return <MoreTabs id={phone ? "p7" : "d7"} d={d} pieces={pieces} phone={phone} {...more} />
		case "find":
			return (
				<FindResults
					d={d}
					pieces={pieces}
					phone={phone}
					text={find.text}
					onText={find.onText}
					onPicked={find.onPicked}
					onSearch={(t) => search.onRun(t)}
				/>
			)
	}
}

/** Remembers which segment a press inside the find results belongs to, and lights it once the filters change. */
function usePickFlash(d: ProtoDiscover) {
	const pending = useRef<{ k: SegKey; at: number } | null>(null)
	const [flash, setFlash] = useState<{ k: SegKey; n: number } | null>(null)
	const key = `${d.filters.query}|${d.filters.state.notSeenYet}`
	const last = useRef(key)
	useEffect(() => {
		if (key === last.current) return
		last.current = key
		const p = pending.current
		if (p && Date.now() - p.at < 1500) setFlash((f) => ({ k: p.k, n: (f?.n ?? 0) + 1 }))
		pending.current = null
	}, [key])
	return { flash, onPicked: (k: SegKey) => (pending.current = { k, at: Date.now() }) }
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function FindSegment({
	on,
	text,
	onText,
	onOpen,
	onClose,
}: { on: boolean; text: string; onText: (t: string) => void; onOpen: () => void; onClose: () => void }) {
	return (
		<div data-seg="find" className="relative flex w-[204px] shrink-0 items-center pr-1.5 pl-3">
			{on ? (
				<label className="flex h-11 w-full min-w-0 items-center gap-2 rounded-full bg-white/[0.08] px-3.5 ring-1 ring-inset ring-amber-400/60">
					<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />
					<span className="sr-only">Find a filter</span>
					<input
						// biome-ignore lint/a11y/noAutofocus: the segment turns into the field when tapped
						autoFocus
						type="search"
						value={text}
						autoComplete="off"
						placeholder="horror, Netflix, a name"
						onChange={(e) => onText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Escape") {
								e.preventDefault()
								if (text) onText("")
								else onClose()
							}
						}}
						className="w-full min-w-0 border-0 bg-transparent p-0 text-[14px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
					/>
					{text && (
						<button type="button" onClick={() => onText("")} aria-label="Clear" className="text-gray-500 cursor-pointer hover:text-white">
							<XMarkIcon className="h-4 w-4" />
						</button>
					)}
				</label>
			) : (
				<motion.button
					type="button"
					whileTap={{ scale: 0.97 }}
					onClick={onOpen}
					aria-haspopup="dialog"
					className="flex h-11 w-full min-w-0 items-center gap-2 rounded-full px-3.5 text-[14px] text-gray-300 ring-1 ring-inset ring-white/10 cursor-pointer outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
					{text ? <span className="truncate text-white">{text}</span> : "Find a filter"}
				</motion.button>
			)}
		</div>
	)
}

function useSegState(pieces: Pieces) {
	const [seg, setSeg] = useState<PanelKey | null>(null)
	const [dir, setDir] = useState(1)
	const [tab, setTab] = useState<string | null>(null)
	const go = (k: PanelKey | null) => {
		if (k && seg) setDir(ORDER.indexOf(k) >= ORDER.indexOf(seg) ? 1 : -1)
		if (k === "more" && seg !== "more") setTab((t) => t ?? firstMoreTab(pieces))
		setSeg(k)
	}
	return { seg, dir, go, tab: tab ?? firstMoreTab(pieces), setTab }
}

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const values = segValues(d, pieces)
	const { seg, dir, go, tab, setTab } = useSegState(pieces)
	const [text, setText] = useState("")
	const [findText, setFindText] = useState("")
	const { flash, onPicked } = usePickFlash(d)
	const panel = useRef<HTMLDivElement>(null)
	const open = seg !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const close = () => {
		setFindText("")
		go(null)
	}
	useOutsideClose(open, close, panel)
	const pick = (k: SegKey) => {
		if (k === "search") setText(d.q ?? "")
		setFindText("")
		go(k)
	}
	useSlashKey(() => pick("search"))
	const typed = text.trim()
	const typing = seg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		close()
	}
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="v7"
					values={values}
					active={seg === "find" ? null : seg}
					onPick={pick}
					onClearSearch={() => d.setQ(null)}
					flash={flash}
					searchInput={
						seg === "search" ? (
							<SearchInput value={text} onChange={setText} onEnter={() => (typed ? run(typed) : close())} onEscape={close} />
						) : undefined
					}
					tail={
						<FindSegment
							on={seg === "find"}
							text={findText}
							onText={setFindText}
							onOpen={() => go("find")}
							onClose={close}
						/>
					}
				/>
				<AnimatePresence>
					{open && (
						<motion.div
							ref={panel}
							role="dialog"
							aria-label={seg === "find" ? "Find a filter" : SEG_LABEL[seg]}
							initial={{ opacity: 0, y: -8, scaleY: 0.97 }}
							animate={{ opacity: 1, y: 0, scaleY: 1 }}
							exit={{ opacity: 0, y: -6, scaleY: 0.98 }}
							transition={MORPH_T}
							style={{ transformOrigin: "top center" }}
							className="absolute inset-x-0 top-[calc(76px+10px)] z-40 flex h-[min(520px,calc(100vh-220px))] flex-col overflow-hidden rounded-[24px] bg-[#0b1120] shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,0.09)]"
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
											more={{ tab, onTab: setTab }}
											find={{ text: findText, onText: setFindText, onPicked }}
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

function Tabs({ seg, onPick, values }: { seg: PanelKey; onPick: (k: SegKey) => void; values: ReturnType<typeof segValues> }) {
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
								layoutId="v7-tab"
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-0 rounded-full bg-white"
							/>
						)}
						<span className="relative flex items-center gap-1.5">
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
	const { seg, dir, go, tab, setTab } = useSegState(pieces)
	const [last, setLast] = useState<SegKey>("mood")
	const [text, setText] = useState("")
	const [findText, setFindText] = useState("")
	const findField = useRef<HTMLInputElement>(null)
	const finding = findText.trim() !== ""
	const shownSeg: PanelKey = finding ? "find" : seg && seg !== "find" ? seg : last
	const openAt = (k: SegKey) => {
		if (k === "search") setText(d.q ?? "")
		setFindText("")
		setLast(k)
		go(k)
	}
	const openFind = () => {
		go(last)
		setTimeout(() => findField.current?.focus(), 350)
	}
	const typed = text.trim()
	const typing = shownSeg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	const body = useRef<HTMLDivElement>(null)
	useScrollTopOn(body, `${shownSeg}|${shownSeg === "more" ? tab : ""}|${findText.trim()}`)
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar
					values={values}
					onPick={openAt}
					onClearSearch={() => d.setQ(null)}
					tail={
						<button
							type="button"
							onClick={openFind}
							aria-label="Find a filter"
							className="grid h-[52px] place-items-center border-l border-white/[0.08] text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
						>
							<MagnifyingGlassIcon className="h-5 w-5" />
						</button>
					}
				/>
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={openAt} className="mt-2" />
			<SnapSheet
				index={seg ? 0 : -1}
				onIndex={(i) => i < 0 && go(null)}
				snaps={[0.94]}
				label="Filters"
				header={
					<div>
						<Tabs seg={shownSeg} onPick={openAt} values={values} />
						<div className="px-4 pb-2">
							<FilterSearchField value={findText} onChange={setFindText} inputRef={findField} className="h-10" />
						</div>
					</div>
				}
				footer={<Footer d={d} pieces={pieces} onDone={() => go(null)} />}
			>
				<div ref={body} className="relative overflow-hidden px-5 pt-3 pb-8">
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
								more={{ tab, onTab: setTab }}
								find={{ text: findText, onText: setFindText, onPicked: () => {} }}
							/>
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantR4_7({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const [dim, setDim] = useState(false)
	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8 lg:pt-6">
				<PageTitle />
				<Desktop d={d} pieces={pieces} onOpenChange={setDim} />
				<Phone d={d} pieces={pieces} />
				<GridUnder d={d} dim={dim} />
				<WarmCards pieces={pieces} />
			</div>
		</MotionConfig>
	)
}
