// PROTOTYPE - throwaway. Round 5 variant 15, "One field everywhere": R4-8's bar without More. Four tabs (Search, Mood,
// Streaming, Watched), each with one calm row of sub-tabs, so every filter has one home (TABS in R5-15-parts). The
// search field is the bar's first segment and stays a live field on every tab. Typing filters every tab at once:
// Search shows "Search: <text>", titles and people; Mood the matching moods, themes, styles and genres; Streaming the
// matching services and countries; Watched the matching filters. Each tab in the bar reads its match count while
// typing, so the field is also "Find a filter". Enter runs the text as a search from any tab. Phones: V's sheet with
// the field on top, the four tabs, then the sub-tabs.
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { RollingNumber, TAP } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
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
	type SubKey,
	WarmCards,
	segValues,
	useClearAll,
	useOutsideClose,
	useScrollTopOn,
	useSlashKey,
} from "./R5-15-parts"
import { MatchBody, MatchHead, SearchMatches, SubTabs, TabBody, type TabMatches, useMatches } from "./R5-15-tabs"

export const NAME = "One field everywhere"

const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

const FIRST_SUB: Record<SegKey, SubKey> = { search: "find", mood: "mood", streaming: "services", watched: "basics" }

/** Which tab is open, the sub-tab each tab is on, and the search text (the field, shared by every tab). */
function usePanel(d: ProtoDiscover, pieces: Pieces) {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [subs, setSubs] = useState(FIRST_SUB)
	const [text, setText] = useState(d.q ?? "")
	useEffect(() => setText(d.q ?? ""), [d.q])
	const go = (k: SegKey | null, sub?: SubKey) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		if (k && sub) setSubs((s) => ({ ...s, [k]: sub }))
		setSeg(k)
	}
	const typed = text.trim()
	const typing = typed !== "" && typed !== (d.q ?? "")
	const matches = useMatches(d, pieces, typing ? typed : "")
	const run = (t: string) => {
		d.setQ(t || null)
		setText(t)
		go(null)
	}
	/** A filter found by name: drop the text and open its sub-tab. */
	const openAt = (k: SegKey, sub: SubKey) => {
		setText(d.q ?? "")
		go(k, sub)
	}
	return {
		seg,
		dir,
		go,
		sub: (k: SegKey) => subs[k],
		setSub: (k: SegKey, s: SubKey) => setSubs((x) => ({ ...x, [k]: s })),
		text,
		setText,
		typed,
		typing,
		matches,
		run,
		openAt,
	}
}
type Panel = ReturnType<typeof usePanel>

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

/** One tab's panel: the sub-tab row (or, while typing, the match line) and the content under it. */
function TabPanel({
	seg,
	d,
	pieces,
	p,
	phone,
	focusField,
}: { seg: SegKey; d: ProtoDiscover; pieces: Pieces; p: Panel; phone: boolean; focusField: () => void }) {
	const lanes = {
		onRun: p.run,
		onFill: (t: string) => {
			p.setText(t)
			focusField()
		},
	}
	const m: TabMatches = p.matches
	const head = p.typing ? (
		<MatchHead seg={seg} text={p.typed} n={m.counts[seg]} onRun={() => p.run(p.typed)} phone={phone} />
	) : (
		<SubTabs id={phone ? "p15" : "d15"} seg={seg} sub={p.sub(seg)} onSub={(s) => p.setSub(seg, s)} d={d} pieces={pieces} phone={phone} />
	)
	const body = p.typing ? (
		seg === "search" ? (
			<SearchMatches d={d} text={p.text} phone={phone} lanes={lanes} />
		) : (
			<div className={phone ? "" : "h-full min-h-0 overflow-y-auto overscroll-contain"}>
				<MatchBody seg={seg} m={m} d={d} pieces={pieces} phone={phone} onOpen={p.openAt} onTab={(k) => p.go(k)} />
			</div>
		)
	) : (
		<TabBody sub={p.sub(seg)} d={d} pieces={pieces} phone={phone} lanes={lanes} />
	)
	if (phone)
		return (
			<>
				{head}
				<div className="px-5 pb-8">{body}</div>
			</>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			{head}
			<div className="relative min-h-0 flex-1 overflow-hidden">{body}</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const p = usePanel(d, pieces)
	const values = segValues(d, pieces, p.typing ? p.matches.counts : null)
	const field = useRef<HTMLInputElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const open = p.seg !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const close = () => {
		p.setText(d.q ?? "")
		p.go(null)
		field.current?.blur()
	}
	useOutsideClose(open, close, panel)
	useSlashKey(() => field.current?.focus())
	const pick = (k: SegKey, sub?: SubKey) => (p.seg === k && !sub ? close() : p.go(k, sub))
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="v15"
					values={values}
					active={p.seg}
					onPick={(k) => pick(k)}
					onClearSearch={
						p.text
							? () => {
									if (!p.typing && d.q) d.setQ(null)
									p.setText("")
									field.current?.focus()
								}
							: undefined
					}
					searchInput={
						<SearchInput
							value={p.text}
							onChange={(v) => {
								p.setText(v)
								if (!open) p.go("search")
							}}
							inputRef={field}
							onFocus={() => !open && p.go("search")}
							onClick={() => p.seg !== "search" && p.go("search")}
							onEnter={() => (p.typed ? p.run(p.typed) : close())}
							onEscape={close}
						/>
					}
				/>
				<AnimatePresence>
					{open && (
						<motion.div
							ref={panel}
							role="dialog"
							aria-label={SEG_LABEL[p.seg ?? "search"]}
							initial={{ opacity: 0, y: -8, scaleY: 0.97 }}
							animate={{ opacity: 1, y: 0, scaleY: 1 }}
							exit={{ opacity: 0, y: -6, scaleY: 0.98 }}
							transition={MORPH_T}
							style={{ transformOrigin: "top center" }}
							className="absolute inset-x-0 top-[calc(76px+10px)] z-40 flex h-[min(540px,calc(100vh-220px))] flex-col overflow-hidden rounded-[24px] bg-[#0b1120] shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,0.09)]"
						>
							<div className="relative min-h-0 flex-1 overflow-hidden">
								<AnimatePresence initial={false} custom={p.dir}>
									<motion.div
										key={p.seg}
										custom={p.dir}
										variants={MORPH}
										initial="enter"
										animate="center"
										exit="exit"
										transition={MORPH_T}
										className="absolute inset-0"
									>
										{p.seg && (
											<TabPanel seg={p.seg} d={d} pieces={pieces} p={p} phone={false} focusField={() => field.current?.focus()} />
										)}
									</motion.div>
								</AnimatePresence>
							</div>
							<Footer d={d} pieces={pieces} onDone={close} />
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={(k, sub) => p.go(k, sub)} className="mt-3" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones

function Tabs({ seg, onPick, values, typing }: { seg: SegKey; onPick: (k: SegKey) => void; values: ReturnType<typeof segValues>; typing: boolean }) {
	return (
		<div role="tablist" aria-label="Filters" className="flex gap-0.5 px-2 pt-1 pb-1">
			{SEG_ORDER.map((k) => {
				const on = seg === k
				const v = values[k]
				const n = v.matches
				return (
					<motion.button
						key={k}
						type="button"
						role="tab"
						aria-selected={on}
						whileTap={TAP}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => onPick(k)}
						className={`relative flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "text-gray-950" : "text-gray-300"}`}
					>
						{on && (
							<motion.span
								layoutId="v15-tab"
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-0 rounded-full bg-white"
							/>
						)}
						<span className="relative flex items-center gap-1.5">
							{SEG_LABEL[k]}
							{typing ? (
								<span
									className={`grid h-4.5 min-w-4.5 place-items-center rounded-full px-1 text-[11px] tabular-nums ${n ? "bg-amber-400/90 text-gray-950" : on ? "bg-gray-950/10 text-gray-500" : "bg-white/[0.06] text-gray-500"}`}
								>
									{n ?? 0}
								</span>
							) : (
								v.value !== null && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="set" />
							)}
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

function Phone({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const p = usePanel(d, pieces)
	const values = segValues(d, pieces, p.typing ? p.matches.counts : null)
	const [last, setLast] = useState<SegKey>("search")
	const field = useRef<HTMLInputElement>(null)
	const shown = p.seg ?? last
	const openAt = (k: SegKey, sub?: SubKey) => {
		setLast(k)
		p.go(k, sub)
		if (k === "search" && !sub) setTimeout(() => field.current?.focus(), 260)
	}
	const close = () => {
		p.setText(d.q ?? "")
		p.go(null)
	}
	const body = useRef<HTMLDivElement>(null)
	useScrollTopOn(body, `${shown}|${p.sub(shown)}|${p.typing ? "typing" : ""}`)
	const header = (
		<div>
			<div className="px-4 pt-1 pb-2">
				<div className="flex h-12 items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-3.5 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.55)]">
					<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
					<SearchInput
						value={p.text}
						onChange={p.setText}
						inputRef={field}
						onEnter={() => (p.typed ? p.run(p.typed) : close())}
						size="md"
					/>
					{p.text && (
						<button
							type="button"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => {
								if (!p.typing && d.q) d.setQ(null)
								p.setText("")
							}}
							aria-label="Clear the search"
							className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-gray-400 cursor-pointer hover:text-white"
						>
							<XMarkIcon className="h-4 w-4" />
						</button>
					)}
				</div>
			</div>
			<Tabs
				seg={shown}
				values={values}
				typing={p.typing}
				onPick={(k) => {
					setLast(k)
					p.go(k)
				}}
			/>
		</div>
	)
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar values={values} onPick={(k) => openAt(k)} onClearSearch={() => d.setQ(null)} />
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={openAt} className="mt-2" />
			<SnapSheet
				index={p.seg ? 0 : -1}
				onIndex={(i) => i < 0 && close()}
				snaps={[0.94]}
				label="Filters"
				header={header}
				footer={<Footer d={d} pieces={pieces} onDone={close} />}
			>
				<div ref={body} className="relative overflow-hidden">
					<AnimatePresence initial={false} custom={p.dir} mode="popLayout">
						<motion.div key={shown} custom={p.dir} variants={MORPH} initial="enter" animate="center" exit="exit" transition={MORPH_T}>
							<TabPanel seg={shown} d={d} pieces={pieces} p={p} phone focusField={() => field.current?.focus()} />
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantR5_15({ d }: { d: ProtoDiscover }) {
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
