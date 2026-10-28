// PROTOTYPE - throwaway. Round 5 variant 16, "Three deep tabs": 8's bar with only three segments, so Search gets the
// room. Search (Moods and titles, Cast and crew, Loved and disliked), Mood (Mood, About, Style, Genre and type, Length),
// Watch (Services and seen, Scores, Released, Origin and age). One row of sub-tabs per tab, each with a count once set.
// The search field stays live in the bar on every tab: typing there jumps to Search's lanes. Find a filter sits at the
// end of the sub-tab row on Mood and Watch. Phones: the stacked bar card and one sheet, tabs and sub-tabs in its header.
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
	SEG_LABEL,
	SEG_ORDER,
	SearchInput,
	type SegKey,
	SegmentBar,
	type Slot,
	StatusLine,
	WarmCards,
	segValues,
	subCount,
	subsFor,
	useClearAll,
	useOutsideClose,
	useScrollTopOn,
	useSlashKey,
	whereIs,
} from "./R5-16-parts"
import { SubTabs, TabPanel } from "./R5-16-tabs"

export const NAME = "Three deep tabs"

const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

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

/** Which tab is open, the sub-tab each tab is on, and Find a filter's text. */
function useTabState() {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [subs, setSubs] = useState<Record<SegKey, string>>({ search: "find", mood: "mood", watch: "where" })
	const [find, setFind] = useState("")
	const go = (k: SegKey | null) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		if (k !== seg) setFind("")
		setSeg(k)
	}
	const setSub = (k: SegKey, id: string) => setSubs((s) => ({ ...s, [k]: id }))
	const goTo = (slot: Slot) => {
		const w = whereIs(slot)
		setSub(w.seg, w.sub)
		go(w.seg)
	}
	return { seg, dir, go, goTo, subs, setSub, find, setFind }
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const values = segValues(d, pieces)
	const t = useTabState()
	const { seg } = t
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const open = seg !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const close = () => t.go(null)
	useOutsideClose(open, close, panel)
	const pick = (k: SegKey) => {
		if (!open) setText(d.q ?? "")
		t.go(k)
	}
	const goTo = (slot: Slot) => {
		if (!open) setText(d.q ?? "")
		t.goTo(slot)
	}
	useEffect(() => {
		if (seg === "search") field.current?.focus()
	}, [seg])
	useSlashKey(() => pick("search"))
	const typed = text.trim()
	const typing = seg === "search" && t.subs.search === "find" && typed !== "" && typed !== d.q
	const run = (q: string) => {
		d.setQ(q || null)
		t.go(null)
	}
	const fill = (q: string) => {
		setText(q)
		field.current?.focus()
	}
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="v16"
					values={values}
					active={seg}
					onPick={pick}
					onClearSearch={() => d.setQ(null)}
					searchInput={
						open ? (
							<SearchInput
								value={text}
								onChange={(v) => {
									setText(v)
									t.setSub("search", "find")
									if (seg !== "search") t.go("search")
								}}
								onFocus={() => seg !== "search" && t.go("search")}
								inputRef={field}
								autoFocus={false}
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
								<AnimatePresence initial={false} custom={t.dir}>
									<motion.div
										key={seg}
										custom={t.dir}
										variants={MORPH}
										initial="enter"
										animate="center"
										exit="exit"
										transition={MORPH_T}
										className="absolute inset-0"
									>
										<TabPanel
											id="d16"
											seg={seg}
											subs={subsFor(seg, pieces)}
											sub={t.subs[seg]}
											onSub={(id) => t.setSub(seg, id)}
											d={d}
											pieces={pieces}
											phone={false}
											search={{ text, typing, onRun: run, onFill: fill }}
											find={t.find}
											onFind={t.setFind}
										/>
									</motion.div>
								</AnimatePresence>
							</div>
							<Footer d={d} pieces={pieces} onDone={close} />
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={goTo} className="mt-3" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones

function Tabs({ d, pieces, seg, onPick }: { d: ProtoDiscover; pieces: Pieces; seg: SegKey; onPick: (k: SegKey) => void }) {
	return (
		<div role="tablist" aria-label="Filters" className="flex gap-0.5 px-2 pt-1 pb-1">
			{SEG_ORDER.map((k) => {
				const on = seg === k
				const n = subsFor(k, pieces).reduce((a, s) => a + subCount(d, pieces, s), 0)
				return (
					<motion.button
						key={k}
						type="button"
						role="tab"
						aria-selected={on}
						whileTap={TAP}
						onClick={() => onPick(k)}
						className={`relative flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 text-[14px] font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "text-gray-950" : "text-gray-300"}`}
					>
						{on && (
							<motion.span
								layoutId="v16-tab"
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-0 rounded-full bg-white"
							/>
						)}
						<span className="relative flex items-center gap-1.5">
							{SEG_LABEL[k]}
							{n > 0 && (
								<span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] text-gray-950">
									{n}
								</span>
							)}
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

function Phone({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const values = segValues(d, pieces)
	const t = useTabState()
	const [last, setLast] = useState<SegKey>("mood")
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const shown = t.seg ?? last
	const subs = subsFor(shown, pieces)
	const sub = t.subs[shown]
	const openAt = (k: SegKey) => {
		if (k === "search") setText(d.q ?? "")
		setLast(k)
		t.go(k)
	}
	const goTo = (slot: Slot) => {
		const w = whereIs(slot)
		if (w.seg === "search") setText(d.q ?? "")
		setLast(w.seg)
		t.goTo(slot)
	}
	const typed = text.trim()
	const typing = shown === "search" && typed !== "" && typed !== d.q
	const run = (q: string) => {
		d.setQ(q || null)
		t.go(null)
	}
	const body = useRef<HTMLDivElement>(null)
	useScrollTopOn(body, `${shown}|${sub}|${t.find.trim() ? "find" : ""}`)
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar values={values} onPick={openAt} onClearSearch={() => d.setQ(null)} />
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={goTo} className="mt-2" />
			<SnapSheet
				index={t.seg ? 0 : -1}
				onIndex={(i) => i < 0 && t.go(null)}
				snaps={[0.94]}
				label="Filters"
				header={
					<div>
						<Tabs d={d} pieces={pieces} seg={shown} onPick={openAt} />
						<SubTabs
							id="p16"
							d={d}
							pieces={pieces}
							subs={subs}
							active={sub}
							onSub={(id) => {
								t.setFind("")
								t.setSub(shown, id)
							}}
							dim={t.find.trim() !== ""}
							phone
						/>
					</div>
				}
				footer={<Footer d={d} pieces={pieces} onDone={() => t.go(null)} />}
			>
				<div ref={body} className="relative overflow-hidden px-5 pt-4 pb-8">
					<AnimatePresence initial={false} custom={t.dir} mode="popLayout">
						<motion.div key={shown} custom={t.dir} variants={MORPH} initial="enter" animate="center" exit="exit" transition={MORPH_T}>
							<TabPanel
								id="p16"
								seg={shown}
								subs={subs}
								sub={sub}
								onSub={(id) => t.setSub(shown, id)}
								d={d}
								pieces={pieces}
								phone
								search={{
									text,
									typing,
									onRun: run,
									onFill: (q) => {
										setText(q)
										field.current?.focus()
									},
									input: (
										<SearchInput
											value={text}
											onChange={setText}
											inputRef={field}
											onEnter={() => (typed ? run(typed) : t.go(null))}
											size="md"
											autoFocus={false}
										/>
									),
								}}
								find={t.find}
								onFind={t.setFind}
							/>
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantR5_16({ d }: { d: ProtoDiscover }) {
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
