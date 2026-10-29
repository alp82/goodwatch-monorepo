// PROTOTYPE - throwaway. The Discover lab shell (round 6, from round 5 variant 16): the static title, the bar with
// three segments (Search, Mood, Watch), one status line, the panel under the bar and the phone sheet. Search has
// sub-tabs Moods and titles, Cast and crew, You; Mood is one section; Watch has Services, Made in, Length,
// Scores, Released, Age and content. Each sub-tab's content is the chosen variant of its lab section. The search field
// stays live in the bar on every tab; typing there from Mood or Watch jumps to Moods and titles, on Search it stays put
// (sections read the text). Find a filter sits at the right of the sub-tab row on Mood and Watch. Round 11: the
// panel's footer shows the whole search state (shell-footer.tsx).
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { useEffect, useMemo, useRef, useState } from "react"
import { SnapSheet } from "~/ui/filter-bar"
import { TAP } from "~/ui/filter-bar/motion"
import { useLabChoice } from "./LabBar"
import { pick, pick as variantOf } from "./registry"
import { ResultsProvider, useShown } from "./results-view"
import { useMcUsers } from "./sections/scores/mc-users"
import { Footer } from "./shell-footer"
import { type ProtoDiscover, TAGS, useFilterPieces } from "../kit"
import { tagName } from "./sections/mood/parts"
import {
	GridUnder,
	PageTitle,
	PhoneBar,
	type Pieces,
	SEG_LABEL,
	SEG_ORDER,
	SearchGo,
	SearchInput,
	type SegKey,
	segOf,
	SegmentBar,
	type Slot,
	StatusLine,
	WarmCards,
	segValues,
	subCount,
	subsFor,
	useOutsideClose,
	useScrollTopOn,
	useSlashKey,
	whereIs,
} from "./shell-parts"
import { CONTENT_H, type SectionBase, SubTabs, TabPanel } from "./shell-tabs"
import type { SectionId } from "./types"

export const NAME = "Discover lab"

const MORPH = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
}
const MORPH_T = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const }

/** Which tab is open, the sub-tab each tab is on, and Find a filter's text. */
function useTabState() {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [subs, setSubs] = useState<Record<SegKey, SectionId>>({ search: "titles", mood: "mood", watch: "services" })
	const [find, setFind] = useState("")
	const go = (k: SegKey | null) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		if (k !== seg) setFind("")
		setSeg(k)
	}
	const setSub = (k: SegKey, id: SectionId) => setSubs((s) => ({ ...s, [k]: id }))
	const goTo = (slot: Slot) => {
		const w = whereIs(slot)
		setSub(w.seg, w.sub)
		go(w.seg)
	}
	/** A section's open(seg, sub): a sub that isn't in that tab is ignored. */
	const openAt = (k: SegKey, sub?: string) => {
		if (sub && segOf(sub as SectionId) === k) setSub(k, sub as SectionId)
		go(k)
	}
	return { seg, dir, go, goTo, openAt, subs, setSub, find, setFind }
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	useMcUsers() // the bar and badges read the lab-only Metacritic user score
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
	/** From Mood or Watch the field leads to Moods and titles; on Search it stays on the open sub-tab. */
	const toSearch = () => {
		if (seg === "search") return
		t.setSub("search", "titles")
		t.go("search")
	}
	const typed = text.trim()
	const shownD = useShown(d)
	const section: SectionBase = {
		d,
		pieces,
		text,
		setText,
		runSearch: (q) => d.setQ(q.trim() || null),
		open: t.openAt,
		close,
	}
	const submit = () => {
		if (typed) d.setQ(typed)
		close()
	}
	const button = variantOf(useLabChoice(), "titles").searchButton === true
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="lab"
					values={values}
					active={seg}
					onPick={pick}
					onClearSearch={() => d.setQ(null)}
					searchInput={
						open ? (
							<>
								<div className={button ? "pr-28" : ""}>
									<SearchInput
										value={text}
										onChange={(v) => {
											setText(v)
											toSearch()
										}}
										onFocus={toSearch}
										inputRef={field}
										autoFocus={false}
										onEnter={submit}
										onEscape={close}
									/>
								</div>
								{button && <SearchGo onClick={submit} empty={!typed} className="absolute top-1/2 right-1 -translate-y-1/2" />}
							</>
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
							className="absolute inset-x-0 top-[calc(76px+10px)] z-40 flex flex-col overflow-hidden rounded-[24px] bg-[#0b1120] shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,0.09)]"
						>
							{/* The sub-tab row (48 px) over the content area. */}
							<div className="relative shrink-0 overflow-hidden" style={{ height: CONTENT_H + 48 }}>
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
											id="lab-d"
											seg={seg}
											subs={subsFor(seg, pieces)}
											sub={t.subs[seg]}
											onSub={(id) => t.setSub(seg, id)}
											pieces={pieces}
											phone={false}
											section={section}
											find={t.find}
											onFind={t.setFind}
										/>
									</motion.div>
								</AnimatePresence>
							</div>
							<Footer d={d} pieces={pieces} onDone={close} onOpen={goTo} />
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<StatusLine d={shownD} pieces={pieces} onOpen={goTo} className="mt-3" />
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
								layoutId="lab-tab"
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
	useMcUsers()
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
	const shownD = useShown(d)
	const section: SectionBase = {
		d,
		pieces,
		text,
		setText,
		runSearch: (q) => d.setQ(q.trim() || null),
		open: (k, s) => {
			setLast(k)
			t.openAt(k, s)
		},
		close: () => t.go(null),
	}
	const button = variantOf(useLabChoice(), "titles").searchButton === true
	const body = useRef<HTMLDivElement>(null)
	useScrollTopOn(body, `${shown}|${sub}|${t.find.trim() ? "find" : ""}`)
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar values={values} onPick={openAt} onClearSearch={() => d.setQ(null)} />
			</div>
			<StatusLine d={shownD} pieces={pieces} onOpen={goTo} className="mt-2" />
			<SnapSheet
				index={t.seg ? 0 : -1}
				onIndex={(i) => i < 0 && t.go(null)}
				snaps={[0.94]}
				label="Filters"
				header={
					<div>
						<Tabs d={d} pieces={pieces} seg={shown} onPick={openAt} />
						{subs.length > 1 && (
							<SubTabs
								id="lab-p"
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
						)}
					</div>
				}
				footer={<Footer d={d} pieces={pieces} onDone={() => t.go(null)} onOpen={goTo} phone />}
			>
				<div ref={body} className="relative overflow-hidden px-5 pt-4 pb-8">
					<AnimatePresence initial={false} custom={t.dir} mode="popLayout">
						<motion.div key={shown} custom={t.dir} variants={MORPH} initial="enter" animate="center" exit="exit" transition={MORPH_T}>
							<TabPanel
								id="lab-p"
								seg={shown}
								subs={subs}
								sub={sub}
								onSub={(id) => t.setSub(shown, id)}
								pieces={pieces}
								phone
								section={section}
								find={t.find}
								onFind={t.setFind}
								top={
									shown === "search" && (
										<div className="mb-5 flex h-14 items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)]">
											<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
											<SearchInput
												value={text}
												onChange={setText}
												inputRef={field}
												onEnter={() => {
													if (typed) d.setQ(typed)
													t.go(null)
												}}
												size="md"
												autoFocus={false}
											/>
											{button && (
												<SearchGo
													onClick={() => {
														if (typed) d.setQ(typed)
														t.go(null)
													}}
													empty={!typed}
													small
													className="-mr-2"
												/>
											)}
										</div>
									)
								}
							/>
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

/** The real pieces, with the lab's mood names on the mood chips (Cozy, not Feel-good), round 11b. */
function useLabPieces(d: ProtoDiscover) {
	const raw = useFilterPieces(d)
	const chips = useMemo(
		() =>
			raw.chips.map((c) => {
				if (c.group !== "moods") return c
				const t = TAGS.find((x) => x.group === "moods" && `mood-${x.key}` === c.key)
				return t ? { ...c, label: tagName(t) } : c
			}),
		[raw.chips],
	)
	return { ...raw, chips }
}

export function LabShell({ d }: { d: ProtoDiscover }) {
	const pieces = useLabPieces(d)
	const [dim, setDim] = useState(false)
	const liveGrid = pick(useLabChoice(), "titles").liveGrid === true
	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8 lg:pt-6">
				<PageTitle />
				<ResultsProvider d={d}>
					{(shown) => (
						<>
							<Desktop d={d} pieces={pieces} onOpenChange={setDim} />
							<Phone d={d} pieces={pieces} />
							<GridUnder d={shown} dim={dim && !liveGrid} />
						</>
					)}
				</ResultsProvider>
				<WarmCards pieces={pieces} />
			</div>
		</MotionConfig>
	)
}
