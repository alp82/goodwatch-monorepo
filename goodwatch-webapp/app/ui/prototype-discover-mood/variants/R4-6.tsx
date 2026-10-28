// PROTOTYPE - throwaway. Round 4 variant 6, "R, one part at a time": R's bar and anchored palette, without the long
// scroll. A tap on a segment opens only that segment's part, in a popover anchored under it and sized to its content
// (narrow for Mood, Streaming and Watched; wider for Search and More). Tapping another segment slides the popover
// over to it and reshapes it (a layout animation, so only transform and opacity move). More keeps R's two columns,
// split by sub-tabs per kind, with "Find a filter" in its top row. Phones: V's sheet with the segments as tabs.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { TAP } from "~/ui/filter-bar/motion"
import type { TitleKey } from "~/utils/title-key"
import { type ProtoDiscover, useFilterPieces } from "../kit"
import { MoreBody, firstTab } from "./R4-6-more"
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
	clearSeg,
	segValues,
	useOutsideClose,
	useSlashKey,
} from "./R4-6-parts"
import { CurrentSearch, FindInFilters, SearchExamples, SearchRun, TitleMatches, likeTitle } from "./R4-6-search"

export const NAME = "R, one part at a time"

/** Each part's popover size on desktop: narrow for the common ones, wider for Search and More. */
const SIZE: Record<SegKey, { w: number; h: number }> = {
	search: { w: 700, h: 330 },
	mood: { w: 680, h: 570 },
	streaming: { w: 580, h: 350 },
	watched: { w: 500, h: 490 },
	more: { w: 980, h: 590 },
}
const SHAPE = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }
const SHADOW = "0 30px 80px -20px rgba(0,0,0,.95), 0 0 0 1px rgba(255,255,255,0.09)"

// ---------------------------------------------------------------------------------------------------------------
// The parts

interface SearchCtx {
	text: string
	typing: boolean
	onRun: (t: string) => void
	onLike: (k: TitleKey) => void
	onFind: (t: string) => void
	input?: ReactNode
}
interface MoreCtx {
	tab: string
	onTab: (t: string) => void
	find: string
	onFind: (t: string) => void
}

function SearchPart({ d, s, phone }: { d: ProtoDiscover; s: SearchCtx; phone: boolean }) {
	return (
		<div className="flex flex-col gap-4">
			{s.input && (
				<div className="flex h-14 items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)]">
					<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
					{s.input}
				</div>
			)}
			{s.typing ? (
				<>
					<SearchRun text={s.text} onRun={s.onRun} />
					<TitleMatches d={d} text={s.text} onRun={s.onRun} onLike={s.onLike} />
					<div className={phone ? "" : "-mt-2"}>
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
}

function MoodPart({ d }: { d: ProtoDiscover }) {
	return (
		<div className="flex flex-col gap-6">
			<TagChips d={d} group="moods" big />
			<TypeControl d={d} />
			<GenreControl d={d} limit={10} />
		</div>
	)
}

function StreamingPart({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	return (
		<div className="flex flex-col gap-4">
			<StreamingModes d={d} pieces={pieces} />
			<ServiceLogos d={d} pieces={pieces} layout="chips" limit={12} />
			<CountryLine d={d} pieces={pieces} />
		</div>
	)
}

function WatchedPart({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<h4 className="mb-2.5 text-[14px] font-semibold text-gray-100">Seen</h4>
				<NotSeenControl pieces={pieces} />
			</div>
			<ScoreControl d={d} />
			<ReleasedControl d={d} />
		</div>
	)
}

function PartBody({
	seg,
	d,
	pieces,
	phone,
	search,
	more,
}: { seg: SegKey; d: ProtoDiscover; pieces: Pieces; phone: boolean; search: SearchCtx; more: MoreCtx }) {
	switch (seg) {
		case "search":
			return <SearchPart d={d} s={search} phone={phone} />
		case "mood":
			return <MoodPart d={d} />
		case "streaming":
			return <StreamingPart d={d} pieces={pieces} />
		case "watched":
			return <WatchedPart d={d} pieces={pieces} />
		case "more":
			return <MoreBody d={d} pieces={pieces} phone={phone} {...more} />
	}
}

/** Footer: Clear takes only this part back; Show N closes. */
function PartFooter({ d, pieces, seg, onDone }: { d: ProtoDiscover; pieces: Pieces; seg: SegKey; onDone: () => void }) {
	const values = segValues(d, pieces)
	const set = values[seg].value !== null
	return (
		<footer className="flex shrink-0 items-center gap-4 border-t border-white/[0.07] px-5 py-3">
			<button
				type="button"
				onClick={() => clearSeg(d, pieces, seg)}
				disabled={!set}
				className="rounded-md px-2 py-1 text-sm text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
			>
				{seg === "search" ? "Clear search" : seg === "more" ? "Clear more filters" : `Clear ${SEG_LABEL[seg].toLowerCase()}`}
			</button>
			<ShowTitlesButton counts={d.counts} onClick={onDone} className="ml-auto h-10 min-w-40" />
		</footer>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function useSegLeft(bar: React.RefObject<HTMLDivElement>, open: boolean) {
	const [geom, setGeom] = useState<{ w: number; left: Record<string, number> } | null>(null)
	useLayoutEffect(() => {
		if (!open) return
		const measure = () => {
			const el = bar.current
			if (!el) return
			const box = el.getBoundingClientRect()
			const left: Record<string, number> = {}
			for (const seg of el.querySelectorAll<HTMLElement>("[data-seg]")) left[seg.dataset.seg ?? ""] = seg.getBoundingClientRect().left - box.left
			setGeom({ w: box.width, left })
		}
		measure()
		window.addEventListener("resize", measure)
		return () => window.removeEventListener("resize", measure)
	}, [bar, open])
	return geom
}

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
	const bar = useRef<HTMLDivElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [text, setText] = useState("")
	const [tab, setTab] = useState<string | null>(null)
	const [find, setFind] = useState("")
	const open = seg !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const geom = useSegLeft(bar, open)
	const vh = useViewportHeight()
	const close = useCallback(() => setSeg(null), [])
	useOutsideClose(open, close, panel)
	const go = (k: SegKey) => {
		if (k === seg && k !== "search") return close()
		if (seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		if (k === "search") setText(d.q ?? "")
		if (k === "more" && seg !== "more" && !find) setTab(null)
		setSeg(k)
	}
	useSlashKey(() => go("search"))
	const typed = text.trim()
	const typing = seg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		close()
	}
	const search: SearchCtx = {
		text: typed,
		typing,
		onRun: run,
		onLike: (k) => {
			likeTitle(d, k)
			close()
		},
		onFind: (t) => {
			setFind(t)
			setDir(1)
			setSeg("more")
		},
	}
	const more: MoreCtx = { tab: tab ?? firstTab(pieces), onTab: setTab, find, onFind: setFind }
	const size = seg ? SIZE[seg] : SIZE.mood
	// Search grows while typing (the search, four titles, Find in filters) and with a search set (its Read as).
	const searchH = typing ? 500 : d.q ? 420 : SIZE.search.h
	const barW = geom?.w ?? 1376
	const w = Math.min(size.w, barW)
	const h = Math.min(seg === "search" ? searchH : size.h, Math.max(320, vh - 210))
	const x = seg && geom ? Math.max(0, Math.min((geom.left[seg] ?? 0) - 6, barW - w)) : 0
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="r46"
					barRef={bar}
					values={values}
					active={seg}
					onPick={go}
					onClearSearch={() => d.setQ(null)}
					searchInput={
						seg === "search" ? (
							<SearchInput value={text} onChange={setText} onEnter={() => (typed ? run(typed) : close())} onEscape={close} />
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
							style={{ left: x, width: w, height: h, borderRadius: 22, boxShadow: SHADOW }}
							className="absolute top-[86px] z-40 overflow-clip bg-[#0b1120]"
						>
							<motion.div layout transition={{ layout: SHAPE }} className="absolute inset-0">
								<AnimatePresence initial={false} custom={dir}>
									<motion.div
										key={seg}
										custom={dir}
										initial={{ opacity: 0, x: dir * 24 }}
										animate={{ opacity: 1, x: 0, transition: { duration: 0.22, delay: 0.06, ease: [0.22, 1, 0.36, 1] } }}
										exit={{ opacity: 0, x: dir * -24, transition: { duration: 0.12 } }}
										style={{ width: w, height: h }}
										className="absolute top-0 left-0 flex flex-col"
									>
										<div className={`min-h-0 flex-1 ${seg === "more" ? "" : "overflow-y-auto overscroll-contain px-6 pt-5 pb-5"}`}>
											<PartBody seg={seg} d={d} pieces={pieces} phone={false} search={search} more={more} />
										</div>
										<PartFooter d={d} pieces={pieces} seg={seg} onDone={close} />
									</motion.div>
								</AnimatePresence>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={go} className="mt-3" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones: one sheet, the segments as tabs on top, one part at a time.

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
							<motion.span layoutId="r46-tab" transition={{ type: "spring", stiffness: 520, damping: 42 }} className="absolute inset-0 rounded-full bg-white" />
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
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [last, setLast] = useState<SegKey>("mood")
	const [dir, setDir] = useState(1)
	const [text, setText] = useState("")
	const [tab, setTab] = useState<string | null>(null)
	const [find, setFind] = useState("")
	const shown = seg ?? last
	const openAt = (k: SegKey) => {
		if (seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		if (k === "search") setText(d.q ?? "")
		setLast(k)
		setSeg(k)
	}
	const close = () => setSeg(null)
	const typed = text.trim()
	const typing = shown === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		close()
	}
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar values={values} onPick={openAt} onClearSearch={() => d.setQ(null)} />
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={openAt} className="mt-2" />
			<SnapSheet
				index={seg ? 0 : -1}
				onIndex={(i) => i < 0 && close()}
				snaps={[0.94]}
				label="Filters"
				header={<Tabs seg={shown} onPick={openAt} values={values} />}
				footer={<PartFooter d={d} pieces={pieces} seg={shown} onDone={close} />}
			>
				<div className="relative overflow-hidden px-5 pt-3 pb-8">
					<AnimatePresence initial={false} custom={dir} mode="popLayout">
						<motion.div
							key={shown}
							initial={{ opacity: 0, x: dir * 28 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: dir * -28 }}
							transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
						>
							<PartBody
								seg={shown}
								d={d}
								pieces={pieces}
								phone
								search={{
									text: typed,
									typing,
									onRun: run,
									onLike: (k) => {
										likeTitle(d, k)
										close()
									},
									onFind: (t) => {
										setFind(t)
										openAt("more")
									},
									input: (
										<SearchInput value={text} onChange={setText} onEnter={() => (typed ? run(typed) : close())} size="md" autoFocus={false} />
									),
								}}
								more={{ tab: tab ?? firstTab(pieces), onTab: setTab, find, onFind: setFind }}
							/>
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantR4_6({ d }: { d: ProtoDiscover }) {
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
