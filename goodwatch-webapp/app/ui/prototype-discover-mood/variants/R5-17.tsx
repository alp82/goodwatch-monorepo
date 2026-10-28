// PROTOTYPE - throwaway. Round 5 variant 17, "Sub-tabs in the bar": four tabs (Search, Mood, Streaming, Watched), no
// More. Opening a tab widens its bar segment, which then carries that tab's sub-tabs inline; the other segments shrink
// to labels. The panel shows only the selected sub-tab, shaped for its job. Search stays a field-looking segment on
// every tab (and "/" opens it); "Find a filter" is a Search sub-tab and a footer button on every tab. Phones: the
// stacked bar card and a sheet whose header has the tabs and the open tab's sub-tabs.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { RollingNumber } from "~/ui/filter-bar/motion"
import { HiddenMeter } from "~/ui/filter-bar/SubBar"
import { type ProtoDiscover, useFilterPieces } from "../kit"
import { Bar, PhoneBar, SheetHeader, StatusLine, type TabKey, TAB_LABEL, TAB_ORDER, TABS, firstSub, subCount, subsFor, tabValues } from "./R5-17-bar"
import { Panel } from "./R5-17-panels"
import {
	GridUnder,
	PageTitle,
	type Pieces,
	SearchInput,
	WarmCards,
	useClearAll,
	useOutsideClose,
	useScrollTopOn,
	useSlashKey,
} from "./R5-17-parts"

export const NAME = "Sub-tabs in the bar"

const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

/** Every sub-tab in order, so a move left or right slides the panel the same way. */
const FLAT = TAB_ORDER.flatMap((t) => TABS[t].map((s) => `${t}:${s.id}`))

function useTabState() {
	const [tab, setTab] = useState<TabKey | null>(null)
	const [subs, setSubs] = useState<Partial<Record<TabKey, string>>>({})
	const [dir, setDir] = useState(1)
	const [text, setText] = useState("")
	const subOf = (t: TabKey) => subs[t] ?? firstSub(t)
	const go = (t: TabKey | null, sub?: string, q?: string | null) => {
		if (t === null) {
			setTab(null)
			setSubs({})
			return
		}
		const nextSub = sub ?? (tab ? subOf(t) : firstSub(t))
		const from = tab ? FLAT.indexOf(`${tab}:${subOf(tab)}`) : -1
		setDir(FLAT.indexOf(`${t}:${nextSub}`) >= from ? 1 : -1)
		if (t === "search" && tab !== "search") setText(q ?? "")
		setSubs((m) => ({ ...(tab ? m : {}), [t]: nextSub }))
		setTab(t)
	}
	return { tab, sub: tab ? subOf(tab) : "", dir, go, text, setText }
}

function Footer({
	d,
	pieces,
	onDone,
	onFind,
	finding,
}: { d: ProtoDiscover; pieces: Pieces; onDone: () => void; onFind: () => void; finding: boolean }) {
	const clearAll = useClearAll(d)
	const n = pieces.secondaryCount + (d.q ? 1 : 0)
	return (
		<div className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] bg-gray-950/85 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:gap-4 lg:pb-3">
			<button
				type="button"
				onClick={clearAll}
				disabled={!n}
				className="rounded-md px-2 py-1 text-sm text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
			>
				{n ? `Clear all ${n}` : "Clear all"}
			</button>
			{!finding && (
				<button
					type="button"
					onClick={onFind}
					className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<MagnifyingGlassIcon className="h-4 w-4" aria-hidden />
					Find a filter
				</button>
			)}
			<span className="hidden items-center gap-2.5 text-sm text-gray-400 lg:flex">
				<HiddenMeter counts={d.counts} className="w-24" />
				{d.counts && d.counts.hidden > 0 && (
					<span>
						<RollingNumber value={d.counts.hidden} className="font-semibold text-gray-200" /> hidden
					</span>
				)}
			</span>
			<ShowTitlesButton counts={d.counts} onClick={onDone} className="ml-auto h-11 min-w-40 max-sm:flex-1 lg:min-w-48" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const values = tabValues(d, pieces)
	const { tab, sub, dir, go, text, setText } = useTabState()
	const field = useRef<HTMLInputElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const open = tab !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const close = () => go(null)
	useOutsideClose(open, close, panel)
	const pick = (k: TabKey, s?: string) => go(k, s, d.q)
	useSlashKey(() => pick("search"))
	const typed = text.trim()
	const typing = tab === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	const fill = (t: string) => {
		setText(t)
		field.current?.focus()
	}
	const enter = () => {
		if (sub === "describe" || sub === "title") typed ? run(typed) : close()
	}
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<Bar
					id="v17"
					values={values}
					tab={tab}
					sub={sub}
					subs={tab ? subsFor(pieces, tab) : []}
					count={(s) => subCount(d, pieces, s)}
					onPick={(k) => pick(k)}
					onSub={(s) => tab && go(tab, s)}
					onClearSearch={() => d.setQ(null)}
					searchInput={
						tab === "search" ? (
							<SearchInput value={text} onChange={setText} inputRef={field} onEnter={enter} onEscape={close} />
						) : undefined
					}
				/>
				<AnimatePresence>
					{tab && (
						<motion.div
							ref={panel}
							role="dialog"
							aria-label={TAB_LABEL[tab]}
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
										key={`${tab}:${sub}`}
										custom={dir}
										variants={MORPH}
										initial="enter"
										animate="center"
										exit="exit"
										transition={MORPH_T}
										className="absolute inset-0"
									>
										<Panel tab={tab} sub={sub} d={d} pieces={pieces} phone={false} search={{ text, typing, onRun: run, onFill: fill }} />
									</motion.div>
								</AnimatePresence>
							</div>
							<Footer
								d={d}
								pieces={pieces}
								onDone={close}
								finding={tab === "search" && sub === "find"}
								onFind={() => {
									go("search", "find")
									setText("")
								}}
							/>
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

function Phone({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const values = tabValues(d, pieces)
	const { tab, sub, dir, go, text, setText } = useTabState()
	const [last, setLast] = useState<{ tab: TabKey; sub: string }>({ tab: "mood", sub: "mood" })
	const field = useRef<HTMLInputElement>(null)
	const shownTab = tab ?? last.tab
	const shownSub = tab ? sub : last.sub
	useEffect(() => {
		if (tab) setLast({ tab, sub })
	}, [tab, sub])
	const openAt = (k: TabKey, s?: string) => go(k, s, d.q)
	const typed = text.trim()
	const typing = shownTab === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	const body = useRef<HTMLDivElement>(null)
	useScrollTopOn(body, `${shownTab}:${shownSub}`)
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar values={values} onPick={(k) => openAt(k)} onClearSearch={() => d.setQ(null)} />
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={openAt} className="mt-2" />
			<SnapSheet
				index={tab ? 0 : -1}
				onIndex={(i) => i < 0 && go(null)}
				snaps={[0.94]}
				label="Filters"
				header={
					<SheetHeader
						values={values}
						tab={shownTab}
						onPick={(k) => openAt(k)}
						sub={shownSub}
						subs={subsFor(pieces, shownTab)}
						onSub={(s) => go(shownTab, s)}
						count={(s) => subCount(d, pieces, s)}
						searchField={
							shownTab === "search" ? (
								<div className="flex h-12 items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)]">
									<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
									<SearchInput
										value={text}
										onChange={setText}
										inputRef={field}
										onEnter={() => {
											if (shownSub === "describe" || shownSub === "title") typed ? run(typed) : go(null)
										}}
										size="md"
										autoFocus={false}
									/>
								</div>
							) : undefined
						}
					/>
				}
				footer={
					<Footer
						d={d}
						pieces={pieces}
						onDone={() => go(null)}
						finding={shownTab === "search" && shownSub === "find"}
						onFind={() => {
							go("search", "find")
							setText("")
						}}
					/>
				}
			>
				<div ref={body} className="relative overflow-hidden px-5 pt-4 pb-8">
					<AnimatePresence initial={false} custom={dir} mode="popLayout">
						<motion.div
							key={`${shownTab}:${shownSub}`}
							custom={dir}
							variants={MORPH}
							initial="enter"
							animate="center"
							exit="exit"
							transition={MORPH_T}
						>
							<Panel
								tab={shownTab}
								sub={shownSub}
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

export function VariantR5_17({ d }: { d: ProtoDiscover }) {
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
