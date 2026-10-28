// PROTOTYPE - throwaway. Round 5 variant 12, "Four questions": 8's bar and panel with the tabs renamed for the
// questions people ask. Search (what am I looking for: the three lanes, Cast and crew, Your history with Not seen yet,
// Loved, Disliked), Mood (what should it feel like: Mood with type and genre, About, Style, plus the picked mix on top),
// Where (what fits tonight: Services, Length, Age and content, Made in), Quality (how good: Score with taste match, By
// source with critics vs audiences, Released). No More. The bar's search field stays live on every tab; typing in it
// jumps to Search. "Find a filter" sits at the right end of every tab's sub-tab row. Phones: the stacked bar card and
// the sheet, with the search field above the tabs on every tab.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { type ProtoDiscover, type Tag, tagId, useFilterPieces } from "../kit"
import { SearchLanes } from "./R5-12-lanes"
import {
	Columns,
	CountryLine,
	FilterColumn,
	GenreControl,
	GridUnder,
	NotSeenControl,
	PageTitle,
	PhoneBar,
	type Pieces,
	QUERY_SPOT,
	ReleasedControl,
	SEG_LABEL,
	SEG_ORDER,
	ScoreControl,
	SearchInput,
	type SegKey,
	SegmentBar,
	ServiceLogos,
	type Spot,
	StatusLine,
	StreamingModes,
	SubTabs,
	TagChips,
	TypeControl,
	WarmCards,
	firstSub,
	segValues,
	useClearAll,
	useOutsideClose,
	useScrollTopOn,
	useSlashKey,
} from "./R5-12-parts"

export const NAME = "Four questions"

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
// Mood: a mixer. The picked recipe sits on top of every Mood sub-tab (one slot per group, tap a slot to go there).

const MIX_GROUPS: { group: Tag["group"]; sub: string; label: string }[] = [
	{ group: "moods", sub: "mood", label: "Mood" },
	{ group: "themes", sub: "about", label: "About" },
	{ group: "styles", sub: "style", label: "Style" },
]

function MixLine({ d, onSub }: { d: ProtoDiscover; onSub: (s: string) => void }) {
	return (
		<div className="flex h-9 min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
			<span className="mr-1 shrink-0 text-[11px] font-bold tracking-[0.08em] text-gray-500 uppercase">Mix</span>
			{MIX_GROUPS.map((g, gi) => {
				const picks = d.picked.filter((t) => t.group === g.group)
				return (
					<span key={g.group} className="flex shrink-0 items-center gap-1.5">
						{gi > 0 && <span className="text-[13px] text-gray-600">+</span>}
						{picks.length ? (
							picks.map((t) => (
								<span
									key={tagId(t)}
									className="inline-flex h-7 items-center gap-1.5 rounded-full pr-1 pl-2.5 text-[13px] font-semibold text-white"
									style={{ background: `${t.color}2e`, boxShadow: `inset 0 0 0 1px ${t.color}88` }}
								>
									<span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
									{t.name}
									<button
										type="button"
										onClick={() => d.toggle(t)}
										aria-label={`Remove ${t.name}`}
										className="grid h-5 w-5 place-items-center rounded-full text-white/60 cursor-pointer hover:text-white"
									>
										<XMarkIcon className="h-3 w-3" />
									</button>
								</span>
							))
						) : (
							<button
								type="button"
								onClick={() => onSub(g.sub)}
								className="inline-flex h-7 items-center rounded-full border border-dashed border-white/20 px-3 text-[13px] text-gray-500 cursor-pointer outline-none hover:text-gray-200 focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								{g.label}
							</button>
						)}
					</span>
				)
			})}
			<span className="ml-auto shrink-0 pl-3 text-[13px] text-gray-400">
				{d.total == null ? "" : <><RollingNumber value={d.total} className="font-semibold text-gray-200" /> fit</>}
			</span>
		</div>
	)
}

function MoodBody({ d, sub, phone }: { d: ProtoDiscover; sub: string; phone: boolean }) {
	if (sub === "about") return <TagChips d={d} group="themes" big />
	if (sub === "style") return <TagChips d={d} group="styles" big />
	return (
		<Columns phone={phone} widths={[3, 2]}>
			{[
				<TagChips key="m" d={d} group="moods" big />,
				<div key="r" className="flex flex-col gap-6">
					<TypeControl d={d} />
					<GenreControl d={d} limit={phone ? 10 : 16} />
				</div>,
			]}
		</Columns>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Where: what fits tonight.

function WhereBody({ d, pieces, sub, phone }: { d: ProtoDiscover; pieces: Pieces; sub: string; phone: boolean }) {
	if (sub === "length")
		return (
			<div className="max-w-2xl">
				<FilterColumn d={d} pieces={pieces} k="runtime" />
			</div>
		)
	if (sub === "age")
		return (
			<div className="max-w-2xl">
				<FilterColumn d={d} pieces={pieces} k="ageLimit" />
			</div>
		)
	if (sub === "country")
		return (
			<div className="max-w-3xl">
				<FilterColumn d={d} pieces={pieces} k="productionCountries" />
			</div>
		)
	return (
		<div>
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

// ---------------------------------------------------------------------------------------------------------------
// Quality: how good, and when.

function QualityBody({ d, pieces, sub, phone }: { d: ProtoDiscover; pieces: Pieces; sub: string; phone: boolean }) {
	if (sub === "sources")
		return (
			<Columns phone={phone} widths={[1.2, 1]}>
				{[<FilterColumn key="s" d={d} pieces={pieces} k="sourceScores" />, <FilterColumn key="g" d={d} pieces={pieces} k="scoreGap" />]}
			</Columns>
		)
	if (sub === "released")
		return (
			<div className="max-w-2xl">
				<ReleasedControl d={d} />
			</div>
		)
	return (
		<Columns phone={phone} widths={[1, 1]}>
			{[
				<div key="s" className="max-w-md">
					<ScoreControl d={d} />
				</div>,
				<FilterColumn key="m" d={d} pieces={pieces} k="minMatch" />,
			]}
		</Columns>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Search: the lanes, cast and crew, and the viewer's history.

interface SearchProps {
	text: string
	typing: boolean
	onRun: (t: string) => void
	onFill: (t: string) => void
}

function SearchBody({ d, pieces, sub, phone, search }: { d: ProtoDiscover; pieces: Pieces; sub: string; phone: boolean; search: SearchProps }) {
	if (sub === "people")
		return (
			<div className="max-w-2xl">
				<FilterColumn d={d} pieces={pieces} k="people" />
			</div>
		)
	if (sub === "history")
		return (
			<Columns phone={phone} widths={[0.8, 1, 1]}>
				{[
					<Tile key="n">
						<h4 className="mb-3 text-[15px] font-bold text-white">Seen</h4>
						<NotSeenControl pieces={pieces} />
					</Tile>,
					<FilterColumn key="l" d={d} pieces={pieces} k="loved" />,
					<FilterColumn key="x" d={d} pieces={pieces} k="disliked" />,
				]}
			</Columns>
		)
	return <SearchLanes d={d} phone={phone} {...search} />
}

// ---------------------------------------------------------------------------------------------------------------

interface PanelProps {
	seg: SegKey
	sub: string
	onSub: (s: string) => void
	find: string
	onFind: (t: string) => void
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	search: SearchProps
}

function Panel({ seg, sub, onSub, find, onFind, d, pieces, phone, search }: PanelProps) {
	const isLanes = seg === "search" && sub === "search" && !find.trim()
	const body =
		seg === "search" ? (
			<SearchBody d={d} pieces={pieces} sub={sub} phone={phone} search={search} />
		) : seg === "mood" ? (
			<MoodBody d={d} sub={sub} phone={phone} />
		) : seg === "where" ? (
			<WhereBody d={d} pieces={pieces} sub={sub} phone={phone} />
		) : (
			<QualityBody d={d} pieces={pieces} sub={sub} phone={phone} />
		)
	return (
		<SubTabs
			id={phone ? "p12" : "d12"}
			d={d}
			pieces={pieces}
			seg={seg}
			sub={sub}
			onSub={onSub}
			find={find}
			onFind={onFind}
			phone={phone}
			bare={isLanes && !phone}
			top={seg === "mood" ? <MixLine d={d} onSub={onSub} /> : undefined}
		>
			{body}
		</SubTabs>
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

/** Which tab is open, each tab's sub-tab, the find text, and the slide direction. */
function usePanelState(d: ProtoDiscover, pieces: Pieces) {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [subs, setSubs] = useState<Partial<Record<SegKey, string>>>({})
	const [find, setFind] = useState("")
	const go = (k: SegKey | null, sub?: string) => {
		if (k && seg && k !== seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		if (k) setSubs((m) => ({ ...m, [k]: sub ?? m[k] ?? firstSub(d, pieces, k) }))
		if (k !== seg || sub) setFind("")
		setSeg(k)
	}
	const subOf = (k: SegKey) => subs[k] ?? firstSub(d, pieces, k)
	const setSub = (s: string) => seg && setSubs((m) => ({ ...m, [seg]: s }))
	return { seg, dir, go, subOf, setSub, find, setFind }
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const values = segValues(d, pieces)
	const st = usePanelState(d, pieces)
	const { seg, dir, go } = st
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const open = seg !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const close = () => go(null)
	useOutsideClose(open, close, panel)
	const openAt = (at: Spot) => {
		if (!open) setText(d.q ?? "")
		go(at.seg, at.sub)
	}
	const pick = (k: SegKey) => {
		if (!open) setText(d.q ?? "")
		go(k)
	}
	useSlashKey(() => {
		openAt(QUERY_SPOT)
		setTimeout(() => field.current?.focus(), 0)
	})
	const typed = text.trim()
	const typing = typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	// The field stays live on every tab; typing in it brings up Search's lanes.
	const onType = (t: string) => {
		setText(t)
		if (seg !== "search" || st.subOf("search") !== "search" || st.find) go("search", "search")
	}
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="v12"
					values={values}
					active={seg}
					onPick={pick}
					onClearSearch={() => d.setQ(null)}
					searchInput={
						open ? (
							<SearchInput
								value={text}
								onChange={onType}
								inputRef={field}
								autoFocus={seg === "search"}
								onFocus={() => seg !== "search" && go("search")}
								onEnter={() => (typed ? run(typed) : close())}
								onEscape={close}
							/>
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
										<Panel
											seg={seg}
											sub={st.subOf(seg)}
											onSub={st.setSub}
											find={st.find}
											onFind={st.setFind}
											d={d}
											pieces={pieces}
											phone={false}
											search={{
												text,
												typing,
												onRun: run,
												onFill: (t) => {
													setText(t)
													field.current?.focus()
												},
											}}
										/>
									</motion.div>
								</AnimatePresence>
							</div>
							<Footer d={d} pieces={pieces} onDone={close} />
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={openAt} className="mt-3" />
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
				const set = values[k].value !== null
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
								layoutId="v12-tab"
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-0 rounded-full bg-white"
							/>
						)}
						<span className="relative flex items-center gap-1.5">
							{SEG_LABEL[k]}
							{set && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="set" />}
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

function Phone({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const values = segValues(d, pieces)
	const st = usePanelState(d, pieces)
	const { seg, dir, go } = st
	const [last, setLast] = useState<SegKey>("mood")
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const shownSeg = seg ?? last
	const openAt = (at: Spot) => {
		if (!seg) setText(d.q ?? "")
		setLast(at.seg)
		go(at.seg, at.sub)
	}
	const pick = (k: SegKey) => {
		if (!seg) setText(d.q ?? "")
		setLast(k)
		go(k)
	}
	const typed = text.trim()
	const typing = typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	const onType = (t: string) => {
		setText(t)
		if (shownSeg !== "search" || st.subOf("search") !== "search" || st.find) {
			setLast("search")
			go("search", "search")
		}
	}
	const body = useRef<HTMLDivElement>(null)
	useScrollTopOn(body, `${shownSeg}|${st.subOf(shownSeg)}|${st.find.trim() ? "find" : ""}`)
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar
					values={values}
					onPick={(k) => {
						if (k !== "search") return pick(k)
						openAt(QUERY_SPOT)
						setTimeout(() => field.current?.focus(), 350)
					}}
					onClearSearch={() => d.setQ(null)}
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
						<div className="mx-4 mb-2 flex h-12 items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.45)]">
							<SearchInput
								value={text}
								onChange={onType}
								inputRef={field}
								onEnter={() => (typed ? run(typed) : go(null))}
								size="md"
								autoFocus={false}
							/>
						</div>
						<Tabs seg={shownSeg} onPick={pick} values={values} />
					</div>
				}
				footer={<Footer d={d} pieces={pieces} onDone={() => go(null)} />}
			>
				<div ref={body} className="relative overflow-hidden px-5 pt-1 pb-8">
					<AnimatePresence initial={false} custom={dir} mode="popLayout">
						<motion.div key={shownSeg} custom={dir} variants={MORPH} initial="enter" animate="center" exit="exit" transition={MORPH_T}>
							<Panel
								seg={shownSeg}
								sub={st.subOf(shownSeg)}
								onSub={st.setSub}
								find={st.find}
								onFind={st.setFind}
								d={d}
								pieces={pieces}
								phone
								search={{
									text,
									typing,
									onRun: run,
									onFill: (t) => {
										setText(t)
										field.current?.focus()
									},
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

export function VariantR5_12({ d }: { d: ProtoDiscover }) {
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
