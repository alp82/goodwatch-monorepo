// PROTOTYPE - throwaway. Round 5 variant 13, "Side list tabs": variant 8's four-segment bar (Search, Mood,
// Streaming, Watched; no More) and fixed-height panel. Inside the panel, each tab's sub-tabs are a short vertical list
// on the left, and the right side is shaped for the open sub-tab (see R5-13-tabs). Above the list, one "Find a filter"
// field works on every tab: typing replaces the right side with "Search for <text>" and matches from every filter.
// The bar's Search segment stays one tap away from every tab. Phones: the stacked bar card and the sheet, with the
// four tabs on top and the sub-tab list as a sideways row.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { FilterGroups, ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { type ProtoDiscover, useFilterPieces } from "../kit"
import {
	GridUnder,
	PRIVATE,
	PageTitle,
	PhoneBar,
	type Pieces,
	SEG_LABEL,
	SEG_ORDER,
	SearchInput,
	type SegKey,
	SegmentBar,
	StatusLine,
	WarmCards,
	firstSub,
	segValues,
	subCount,
	subsFor,
	useClearAll,
	useKeepTop,
	useOutsideClose,
	useScrollTopOn,
	useSlashKey,
} from "./R5-13-parts"
import { type SearchProps, SubContent } from "./R5-13-tabs"

export const NAME = "Side list tabs"

const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

// ---------------------------------------------------------------------------------------------------------------
// State: the open tab, the sub-tab each tab was last on, and the Find a filter text.

function useTabState(d: ProtoDiscover, pieces: Pieces) {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [subs, setSubs] = useState<Partial<Record<SegKey, string>>>({})
	const [find, setFind] = useState("")
	const subOf = (k: SegKey) => {
		const s = subs[k]
		return s && subsFor(pieces, k).some((x) => x.id === s) ? s : firstSub(d, pieces, k)
	}
	const go = (k: SegKey | null, sub?: string) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		if (k && sub) setSubs((m) => ({ ...m, [k]: sub }))
		if (k !== seg) setFind("")
		setSeg(k)
	}
	const setSub = (s: string) => {
		if (!seg) return
		setFind("")
		setSubs((m) => ({ ...m, [seg]: s }))
	}
	return { seg, dir, go, subOf, setSub, find, setFind }
}

// ---------------------------------------------------------------------------------------------------------------
// Find a filter: one field above the sub-tabs, on every tab.

function FindField({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
	return (
		<label
			className={`flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-3 ring-1 ring-white/10 focus-within:ring-amber-500/70 ${className}`}
		>
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
			<input
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => e.key === "Escape" && value && (e.stopPropagation(), onChange(""))}
				aria-label="Find a filter"
				placeholder="Find a filter"
				autoComplete="off"
				className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
			/>
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					aria-label="Clear"
					className="grid h-6 w-6 place-items-center rounded-full text-gray-500 cursor-pointer hover:text-white"
				>
					<XMarkIcon className="h-3.5 w-3.5" />
				</button>
			)}
		</label>
	)
}

/** What Find a filter shows: the text as a search, then matching options of every filter, in columns. */
function FindResults({ pieces, text, phone, onSearch }: { pieces: Pieces; text: string; phone: boolean; onSearch: () => void }) {
	const css = phone
		? ""
		: `.find-all-13 > .flex-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 2rem; row-gap: 1.75rem; align-items: start }`
	return (
		<div>
			<button
				type="button"
				onClick={onSearch}
				className="mb-5 flex h-12 w-full min-w-0 items-center gap-3 rounded-xl bg-amber-400/[0.1] px-4 text-left ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.16] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
				<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search for</span>
				<span className={`brand-header min-w-0 flex-1 truncate text-[18px] text-white ${PRIVATE}`}>{text.trim()}</span>
			</button>
			{css && <style dangerouslySetInnerHTML={{ __html: css }} />}
			<FilterGroups data={pieces.groups} query={text} className="find-all-13" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The sub-tab list: vertical on desktop, a sideways row on phones.

function SubList({
	id,
	d,
	pieces,
	seg,
	sub,
	onSub,
	dim,
	row,
}: {
	id: string
	d: ProtoDiscover
	pieces: Pieces
	seg: SegKey
	sub: string
	onSub: (s: string) => void
	dim: boolean
	row: boolean
}) {
	const subs = subsFor(pieces, seg)
	return (
		<div
			role="tablist"
			aria-label={SEG_LABEL[seg]}
			aria-orientation={row ? "horizontal" : "vertical"}
			className={`${row ? "-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex flex-col gap-0.5"} transition-opacity ${dim ? "opacity-45" : ""}`}
		>
			{subs.map((s) => {
				const on = s.id === sub && !dim
				const n = subCount(d, pieces, s)
				return (
					<motion.button
						key={s.id}
						type="button"
						role="tab"
						aria-selected={on}
						whileTap={TAP}
						onClick={() => onSub(s.id)}
						className={`relative flex shrink-0 items-center gap-2 text-left whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
							row ? "h-9 rounded-full px-3.5 text-[13px] font-semibold" : "h-10 rounded-xl px-3 text-[14px] font-semibold"
						} ${on ? (row ? "text-gray-950" : "text-white") : "text-gray-400 hover:text-gray-100"}`}
					>
						{on && (
							<motion.span
								layoutId={`${id}-sub`}
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className={row ? "absolute inset-0 rounded-full bg-white" : "absolute inset-0 rounded-xl bg-white/[0.08] ring-1 ring-white/10"}
							/>
						)}
						{on && !row && <span aria-hidden className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-amber-400" />}
						<span className="relative min-w-0 flex-1 truncate">{s.label}</span>
						{n > 0 && (
							<span className="relative grid h-[18px] min-w-[18px] place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 tabular-nums">
								{n}
							</span>
						)}
					</motion.button>
				)
			})}
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

/** One tab on desktop: the list on the left, the open sub-tab (or Find a filter's matches) on the right. */
function DesktopTab({
	seg,
	sub,
	d,
	pieces,
	search,
	find,
	onFind,
	onSub,
	onSearchFind,
}: {
	seg: SegKey
	sub: string
	d: ProtoDiscover
	pieces: Pieces
	search: SearchProps
	find: string
	onFind: (t: string) => void
	onSub: (s: string) => void
	onSearchFind: () => void
}) {
	const finding = find.trim() !== ""
	const right = useRef<HTMLDivElement>(null)
	useKeepTop(right, `${seg}|${sub}|${finding ? "find" : ""}`)
	const lanes = seg === "search" && sub === "anything" && !finding
	return (
		<div className="grid h-full min-h-0 grid-cols-[216px_minmax(0,1fr)]">
			<aside className="flex min-h-0 flex-col gap-4 border-r border-white/[0.06] p-3 pt-4">
				<FindField value={find} onChange={onFind} />
				<SubList id={`d13-${seg}`} d={d} pieces={pieces} seg={seg} sub={sub} onSub={onSub} dim={finding} row={false} />
			</aside>
			<div ref={right} className={`relative min-h-0 ${lanes ? "overflow-hidden" : "overflow-y-auto overscroll-contain px-7 py-5"}`}>
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={finding ? "find" : sub}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.14 }}
						className={lanes ? "h-full" : ""}
					>
						{finding ? (
							<FindResults pieces={pieces} text={find} phone={false} onSearch={onSearchFind} />
						) : (
							<SubContent seg={seg} sub={sub} d={d} pieces={pieces} phone={false} search={search} onSub={onSub} />
						)}
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const values = segValues(d, pieces)
	const { seg, dir, go, subOf, setSub, find, setFind } = useTabState(d, pieces)
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const open = seg !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const close = () => go(null)
	useOutsideClose(open, close, panel)
	const pick = (k: SegKey, sub?: string) => {
		if (k === "search") setText(d.q ?? "")
		go(k, sub)
	}
	useSlashKey(() => pick("search", "anything"))
	const typed = text.trim()
	const typing = seg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	const fill = (t: string) => {
		setText(t)
		field.current?.focus()
	}
	const searchFind = () => {
		const t = find.trim()
		setFind("")
		run(t)
	}
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="v13"
					values={values}
					active={seg}
					onPick={(k) => pick(k)}
					onClearSearch={() => d.setQ(null)}
					searchInput={
						seg === "search" ? (
							<SearchInput
								value={text}
								onChange={(v) => {
									setText(v)
									if (subOf("search") !== "anything") setSub("anything")
								}}
								inputRef={field}
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
							className="absolute inset-x-0 top-[calc(76px+10px)] z-40 flex h-[min(540px,calc(100vh-220px))] flex-col overflow-hidden rounded-[24px] bg-[#0b1120] shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,0.09)]"
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
										<DesktopTab
											seg={seg}
											sub={subOf(seg)}
											d={d}
											pieces={pieces}
											search={{ text, typing, onRun: run, onFill: fill }}
											find={find}
											onFind={setFind}
											onSub={setSub}
											onSearchFind={searchFind}
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

function Tabs({ d, pieces, seg, onPick }: { d: ProtoDiscover; pieces: Pieces; seg: SegKey; onPick: (k: SegKey) => void }) {
	const values = segValues(d, pieces)
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
								layoutId="p13-tab"
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
	const { seg, dir, go, subOf, setSub, find, setFind } = useTabState(d, pieces)
	const [last, setLast] = useState<SegKey>("mood")
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const shownSeg = seg ?? last
	const sub = subOf(shownSeg)
	const openAt = (k: SegKey, s?: string) => {
		if (k === "search") setText(d.q ?? "")
		setLast(k)
		go(k, s)
	}
	const typed = text.trim()
	const typing = shownSeg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	const finding = find.trim() !== ""
	const body = useRef<HTMLDivElement>(null)
	useScrollTopOn(body, `${shownSeg}|${sub}|${finding ? "find" : ""}`)
	const search: SearchProps = {
		text,
		typing,
		onRun: run,
		onFill: (t) => {
			setText(t)
			field.current?.focus()
		},
		input: (
			<SearchInput
				value={text}
				onChange={setText}
				inputRef={field}
				onEnter={() => (typed ? run(typed) : go(null))}
				size="md"
				autoFocus={false}
			/>
		),
	}
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar values={values} onPick={(k) => openAt(k)} onClearSearch={() => d.setQ(null)} />
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={openAt} className="mt-2" />
			<SnapSheet
				index={seg ? 0 : -1}
				onIndex={(i) => i < 0 && go(null)}
				snaps={[0.94]}
				label="Filters"
				header={
					<div>
						<Tabs d={d} pieces={pieces} seg={shownSeg} onPick={(k) => openAt(k)} />
						<div className="flex flex-col gap-2.5 px-5 pb-3">
							<FindField value={find} onChange={setFind} />
							<SubList id={`p13-${shownSeg}`} d={d} pieces={pieces} seg={shownSeg} sub={sub} onSub={setSub} dim={finding} row />
						</div>
					</div>
				}
				footer={<Footer d={d} pieces={pieces} onDone={() => go(null)} />}
			>
				<div ref={body} className="relative overflow-hidden px-5 pt-3 pb-8">
					<AnimatePresence initial={false} custom={dir} mode="popLayout">
						<motion.div
							key={finding ? "find" : `${shownSeg}:${sub}`}
							custom={dir}
							variants={MORPH}
							initial="enter"
							animate="center"
							exit="exit"
							transition={MORPH_T}
						>
							{finding ? (
								<FindResults
									pieces={pieces}
									text={find}
									phone
									onSearch={() => {
										const t = find.trim()
										setFind("")
										run(t)
									}}
								/>
							) : (
								<SubContent seg={shownSeg} sub={sub} d={d} pieces={pieces} phone search={search} onSub={setSub} />
							)}
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantR5_13({ d }: { d: ProtoDiscover }) {
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

