// PROTOTYPE - throwaway. Round 4 variant 10, "Compact V, accordion More": V's segmented bar and full-width panel that
// morphs between segments, made tighter: a 56 px bar and a lower panel (each segment only as tall as its content),
// so more results stay visible under it. More is an accordion: "Find a filter" first, then one row per kind of niche
// filter; one kind is open at a time with its filters as real controls in two columns, the others stay one line with
// their set values. Phones: V's sheet with the segments as tabs.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import type { TitleKey } from "~/utils/title-key"
import { type ProtoDiscover, useFilterPieces } from "../kit"
import { MoreAccordion, firstGroup } from "./R4-10-more"
import {
	CountryLine,
	GenreControl,
	GridUnder,
	NotSeenControl,
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
} from "./R4-10-parts"
import { CurrentSearch, FindInFilters, SearchExamples, SearchRun, TitleMatches, likeTitle } from "./R4-10-search"

export const NAME = "Compact V, accordion More"

/** Each segment's panel height (footer included): V's was 500 for all. */
const HEIGHT: Record<SegKey, number> = { search: 290, mood: 330, streaming: 290, watched: 290, more: 560 }
const SHAPE = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const }
const SHADOW = "0 30px 80px -20px rgba(0,0,0,.95), 0 0 0 1px rgba(255,255,255,0.09)"
const COL = "min-h-0 overflow-y-auto overscroll-contain px-6 py-4"

interface SearchCtx {
	text: string
	typing: boolean
	onRun: (t: string) => void
	onLike: (k: TitleKey) => void
	onFind: (t: string) => void
	input?: ReactNode
}
interface MoreCtx {
	open: string
	onOpen: (kind: string) => void
	find: string
	onFind: (t: string) => void
}

// ---------------------------------------------------------------------------------------------------------------
// Each segment's layout. `phone` stacks the columns.

function SearchLayout({ d, s, phone }: { d: ProtoDiscover; s: SearchCtx; phone: boolean }) {
	const left = (
		<div className="flex flex-col gap-3">
			{s.typing ? (
				<>
					<SearchRun text={s.text} onRun={s.onRun} />
					<div>
						<FindInFilters text={s.text} onFind={s.onFind} />
					</div>
				</>
			) : (
				<>
					<CurrentSearch d={d} />
					<SearchExamples onRun={s.onRun} onLike={s.onLike} />
				</>
			)}
		</div>
	)
	const right = s.typing ? <TitleMatches d={d} text={s.text} onRun={s.onRun} onLike={s.onLike} /> : <TagChips d={d} group="moods" />
	if (phone)
		return (
			<div className="flex flex-col gap-5">
				{s.input && (
					<div className="flex h-14 items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)]">
						<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
						{s.input}
					</div>
				)}
				{left}
				{right}
			</div>
		)
	return (
		<div className="grid h-full min-h-0 grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
			<div className={`${COL} border-r border-white/[0.06]`}>{left}</div>
			<div className={COL}>{right}</div>
		</div>
	)
}

function MoodLayout({ d, phone }: { d: ProtoDiscover; phone: boolean }) {
	if (phone)
		return (
			<div className="flex flex-col gap-6">
				<TagChips d={d} group="moods" big />
				<TypeControl d={d} />
				<GenreControl d={d} limit={10} />
			</div>
		)
	return (
		<div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<div className={`${COL} border-r border-white/[0.06]`}>
				<TagChips d={d} group="moods" />
			</div>
			<div className={`${COL} flex flex-col gap-4`}>
				<TypeControl d={d} />
				<GenreControl d={d} limit={12} />
			</div>
		</div>
	)
}

function StreamingLayout({ d, pieces, phone }: { d: ProtoDiscover; pieces: Pieces; phone: boolean }) {
	return (
		<div className={phone ? "" : `h-full ${COL}`}>
			<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
				<div className="w-full max-w-md">
					<StreamingModes d={d} pieces={pieces} />
				</div>
				<CountryLine d={d} pieces={pieces} />
			</div>
			<div className="mt-4">
				<ServiceLogos d={d} pieces={pieces} layout="grid" limit={12} />
			</div>
		</div>
	)
}

function Tile({ children }: { children: ReactNode }) {
	return <div className="rounded-2xl bg-white/[0.03] px-4 py-3.5 ring-1 ring-white/[0.06]">{children}</div>
}

function WatchedLayout({ d, pieces, phone }: { d: ProtoDiscover; pieces: Pieces; phone: boolean }) {
	return (
		<div
			className={
				phone
					? "flex flex-col gap-3"
					: `grid h-full auto-rows-min grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-3 ${COL}`
			}
		>
			<Tile>
				<h4 className="mb-2.5 text-[14px] font-semibold text-gray-100">Seen</h4>
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

function Layout({
	seg,
	d,
	pieces,
	phone,
	search,
	more,
}: { seg: SegKey; d: ProtoDiscover; pieces: Pieces; phone: boolean; search: SearchCtx; more: MoreCtx }) {
	switch (seg) {
		case "search":
			return <SearchLayout d={d} s={search} phone={phone} />
		case "mood":
			return <MoodLayout d={d} phone={phone} />
		case "streaming":
			return <StreamingLayout d={d} pieces={pieces} phone={phone} />
		case "watched":
			return <WatchedLayout d={d} pieces={pieces} phone={phone} />
		case "more":
			return <MoreAccordion d={d} pieces={pieces} phone={phone} {...more} />
	}
}

/** V's footer, lower: Clear all, what's hidden, Show N. */
function Footer({ d, pieces, onDone }: { d: ProtoDiscover; pieces: Pieces; onDone: () => void }) {
	const clearAll = useClearAll(d)
	const n = pieces.secondaryCount + (d.q ? 1 : 0)
	return (
		<div className="flex shrink-0 items-center gap-4 border-t border-white/[0.06] bg-gray-950/85 px-5 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] lg:pb-2">
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
			<ShowTitlesButton counts={d.counts} onClick={onDone} className="ml-auto h-10 min-w-44 max-sm:h-11 max-sm:flex-1" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Shared segment state

function useSegs(d: ProtoDiscover, pieces: Pieces) {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [text, setText] = useState("")
	const [group, setGroup] = useState<string | null>(null)
	const [find, setFind] = useState("")
	const go = (k: SegKey | null) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		if (k === "search" && seg !== "search") setText(d.q ?? "")
		setSeg(k)
	}
	const typed = text.trim()
	const more: MoreCtx = { open: group ?? firstGroup(pieces), onOpen: setGroup, find, onFind: setFind }
	const search = (close: () => void, input?: ReactNode): SearchCtx => ({
		text: typed,
		typing: typed !== "" && typed !== d.q,
		onRun: (t) => {
			d.setQ(t || null)
			close()
		},
		onLike: (k) => {
			likeTitle(d, k)
			close()
		},
		onFind: (t) => {
			setFind(t)
			go("more")
		},
		input,
	})
	return { seg, dir, go, text, setText, typed, more, search }
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function useViewportHeight() {
	const [h, setH] = useState(900)
	useEffect(() => {
		const on = () => setH(window.innerHeight)
		on()
		window.addEventListener("resize", on)
		return () => window.removeEventListener("resize", on)
	}, [])
	return h
}

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const values = segValues(d, pieces)
	const s = useSegs(d, pieces)
	const { seg, dir, go, typed } = s
	const panel = useRef<HTMLDivElement>(null)
	const vh = useViewportHeight()
	const open = seg !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const close = useCallback(() => go(null), [go])
	useOutsideClose(open, close, panel)
	const pick = (k: SegKey) => (k === seg && k !== "search" ? close() : go(k))
	useSlashKey(() => go("search"))
	const search = s.search(close)
	const run = search.onRun
	// Search grows while typing (four titles) and with a search set (its Read as).
	const want = seg === "search" ? (search.typing ? 360 : d.q ? 340 : HEIGHT.search) : seg ? HEIGHT[seg] : 300
	const h = Math.min(want, Math.max(240, vh - 190))
	return (
		<div className="hidden lg:block">
			<div className="relative mt-4">
				<SegmentBar
					id="r410"
					values={values}
					active={seg}
					onPick={pick}
					onClearSearch={() => d.setQ(null)}
					searchInput={
						seg === "search" ? (
							<SearchInput value={s.text} onChange={s.setText} onEnter={() => (typed ? run(typed) : close())} onEscape={close} />
						) : undefined
					}
				/>
				<AnimatePresence>
					{seg && (
						<motion.div
							ref={panel}
							role="dialog"
							aria-label={SEG_LABEL[seg]}
							layout
							initial={{ opacity: 0, y: -8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -6, transition: { duration: 0.14 } }}
							transition={{ layout: SHAPE, duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
							style={{ height: h, borderRadius: 20, boxShadow: SHADOW, transformOrigin: "top center" }}
							className="absolute inset-x-0 top-[64px] z-40 overflow-clip bg-[#0b1120]"
						>
							<motion.div layout transition={{ layout: SHAPE }} className="absolute inset-0 flex flex-col">
								<div className="relative min-h-0 flex-1 overflow-clip">
									<AnimatePresence initial={false} custom={dir}>
										<motion.div
											key={seg}
											initial={{ opacity: 0, x: dir * 28 }}
											animate={{ opacity: 1, x: 0, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
											exit={{ opacity: 0, x: dir * -28, transition: { duration: 0.12 } }}
											style={{ height: h - 57 }}
											className="absolute inset-x-0 top-0"
										>
											<Layout seg={seg} d={d} pieces={pieces} phone={false} search={search} more={s.more} />
										</motion.div>
									</AnimatePresence>
								</div>
								<Footer d={d} pieces={pieces} onDone={close} />
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={pick} className="mt-2" />
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
						className={`relative flex h-10 min-w-0 flex-1 items-center justify-center rounded-full px-1.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "text-gray-950" : "text-gray-300"}`}
					>
						{on && (
							<motion.span layoutId="r410-tab" transition={{ type: "spring", stiffness: 520, damping: 42 }} className="absolute inset-0 rounded-full bg-white" />
						)}
						<span className="relative flex items-center gap-1">
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
	const s = useSegs(d, pieces)
	const [last, setLast] = useState<SegKey>("mood")
	const shown = s.seg ?? last
	const openAt = (k: SegKey) => {
		setLast(k)
		s.go(k)
	}
	const close = () => s.go(null)
	const search = s.search(close)
	search.typing = shown === "search" && search.typing
	search.onFind = (t) => {
		s.more.onFind(t)
		openAt("more")
	}
	search.input = (
		<SearchInput
			value={s.text}
			onChange={s.setText}
			onEnter={() => (s.typed ? search.onRun(s.typed) : close())}
			size="md"
			autoFocus={false}
		/>
	)
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar values={values} onPick={openAt} onClearSearch={() => d.setQ(null)} />
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={openAt} className="mt-2" />
			<SnapSheet
				index={s.seg ? 0 : -1}
				onIndex={(i) => i < 0 && close()}
				snaps={[0.94]}
				label="Filters"
				header={<Tabs seg={shown} onPick={openAt} values={values} />}
				footer={<Footer d={d} pieces={pieces} onDone={close} />}
			>
				<div className="relative overflow-hidden px-5 pt-3 pb-8">
					<AnimatePresence initial={false} custom={s.dir} mode="popLayout">
						<motion.div
							key={shown}
							initial={{ opacity: 0, x: s.dir * 28 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: s.dir * -28 }}
							transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
						>
							<Layout seg={shown} d={d} pieces={pieces} phone search={search} more={s.more} />
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantR4_10({ d }: { d: ProtoDiscover }) {
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
