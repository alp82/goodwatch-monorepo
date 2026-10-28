// PROTOTYPE - throwaway. Round 5 variant 14, "Tiers inside tabs": R4-8's bar with four tabs (Search, Mood,
// Streaming, Watched) and no More. Each tab opens on its essentials, laid out big; its deeper filters sit in a quiet
// "More in <tab>" list at the bottom, and picking one swaps the view in place, with a back link. No sub-tab row.
// Where things live (TIERS in R5-14-parts):
//   Search: Describe a mood, Find a title, Similar to · more: Cast and crew, Loved, Disliked
//   Mood: Mood, Movies or shows, Genre · more: About, Style, Length
//   Streaming: Everywhere / My services / Pick, service logos, country line · more: Production country, Age and content
//   Watched: Not seen yet, Score, Released · more: Taste match, Scores by source, Critics vs audiences
// The search stays in the bar on every tab; "Find a filter" ends every tab's quiet list and offers its text as a search
// too. A status chip opens its filter where it lives (a deeper one opens straight on its own view).
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
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
	WarmCards,
	segValues,
	useClearAll,
	useOutsideClose,
	useScrollTopOn,
	useSlashKey,
} from "./R5-14-parts"
import { type SearchProps, TierBody, type TierView } from "./R5-14-tiers"

export const NAME = "Tiers inside tabs"

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

/** Which tab is open, and inside it: a deeper filter's view, or the Find a filter text. */
function useTabState() {
	const [seg, setSeg] = useState<SegKey | null>(null)
	const [dir, setDir] = useState(1)
	const [deep, setDeep] = useState<CardKey | null>(null)
	const [find, setFind] = useState("")
	const go = (k: SegKey | null, toDeep: CardKey | null = null) => {
		if (k && seg) setDir(SEG_ORDER.indexOf(k) >= SEG_ORDER.indexOf(seg) ? 1 : -1)
		setSeg(k)
		setDeep(toDeep)
		setFind("")
	}
	const view: TierView = {
		deep,
		onDeep: (k) => {
			setFind("")
			setDeep(k)
		},
		find,
		onFind: setFind,
	}
	return { seg, dir, go, view }
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (o: boolean) => void }) {
	const values = segValues(d, pieces)
	const { seg, dir, go, view } = useTabState()
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const panel = useRef<HTMLDivElement>(null)
	const open = seg !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const close = () => go(null)
	useOutsideClose(open, close, panel)
	const pick = (k: SegKey, deep: CardKey | null = null) => {
		if (k === "search") setText(d.q ?? "")
		go(k, deep)
	}
	useSlashKey(() => pick("search"))
	const typed = text.trim()
	const typing = seg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	const search: SearchProps = {
		text,
		typing,
		onRun: run,
		onFill: (t) => {
			setText(t)
			field.current?.focus()
		},
	}
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="r5-14"
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
							className="absolute inset-x-0 top-[calc(76px+10px)] z-40 flex h-[min(560px,calc(100vh-220px))] flex-col overflow-hidden rounded-[24px] bg-[#0b1120] shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,0.09)]"
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
										<TierBody seg={seg} d={d} pieces={pieces} phone={false} view={view} search={search} />
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
				const badge = values[k].badge
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
								layoutId="r5-14-tab"
								transition={{ type: "spring", stiffness: 520, damping: 42 }}
								className="absolute inset-0 rounded-full bg-white"
							/>
						)}
						<span className="relative flex items-center gap-1.5">
							{SEG_LABEL[k]}
							{set && !badge && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="set" />}
							{badge ? (
								<span className="grid h-4.5 min-w-4.5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] text-gray-950">
									{badge}
								</span>
							) : null}
						</span>
					</motion.button>
				)
			})}
		</div>
	)
}

function Phone({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const values = segValues(d, pieces)
	const { seg, dir, go, view } = useTabState()
	const [last, setLast] = useState<SegKey>("mood")
	const [text, setText] = useState("")
	const field = useRef<HTMLInputElement>(null)
	const shownSeg = seg ?? last
	const openAt = (k: SegKey, deep: CardKey | null = null) => {
		if (k === "search") setText(d.q ?? "")
		setLast(k)
		go(k, deep)
	}
	const typed = text.trim()
	const typing = shownSeg === "search" && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		go(null)
	}
	const body = useRef<HTMLDivElement>(null)
	useScrollTopOn(body, `${shownSeg}|${view.deep ?? ""}|${view.find.trim() ? "find" : ""}`)
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
				header={<Tabs seg={shownSeg} onPick={(k) => openAt(k)} values={values} />}
				footer={<Footer d={d} pieces={pieces} onDone={() => go(null)} />}
			>
				<div ref={body} className="relative overflow-hidden px-5 pt-3 pb-8">
					<AnimatePresence initial={false} custom={dir} mode="popLayout">
						<motion.div key={shownSeg} custom={dir} variants={MORPH} initial="enter" animate="center" exit="exit" transition={MORPH_T}>
							<TierBody seg={shownSeg} d={d} pieces={pieces} phone view={view} search={search} />
						</motion.div>
					</AnimatePresence>
				</div>
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantR5_14({ d }: { d: ProtoDiscover }) {
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
