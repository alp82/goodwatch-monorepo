// PROTOTYPE - throwaway. Round 4 base for variant 5, copied from V: the static title, the segmented bar (Search,
// Mood, Streaming, Watched, More), one status line, and the panel under the bar that morphs between segments at a
// fixed height. The Search segment is round 4's: examples of each kind (a mood, a title, like a title); while typing,
// "Search: <text>", up to four title matches with "Like this", and the filters matching the words. The More segment's
// layout comes from the variant (`More`). Phones: the stacked bar card and a bottom sheet with the segments as tabs.
import { ArrowTurnDownLeftIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ComponentType, type ReactNode, useEffect, useRef, useState } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups, ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { type TitleKey, titleKey } from "~/utils/title-key"
import { type ProtoDiscover, useFilterPieces } from "../kit"
import {
	CountryLine,
	GenreControl,
	GridUnder,
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
	useSlashKey,
} from "./R4-5-parts"

export const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"
const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

export interface MoreProps {
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
}

// ---------------------------------------------------------------------------------------------------------------
// Title matches: the site's quick title search (the filter pickers' /api/search).

interface Found {
	key: TitleKey
	title: string
	year: string
	type: "movie" | "show"
	poster: string | null
}

function useDebounced<T>(value: T, ms = 220): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms)
		return () => clearTimeout(id)
	}, [value, ms])
	return v
}

function useQuickTitles(text: string) {
	const term = useDebounced(text.trim())
	const { locale } = useLocale()
	const q = useQuery<{
		searchResults: {
			id: number
			media_type: "movie" | "show"
			title?: string
			name?: string
			release_date?: string
			first_air_date?: string
			poster_path?: string | null
		}[]
	}>({
		queryKey: ["filter-title-search", term, locale.language],
		queryFn: async () => (await fetch(mediaLanguageUrl(`/api/search?query=${encodeURIComponent(term)}`, locale.language))).json(),
		enabled: term.length >= 2,
		staleTime: 60_000,
	})
	const found: Found[] = (term.length >= 2 ? (q.data?.searchResults ?? []) : [])
		.filter((r) => r.media_type === "movie" || r.media_type === "show")
		.slice(0, 4)
		.map((r) => ({
			key: titleKey(r.media_type, r.id),
			title: r.title ?? r.name ?? "",
			year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
			type: r.media_type,
			poster: r.poster_path ?? null,
		}))
	return { found, loading: text.trim().length >= 2 && (q.isFetching || term !== text.trim()) }
}

const POSTER = "https://image.tmdb.org/t/p/w92"
/** Severance, for the "like a title" example. */
const SEVERANCE: TitleKey = titleKey("show", 95396)

const addSimilar = (d: ProtoDiscover, key: TitleKey) =>
	d.filters.set({ similarTo: [...new Set([...(d.filters.state.similarTo ?? []), key])] })

// ---------------------------------------------------------------------------------------------------------------
// Search

const EXAMPLES: { kind: string; text: string; similar?: TitleKey }[] = [
	{ kind: "Mood", text: "cozy rainy day mystery" },
	{ kind: "Title", text: "The Bear" },
	{ kind: "Like", text: "like Severance", similar: SEVERANCE },
]

function TitleMatches({ d, text, onRun, onDone }: { d: ProtoDiscover; text: string; onRun: (t: string) => void; onDone: () => void }) {
	const { found, loading } = useQuickTitles(text)
	const similar = d.filters.state.similarTo ?? []
	return (
		<div className="mt-5">
			<h3 className={`${SECTION_LABEL} mb-1.5 px-1 text-gray-500`}>Titles</h3>
			<div className="flex h-[232px] flex-col">
				{found.map((t) => {
					const on = similar.includes(t.key)
					return (
						<div key={t.key} className="group flex h-[58px] min-w-0 items-center gap-3 rounded-xl pr-2 pl-1 hover:bg-white/[0.05]">
							<button
								type="button"
								onClick={() => onRun(t.title)}
								className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span className="block h-[50px] w-[34px] shrink-0 overflow-hidden rounded-md bg-white/[0.06]">
									{t.poster && <img src={`${POSTER}${t.poster}`} alt="" loading="lazy" className="h-full w-full object-cover" />}
								</span>
								<span className="min-w-0">
									<span className="block truncate text-[15px] font-semibold text-gray-100">{t.title}</span>
									<span className="block text-[12px] text-gray-500">
										{t.type === "movie" ? "Movie" : "Show"}
										{t.year && ` · ${t.year}`}
									</span>
								</span>
							</button>
							<button
								type="button"
								aria-pressed={on}
								onClick={() => {
									if (!on) addSimilar(d, t.key)
									onDone()
								}}
								className={`h-8 shrink-0 rounded-full px-3 text-[13px] font-semibold cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
									on ? "bg-white/[0.12] text-white" : "text-gray-300 ring-1 ring-white/15 hover:bg-white/[0.08] hover:text-white"
								}`}
							>
								{on ? "Similar to" : "Like this"}
							</button>
						</div>
					)
				})}
				{!found.length && (
					<p className="px-1 py-2 text-[13px] text-gray-500">{loading ? "Looking…" : text.trim().length < 2 ? "" : "No titles by that name"}</p>
				)}
			</div>
		</div>
	)
}

function SearchLayout({
	d,
	pieces,
	text,
	typing,
	onRun,
	onDone,
	input,
	phone,
}: {
	d: ProtoDiscover
	pieces: Pieces
	text: string
	typing: boolean
	onRun: (t: string) => void
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
						<TitleMatches d={d} text={text} onRun={onRun} onDone={onDone} />
					</>
				) : (
					<>
						{d.q && (
							<div className="mb-5 rounded-2xl bg-amber-500/[0.07] p-4 ring-1 ring-inset ring-amber-400/25">
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
						)}
						<h3 className={`${SECTION_LABEL} mb-2 px-1 text-gray-500`}>Try</h3>
						<div className="flex flex-col gap-1">
							{EXAMPLES.map((ex) => (
								<button
									key={ex.kind}
									type="button"
									onClick={() => {
										if (ex.similar) {
											addSimilar(d, ex.similar)
											onDone()
										} else onRun(ex.text)
									}}
									className="flex h-14 min-w-0 items-center gap-4 rounded-xl px-3 text-left cursor-pointer outline-none hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<span className="w-12 shrink-0 text-[12px] font-semibold text-gray-500">{ex.kind}</span>
									<span className="brand-header truncate text-[19px] text-gray-100">{ex.text}</span>
								</button>
							))}
						</div>
					</>
				)}
			</div>
			<div className={phone ? "" : "min-h-0 overflow-y-auto overscroll-contain px-6 py-5"}>
				{typing ? (
					<>
						<h3 className={`${SECTION_LABEL} mb-3 text-gray-400`}>Filters matching “{text}”</h3>
						<FilterGroups data={pieces.groups} query={text} />
					</>
				) : (
					<TagChips d={d} group="moods" />
				)}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The common segments, as in V

function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ${className}`}>{children}</div>
}

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
	More,
}: { seg: SegKey; d: ProtoDiscover; pieces: Pieces; phone: boolean; search: SearchProps; More: ComponentType<MoreProps> }) {
	switch (seg) {
		case "search":
			return <SearchLayout d={d} pieces={pieces} phone={phone} {...search} />
		case "mood":
			return <MoodLayout d={d} phone={phone} />
		case "streaming":
			return <StreamingLayout d={d} pieces={pieces} phone={phone} />
		case "watched":
			return <WatchedLayout d={d} pieces={pieces} phone={phone} />
		case "more":
			return <More d={d} pieces={pieces} phone={phone} />
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function useSeg() {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const go = (k: SegKey | null) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		setSeg(k)
	}
	return { seg, dir, go }
}

function Desktop({
	d,
	pieces,
	onOpenChange,
	More,
}: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void; More: ComponentType<MoreProps> }) {
	const values = segValues(d, pieces)
	const { seg, dir, go } = useSeg()
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
					id="r45"
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
											More={More}
											search={{ text: typed, typing, onRun: run, onDone: close }}
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
							<motion.span layoutId="r45-tab" transition={{ type: "spring", stiffness: 520, damping: 42 }} className="absolute inset-0 rounded-full bg-white" />
						)}
						<span className="relative flex items-center gap-1.5">
							{k === "search" && <MagnifyingGlassIcon className="h-4 w-4" aria-hidden />}
							{SEG_LABEL[k]}
							{set && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="set" />}
							{badge ? (
								<span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] text-gray-950">{badge}</span>
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
	const { seg, dir, go } = useSeg()
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
								More={More}
								search={{
									text: typed,
									typing,
									onRun: run,
									onDone: () => go(null),
									input: (
										<SearchInput value={text} onChange={setText} onEnter={() => (typed ? run(typed) : go(null))} size="md" autoFocus={false} />
									),
								}}
							/>
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

/**
 * Loads the real filter cards once, hidden, so a view that shows several cards at once mounts them in one pass (each
 * card asks the sheet to open at it right before it mounts; a lazy first load would mix those asks up).
 */
function WarmCards({ pieces }: { pieces: Pieces }) {
	const [on, setOn] = useState(false)
	useEffect(() => setOn(true), [])
	if (!on) return null
	return (
		<div hidden aria-hidden>
			<FilterGroups data={pieces.groups} query="" />
		</div>
	)
}

export function BaseVariant({ d, More }: { d: ProtoDiscover; More: ComponentType<MoreProps> }) {
	const pieces = useFilterPieces(d)
	const [dim, setDim] = useState(false)
	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8 lg:pt-6">
				<PageTitle />
				<Desktop d={d} pieces={pieces} onOpenChange={setDim} More={More} />
				<Phone d={d} pieces={pieces} More={More} />
				<GridUnder d={d} dim={dim} />
				<WarmCards pieces={pieces} />
			</div>
		</MotionConfig>
	)
}
