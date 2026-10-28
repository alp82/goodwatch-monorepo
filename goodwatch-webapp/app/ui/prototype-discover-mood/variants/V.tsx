// PROTOTYPE - throwaway. Variant V, "Segmented mega panel": the same segmented bar as R (Mood search, Mood,
// Streaming, Watched, More), but each segment opens M's wide bar panel in that segment's own layout, and the panel
// morphs between segments without closing. Mood: M's mood filter with movies or shows and genre. Streaming: the
// service logos as a grid, with everywhere and my services. Watched: not seen yet, score, released. More: the niche
// filters as an index by kind with short hints, the chosen one beside it. Sticky footer: Clear all and Show N.
// Phones: the stacked bar card; a bottom sheet with the segments as tabs on top.
import { ArrowTurnDownLeftIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups, ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { type CardKey, cardOf } from "~/ui/filter-bar/filter-cards"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { EXAMPLE_PROMPTS, type ProtoDiscover, useFilterPieces } from "../kit"
import {
	CountryLine,
	GenreControl,
	GridUnder,
	NICHE_KEYS,
	NicheControl,
	NicheRow,
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
	chipsOf,
	clearCard,
	nicheFor,
	segValues,
	useClearAll,
	useOutsideClose,
	useSlashKey,
} from "./R-parts"

export const NAME = "Segmented mega panel"

const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"
const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

// ---------------------------------------------------------------------------------------------------------------
// Each segment's own layout. `phone` stacks the columns.

function Tile({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] ${className}`}>{children}</div>
}

function SearchLayout({
	d,
	pieces,
	text,
	typing,
	onRun,
	input,
	phone,
}: {
	d: ProtoDiscover
	pieces: Pieces
	text: string
	typing: boolean
	onRun: (t: string) => void
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
					<button
						type="button"
						onClick={() => onRun(text)}
						className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-2xl bg-amber-400/[0.12] px-4 text-left ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search the mood:</span>
						<span className={`brand-header min-w-0 flex-1 truncate text-[22px] text-white ${PRIVATE}`}>{text}</span>
						<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-1 font-sans text-xs font-semibold text-amber-200/80 sm:flex">
							<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
							Enter
						</kbd>
					</button>
				) : d.q ? (
					<div className="rounded-2xl bg-amber-500/[0.07] p-4 ring-1 ring-inset ring-amber-400/25">
						<h3 className={`${SECTION_LABEL} mb-1.5 text-amber-300/90`}>Searching the mood</h3>
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
					{EXAMPLE_PROMPTS.map((prompt) => (
						<button
							key={prompt}
							type="button"
							onClick={() => onRun(prompt)}
							className="flex h-11 min-w-0 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-gray-200 cursor-pointer outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-400/70" aria-hidden />
							<span className="truncate">{prompt}</span>
						</button>
					))}
				</div>
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

function MoreLayout({
	d,
	pieces,
	picked,
	onPick,
	phone,
}: { d: ProtoDiscover; pieces: Pieces; picked: CardKey | null; onPick: (k: CardKey | null) => void; phone: boolean }) {
	const groups = nicheFor(pieces)
	const item = groups.flatMap((g) => g.items).find((i) => i.k === picked)
	const index = groups.map((g) => (
		<div key={g.kind} className="mb-3">
			<h4 className={`${SECTION_LABEL} mb-1 px-3 text-gray-500`}>{g.kind}</h4>
			{g.items.map((it) => (
				<div key={it.k}>
					<NicheRow
						item={it}
						pieces={pieces}
						open={picked === it.k}
						chevron={phone ? "down" : "right"}
						onClick={() => onPick(phone && picked === it.k ? null : it.k)}
					/>
					{phone && picked === it.k && (
						<motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="px-3 pt-2 pb-4">
							<NicheControl d={d} pieces={pieces} k={it.k} />
						</motion.div>
					)}
				</div>
			))}
		</div>
	))
	if (phone) return <div>{index}</div>
	return (
		<div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)]">
			<nav aria-label="More filters" className="min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] bg-black/20 px-3 py-4">
				{index}
			</nav>
			<div className="min-h-0 overflow-y-auto overscroll-contain px-7 py-5">
				{item && (
					<AnimatePresence mode="wait" initial={false}>
						<motion.div
							key={item.k}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.14 }}
						>
							<div className="mb-4 flex items-center gap-3">
								<div className="min-w-0">
									<h3 className="text-[19px] font-bold text-white">{item.title}</h3>
									<p className="text-[13px] text-gray-500">{item.hint}</p>
								</div>
								{chipsOf(pieces, item.k).length > 0 && (
									<button
										type="button"
										onClick={() => clearCard(d, pieces, item.k)}
										className="ml-auto rounded-md px-2 py-1 text-[13px] text-gray-400 cursor-pointer outline-none hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
									>
										Clear
									</button>
								)}
							</div>
							<NicheControl d={d} pieces={pieces} k={item.k} />
						</motion.div>
					</AnimatePresence>
				)}
			</div>
		</div>
	)
}

/** The niche filter More opens at: the first one set, else About. */
const firstNiche = (pieces: Pieces): CardKey =>
	pieces.chips.map((c) => cardOf(c.group)).find((k): k is CardKey => !!k && NICHE_KEYS.has(k)) ?? "themes"

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
	search: { text: string; typing: boolean; onRun: (t: string) => void; input?: ReactNode }
	more: { picked: CardKey | null; onPick: (k: CardKey | null) => void }
}) {
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
			return <MoreLayout d={d} pieces={pieces} phone={phone} {...more} />
	}
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function useSegState(pieces: Pieces) {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [picked, setPicked] = useState<CardKey | null>(null)
	const go = (k: SegKey | null) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		if (k === "more" && seg !== "more") setPicked((p) => p ?? firstNiche(pieces))
		setSeg(k)
	}
	return { seg, dir, go, picked: picked ?? firstNiche(pieces), setPicked }
}

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const values = segValues(d, pieces)
	const { seg, dir, go, picked, setPicked } = useSegState(pieces)
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
					id="v"
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
							className="absolute inset-x-0 top-[calc(76px+10px)] z-40 flex h-[min(500px,calc(100vh-220px))] flex-col overflow-hidden rounded-[24px] bg-[#0b1120] shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,0.09)]"
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
											search={{ text: typed, typing, onRun: run }}
											more={{ picked, onPick: (k) => k && setPicked(k) }}
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
				const set = k !== "search" && k !== "more" ? values[k].value !== null : k === "search" && values.search.value !== null
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
								layoutId="v-tab"
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-0 rounded-full bg-white"
							/>
						)}
						<span className="relative flex items-center gap-1.5">
							{k === "search" && <MagnifyingGlassIcon className="h-4 w-4" aria-hidden />}
							{k === "search" ? "Search" : SEG_LABEL[k]}
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
	const { seg, dir, go } = useSegState(pieces)
	const [phonePicked, setPhonePicked] = useState<CardKey | null>(null)
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
								more={{ picked: phonePicked, onPick: setPhonePicked }}
							/>
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantV({ d }: { d: ProtoDiscover }) {
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
