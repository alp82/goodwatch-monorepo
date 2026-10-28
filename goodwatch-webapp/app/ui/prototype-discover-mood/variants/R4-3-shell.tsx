// PROTOTYPE - throwaway. Round 4 shell (from V): static title, the segmented bar (Search, Mood, Streaming, Watched,
// More), one status line, and the panel under the bar that morphs between segments at a fixed height. The Search
// segment teaches by example (a mood, a title, like a title); while typing it offers "Search: <text>", the first title
// matches with "Like this", and a way into Find a filter. More is the variant's own layout, passed in.
// Phones: the stacked bar card; a bottom sheet with the segments as tabs on top.
import { ArrowTurnDownLeftIcon, CheckIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ComponentType, type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { type ProtoDiscover, useFilterPieces } from "../kit"
import {
	CountryLine,
	GenreControl,
	GridUnder,
	MORE_START,
	type MoreProps,
	type MoreState,
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
	TypeControl,
	segValues,
	useClearAll,
	useOutsideClose,
	useQuickTitles,
	useSlashKey,
} from "./R4-3-parts"

export const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"
const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }
const POSTER = "https://image.tmdb.org/t/p/w92"

/** One example of each kind the search understands. */
const EXAMPLES: { text: string; kind: string }[] = [
	{ text: "cozy rainy day mystery", kind: "Mood" },
	{ text: "The Bear", kind: "Title" },
	{ text: "like Severance", kind: "Similar" },
]

function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ${className}`}>{children}</div>
}

// ---------------------------------------------------------------------------------------------------------------
// Search

function TitleMatches({ d, text, onDone }: { d: ProtoDiscover; text: string; onDone: () => void }) {
	const { found, loading } = useQuickTitles(text)
	const similar = d.filters.state.similarTo ?? []
	return (
		<div className="mt-5">
			<h3 className={`${SECTION_LABEL} mb-1.5 px-1 text-gray-500`}>Titles</h3>
			<div className="flex h-[232px] flex-col">
				{found.map((t) => {
					const on = similar.includes(t.key)
					return (
						<div key={t.key} className="flex h-14 min-w-0 shrink-0 items-center gap-3 rounded-xl px-1">
							<span className="block h-12 w-8 shrink-0 overflow-hidden rounded-md bg-white/[0.06]">
								{t.poster && <img src={`${POSTER}${t.poster}`} alt="" loading="lazy" className="h-full w-full object-cover" />}
							</span>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-[14px] font-semibold text-gray-100">{t.title}</span>
								<span className="block text-[12px] text-gray-500">
									{t.type === "movie" ? "Movie" : "Show"}
									{t.year && ` · ${t.year}`}
								</span>
							</span>
							<motion.button
								type="button"
								whileTap={TAP}
								aria-pressed={on}
								onClick={() => {
									d.filters.set({ similarTo: on ? similar.filter((k) => k !== t.key) : [...similar, t.key] })
									if (!on) onDone()
								}}
								className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
									on ? "bg-amber-400/15 text-amber-200 ring-1 ring-inset ring-amber-400/40" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.1] hover:text-white"
								}`}
							>
								{on && <CheckIcon className="h-3.5 w-3.5" aria-hidden />}
								Like this
							</motion.button>
						</div>
					)
				})}
				{!found.length && (
					<p className="px-1 py-3 text-[13px] text-gray-500">{loading || text.length < 2 ? "Looking…" : "No titles by that name"}</p>
				)}
			</div>
		</div>
	)
}

function SearchLayout({
	d,
	text,
	typing,
	onRun,
	onFind,
	onDone,
	input,
	phone,
}: {
	d: ProtoDiscover
	text: string
	typing: boolean
	onRun: (t: string) => void
	onFind: (t: string) => void
	onDone: () => void
	input?: ReactNode
	phone: boolean
}) {
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
						<TitleMatches d={d} text={text} onDone={onDone} />
						<button
							type="button"
							onClick={() => onFind(text)}
							className="mt-1 flex h-10 w-full min-w-0 items-center gap-2 rounded-xl px-1 text-left text-[13px] text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
							<span className="truncate">
								Find “<span className={PRIVATE}>{text}</span>” in filters
							</span>
						</button>
					</>
				) : (
					<>
						{d.q && (
							<div className="mb-5 rounded-2xl bg-amber-500/[0.07] p-4 ring-1 ring-inset ring-amber-400/25">
								<div className="flex items-center gap-3">
									<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
									<span className={`brand-header min-w-0 flex-1 truncate text-[22px] text-white ${PRIVATE}`}>{d.q}</span>
									<button
										type="button"
										onClick={() => d.setQ(null)}
										className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 cursor-pointer outline-none hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-amber-400"
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
						<h3 className={`${SECTION_LABEL} mb-2 px-1 text-gray-500`}>Try</h3>
						<div className="flex flex-col gap-1">
							{EXAMPLES.map((ex) => (
								<button
									key={ex.text}
									type="button"
									onClick={() => onRun(ex.text)}
									className="group flex h-12 min-w-0 items-center gap-3 rounded-xl px-3 text-left cursor-pointer outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-400/70" aria-hidden />
									<span className="min-w-0 flex-1 truncate text-[16px] text-gray-200 group-hover:text-white">{ex.text}</span>
									<span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold text-gray-400">{ex.kind}</span>
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

interface SearchBits {
	text: string
	typing: boolean
	onRun: (t: string) => void
	onFind: (t: string) => void
	onDone: () => void
	input?: ReactNode
}

function Layout({
	seg,
	d,
	pieces,
	phone,
	search,
	More,
	more,
	setMore,
}: {
	seg: SegKey
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	search: SearchBits
	More: ComponentType<MoreProps>
	more: MoreState
	setMore: (next: Partial<MoreState>) => void
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
			return <More d={d} pieces={pieces} phone={phone} more={more} setMore={setMore} />
	}
}

// ---------------------------------------------------------------------------------------------------------------
// State shared by desktop and phone

function useSegState() {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [more, setMoreState] = useState<MoreState>(MORE_START)
	const setMore = useCallback((next: Partial<MoreState>) => setMoreState((m) => ({ ...m, ...next })), [])
	const go = (k: SegKey | null) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		setSeg(k)
	}
	return { seg, dir, go, more, setMore }
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function Desktop({
	d,
	pieces,
	More,
	onOpenChange,
}: { d: ProtoDiscover; pieces: Pieces; More: ComponentType<MoreProps>; onOpenChange: (o: boolean) => void }) {
	const values = segValues(d, pieces)
	const { seg, dir, go, more, setMore } = useSegState()
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
	const find = (t: string) => {
		setMore({ find: t, group: "find", open: null })
		go("more")
	}
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="r43"
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
							className="absolute inset-x-0 top-[calc(76px+10px)] z-40 flex h-[min(540px,calc(100vh-200px))] flex-col overflow-hidden rounded-[24px] bg-[#0b1120] shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,0.09)]"
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
											search={{ text: typed, typing, onRun: run, onFind: find, onDone: close }}
											More={More}
											more={more}
											setMore={setMore}
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
								layoutId="r43-tab"
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

function Phone({ d, pieces, More }: { d: ProtoDiscover; pieces: Pieces; More: ComponentType<MoreProps> }) {
	const values = segValues(d, pieces)
	const { seg, dir, go, more, setMore } = useSegState()
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
	const find = (t: string) => {
		setMore({ find: t, group: "find", open: null })
		openAt("more")
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
				<div className="relative overflow-x-clip px-5 pt-3 pb-8">
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
									onFind: find,
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
								More={More}
								more={more}
								setMore={setMore}
							/>
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function Shell({ d, More }: { d: ProtoDiscover; More: ComponentType<MoreProps> }) {
	const pieces = useFilterPieces(d)
	const [dim, setDim] = useState(false)
	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8 lg:pt-6">
				<PageTitle />
				<Desktop d={d} pieces={pieces} More={More} onOpenChange={setDim} />
				<Phone d={d} pieces={pieces} More={More} />
				<GridUnder d={d} dim={dim} />
			</div>
		</MotionConfig>
	)
}
