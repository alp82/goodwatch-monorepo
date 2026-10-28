// PROTOTYPE - throwaway. Round 5 variant 20, "Drill-down path": round 4's variant 8 (bar, status line, fixed-height
// panel, phone sheet) with four tabs and no More. Each tab opens on its home: the most used controls on the left and
// its sub-categories as tiles with live values on the right. A tile replaces the panel with that sub-category, and
// a path row on top reads "Watched › Scores" with a back step. No second row of tabs.
//   Search: Describe a mood, Find a title, Similar to, Cast and crew
//   Mood: Mood, About, Style, Genre and type
//   Streaming: Services (+ country line), Length, Age and content, Production country
//   Watched: Seen (Not seen yet, Loved, Disliked), Scores (score, by source, critics vs audiences, taste match), Released
// The bar's Search segment is the search field from every tab; the path row's field is Find a filter on every tab
// (matches from every filter, plus "Search: <text>"). Phones: the stacked bar card and a sheet with the four tabs,
// path and Find a filter on top, home or sub-category below.
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { type ProtoDiscover, useFilterPieces } from "../kit"
import {
	GridUnder,
	PageTitle,
	PhoneBar,
	type Pieces,
	SEG_LABEL,
	SEG_ORDER,
	SearchInput,
	type SegKey,
	SegmentBar,
	StatusLine,
	type SubId,
	WarmCards,
	segValues,
	subOf,
	subsFor,
	useClearAll,
	useKeepTop,
	useOutsideClose,
	useScrollTopOn,
	useSlashKey,
} from "./R5-20-parts"
import { FindView, Home, PathRow, type SearchCtx, SubView, useSearchCtx } from "./R5-20-views"

export const NAME = "Drill-down path"

const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

// ---------------------------------------------------------------------------------------------------------------
// Where the panel is: tab, sub-category (null = the tab's home), and the Find a filter text.

function useNav(pieces: Pieces) {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [sub, setSub] = useState<SubId | null>(null)
	const [dir, setDir] = useState(1)
	const [find, setFindRaw] = useState("")
	const go = (k: SegKey | null, to: SubId | null = null) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) > SEG_ORDER.indexOf(seg) ? 1 : SEG_ORDER.indexOf(k) < SEG_ORDER.indexOf(seg) ? -1 : to ? 1 : -1)
		else setDir(1)
		setFindRaw("")
		setSeg(k)
		setSub(k && to && subsFor(pieces, k).some((s) => s.id === to) ? to : null)
	}
	const drill = (id: SubId) => {
		setDir(1)
		setFindRaw("")
		setSub(id)
	}
	const home = () => {
		setDir(-1)
		setFindRaw("")
		setSub(null)
	}
	const setFind = (t: string) => {
		setDir(1)
		setFindRaw(t)
	}
	/** One step back: out of Find a filter, else up to the tab's home. False when already home. */
	const back = () => {
		if (find.trim()) {
			setDir(-1)
			setFindRaw("")
			return true
		}
		if (sub) {
			home()
			return true
		}
		return false
	}
	return { seg, sub, dir, find, go, drill, home, back, setFind }
}

type Nav = ReturnType<typeof useNav>

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

/** The panel's content for the current place: Find a filter results, a sub-category, or the tab's home. */
function Body({
	d,
	pieces,
	seg,
	nav,
	phone,
	search,
	onRun,
}: {
	d: ProtoDiscover
	pieces: Pieces
	seg: SegKey
	nav: Nav
	phone: boolean
	search: SearchCtx
	onRun: (t: string) => void
}) {
	if (nav.find.trim()) return <FindView pieces={pieces} text={nav.find} phone={phone} onRun={onRun} />
	if (nav.sub) return <SubView d={d} pieces={pieces} seg={seg} sub={nav.sub} phone={phone} search={search} />
	return <Home d={d} pieces={pieces} seg={seg} onOpen={nav.drill} phone={phone} search={search} />
}

const placeKey = (seg: SegKey, nav: Nav) => `${seg}/${nav.find.trim() ? "find" : (nav.sub ?? "home")}`

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const values = segValues(d, pieces)
	const nav = useNav(pieces)
	const { seg } = nav
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const open = seg !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const close = () => nav.go(null)
	useOutsideClose(open, close, panel, "[data-seg-bar]", () => {
		if (!nav.back()) close()
	})
	const pick = (k: SegKey, sub?: SubId) => {
		if (k === "search") setText(d.q ?? "")
		nav.go(k, sub ?? null)
	}
	useSlashKey(() => pick("search"))
	const typed = text.trim()
	const typing = seg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		nav.go(null)
	}
	const fill = (t: string) => {
		setText(t)
		field.current?.focus()
	}
	const search = useSearchCtx(d, text, typing, run, fill)
	const scroller = useRef<HTMLDivElement>(null)
	const key = seg ? placeKey(seg, nav) : "closed"
	useKeepTop(scroller, key)
	const isHome = seg !== null && !nav.sub && !nav.find.trim()
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="r520"
					values={values}
					active={seg}
					onPick={(k) => pick(k)}
					onClearSearch={() => d.setQ(null)}
					searchInput={
						seg === "search" ? (
							<SearchInput
								value={text}
								onChange={setText}
								inputRef={field}
								onEnter={() => (typed ? run(typed) : close())}
								onEscape={() => {
									if (!nav.back()) close()
								}}
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
							className="absolute inset-x-0 top-[calc(76px+10px)] z-40 flex h-[min(560px,calc(100vh-220px))] flex-col overflow-hidden rounded-[24px] bg-[#0b1120] shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,0.09)]"
						>
							<PathRow
								seg={seg}
								sub={subOf(seg, nav.sub)}
								find={nav.find}
								onFind={nav.setFind}
								onHome={nav.home}
								onBack={nav.back}
								phone={false}
							/>
							<div className="relative min-h-0 flex-1 overflow-hidden">
								<AnimatePresence initial={false} custom={nav.dir}>
									<motion.div
										key={key}
										custom={nav.dir}
										variants={MORPH}
										initial="enter"
										animate="center"
										exit="exit"
										transition={MORPH_T}
										className="absolute inset-0"
									>
										{isHome ? (
											<Body d={d} pieces={pieces} seg={seg} nav={nav} phone={false} search={search} onRun={run} />
										) : (
											<div ref={scroller} className="h-full overflow-y-auto overscroll-contain px-7 py-5">
												<Body d={d} pieces={pieces} seg={seg} nav={nav} phone={false} search={search} onRun={run} />
											</div>
										)}
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
								layoutId="r520-tab"
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
	const nav = useNav(pieces)
	const [last, setLast] = useState<SegKey>("mood")
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const shownSeg = nav.seg ?? last
	const openAt = (k: SegKey, sub?: SubId) => {
		if (k === "search") setText(d.q ?? "")
		setLast(k)
		nav.go(k, sub ?? null)
	}
	const typed = text.trim()
	const typing = shownSeg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		nav.go(null)
	}
	const fill = (t: string) => {
		setText(t)
		field.current?.focus()
	}
	const input: ReactNode = (
		<div className="flex h-14 items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)]">
			<SearchInput
				value={text}
				onChange={setText}
				inputRef={field}
				onEnter={() => (typed ? run(typed) : nav.go(null))}
				size="md"
				autoFocus={false}
			/>
		</div>
	)
	const search = { ...useSearchCtx(d, text, typing, run, fill), input }
	const body = useRef<HTMLDivElement>(null)
	const key = placeKey(shownSeg, nav)
	useScrollTopOn(body, key)
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar values={values} onPick={(k) => openAt(k)} onClearSearch={() => d.setQ(null)} />
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={openAt} className="mt-2" />
			<SnapSheet
				index={nav.seg ? 0 : -1}
				onIndex={(i) => i < 0 && nav.go(null)}
				snaps={[0.94]}
				label="Filters"
				header={
					<div>
						<Tabs seg={shownSeg} onPick={(k) => openAt(k)} values={values} />
						<PathRow
							seg={shownSeg}
							sub={subOf(shownSeg, nav.sub)}
							find={nav.find}
							onFind={nav.setFind}
							onHome={nav.home}
							onBack={nav.back}
							phone
						/>
					</div>
				}
				footer={<Footer d={d} pieces={pieces} onDone={() => nav.go(null)} />}
			>
				<div ref={body} className="relative overflow-hidden px-5 pt-3 pb-8">
					<AnimatePresence initial={false} custom={nav.dir} mode="popLayout">
						<motion.div key={key} custom={nav.dir} variants={MORPH} initial="enter" animate="center" exit="exit" transition={MORPH_T}>
							<Body d={d} pieces={pieces} seg={shownSeg} nav={nav} phone search={search} onRun={run} />
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantR5_20({ d }: { d: ProtoDiscover }) {
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
