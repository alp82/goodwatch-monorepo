// PROTOTYPE - throwaway. Round 5 variant 11, "Four tabs, by topic": variant 8 without More. The bar keeps Search, Mood,
// Streaming and Watched; each tab's panel has one row of sub-tabs, and More's filters moved to where they belong:
// - Search: Mood or title (8's three lanes), Cast and crew, Find a filter.
// - Mood: Mood, About, Style, Genre (with Movies or shows); a "Your mix" column stays beside every sub-tab.
// - Streaming: Services, Length, Age and content, Made in.
// - Watched: Seen (Not seen yet, Loved, Disliked), Scores (score, taste match, by source, critics vs audiences), Released.
// Search across tabs: the bar's Search segment is there on every tab, typing on any tab jumps into it, and every tab's
// sub-tab row has "Find a filter", which is Search's third sub-tab (the same field, matched against every filter).
// Phones: 8's stacked bar card and sheet; the sheet header holds the tabs and the sub-tab row.
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { type ProtoDiscover, useFilterPieces } from "../kit"
import {
	GridUnder,
	PageTitle,
	PhoneBar,
	type Pieces,
	type Place,
	SEG_LABEL,
	SEG_ORDER,
	SearchInput,
	type SegKey,
	SegmentBar,
	StatusLine,
	WarmCards,
	firstSub,
	segValues,
	useClearAll,
	useOutsideClose,
	useScrollTopOn,
	useSlashKey,
} from "./R5-11-parts"
import { FindButton, MoodTab, type SearchProps, SearchTab, StreamingTab, SubTabRow, WatchedTab } from "./R5-11-tabs"

export const NAME = "Four tabs, by topic"

const FIND_PLACEHOLDER = "Find a filter: horror, a title, a name"

const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

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

/** The open tab's content for its sub-tab. Mood keeps its mix column steady; the others fade between sub-tabs. */
function TabBody({
	seg,
	sub,
	d,
	pieces,
	phone,
	search,
	onSub,
}: {
	seg: SegKey
	sub: string
	d: ProtoDiscover
	pieces: Pieces
	phone: boolean
	search: SearchProps
	onSub: (s: string) => void
}) {
	if (seg === "mood") return <MoodTab d={d} pieces={pieces} sub={sub} phone={phone} onSub={onSub} />
	const inner =
		seg === "search" ? (
			<SearchTab d={d} pieces={pieces} sub={sub} phone={phone} search={search} />
		) : seg === "streaming" ? (
			<StreamingTab d={d} pieces={pieces} sub={sub} phone={phone} />
		) : (
			<WatchedTab d={d} pieces={pieces} sub={sub} phone={phone} />
		)
	return (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={sub}
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.14 }}
				className={phone ? "" : "h-full min-h-0"}
			>
				{inner}
			</motion.div>
		</AnimatePresence>
	)
}

/** Which tab is open, and the sub-tab each tab is on (remembered per tab; a tab first opens where something is set). */
function useTabs(d: ProtoDiscover, pieces: Pieces) {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [subs, setSubs] = useState<Partial<Record<SegKey, string>>>({})
	const subOf = (k: SegKey) => subs[k] ?? firstSub(d, pieces, k)
	const go = (k: SegKey | null, sub?: string) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		if (k) setSubs((s) => ({ ...s, [k]: sub ?? s[k] ?? firstSub(d, pieces, k) }))
		setSeg(k)
	}
	const setSub = (sub: string) => seg && setSubs((s) => ({ ...s, [seg]: sub }))
	return { seg, dir, go, subOf, setSub }
}

/** Typing on a tab other than Search jumps into the search field with that letter. */
function useTypeToSearch(on: boolean, onType: (ch: string) => void) {
	const latest = useRef(onType)
	latest.current = onType
	useEffect(() => {
		if (!on) return
		const onKey = (e: KeyboardEvent) => {
			if (e.key.length !== 1 || e.key === " " || e.metaKey || e.ctrlKey || e.altKey) return
			if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return
			e.preventDefault()
			latest.current(e.key)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [on])
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const values = segValues(d, pieces)
	const { seg, dir, go, subOf, setSub } = useTabs(d, pieces)
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const open = seg !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const close = () => go(null)
	useOutsideClose(open, close, panel)
	const pick = (k: SegKey, sub?: string) => {
		if (k === "search" && seg !== "search") setText(sub === "find" ? "" : (d.q ?? ""))
		go(k, sub)
	}
	useSlashKey(() => pick("search"))
	useTypeToSearch(open && seg !== "search", (ch) => {
		setText(ch)
		go("search")
	})
	const sub = seg ? subOf(seg) : ""
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
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="v11"
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
								placeholder={sub === "find" ? FIND_PLACEHOLDER : undefined}
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
										className="absolute inset-0 flex flex-col"
									>
										<SubTabRow
											id={`d11-${seg}`}
											d={d}
											pieces={pieces}
											seg={seg}
											sub={subOf(seg)}
											onPick={(s) => {
												setSub(s)
												if (seg === "search") field.current?.focus()
											}}
											right={seg !== "search" ? <FindButton phone={false} onClick={() => pick("search", "find")} /> : undefined}
											phone={false}
										/>
										<div className="min-h-0 flex-1">
											<TabBody
												seg={seg}
												sub={subOf(seg)}
												d={d}
												pieces={pieces}
												phone={false}
												search={{ text, typing, onRun: run, onFill: fill }}
												onSub={setSub}
											/>
										</div>
									</motion.div>
								</AnimatePresence>
							</div>
							<Footer d={d} pieces={pieces} onDone={close} />
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={(p: Place) => pick(p.seg, p.sub)} className="mt-3" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones

function Tabs({ seg, onPick, values }: { seg: SegKey; onPick: (k: SegKey) => void; values: ReturnType<typeof segValues> }) {
	return (
		<div role="tablist" aria-label="Filters" className="flex gap-0.5 px-2 pt-1 pb-1">
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
								layoutId="v11-tab"
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
	const { seg, dir, go, subOf, setSub } = useTabs(d, pieces)
	const [last, setLast] = useState<SegKey>("mood")
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const shownSeg = seg ?? last
	const sub = subOf(shownSeg)
	const openAt = (k: SegKey, s?: string) => {
		if (k === "search" && shownSeg !== "search") setText(s === "find" ? "" : (d.q ?? ""))
		setLast(k)
		go(k, s)
	}
	const typed = text.trim()
	const typing = shownSeg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	const body = useRef<HTMLDivElement>(null)
	useScrollTopOn(body, `${shownSeg}|${sub}|${typed && sub === "find" ? "find" : ""}`)
	const input = (
		<SearchInput
			value={text}
			onChange={setText}
			inputRef={field}
			placeholder={sub === "find" ? FIND_PLACEHOLDER : undefined}
			onEnter={() => (typed ? run(typed) : go(null))}
			size="md"
			autoFocus={false}
		/>
	)
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar values={values} onPick={(k) => openAt(k)} onClearSearch={() => d.setQ(null)} />
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={(p) => openAt(p.seg, p.sub)} className="mt-2" />
			<SnapSheet
				index={seg ? 0 : -1}
				onIndex={(i) => i < 0 && go(null)}
				snaps={[0.94]}
				label="Filters"
				header={
					<div>
						<Tabs seg={shownSeg} onPick={(k) => openAt(k)} values={values} />
						<SubTabRow
							id={`p11-${shownSeg}`}
							d={d}
							pieces={pieces}
							seg={shownSeg}
							sub={sub}
							onPick={setSub}
							right={shownSeg !== "search" ? <FindButton phone onClick={() => openAt("search", "find")} /> : undefined}
							phone
						/>
					</div>
				}
				footer={<Footer d={d} pieces={pieces} onDone={() => go(null)} />}
			>
				<div ref={body} className="relative overflow-hidden px-5 pt-4 pb-8">
					<AnimatePresence initial={false} custom={dir} mode="popLayout">
						<motion.div key={shownSeg} custom={dir} variants={MORPH} initial="enter" animate="center" exit="exit" transition={MORPH_T}>
							<TabBody
								seg={shownSeg}
								sub={sub}
								d={d}
								pieces={pieces}
								phone
								onSub={setSub}
								search={{
									text,
									typing,
									onRun: run,
									onFill: (t) => {
										setText(t)
										field.current?.focus()
									},
									input: sub === "people" ? undefined : input,
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

export function VariantR5_11({ d }: { d: ProtoDiscover }) {
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
