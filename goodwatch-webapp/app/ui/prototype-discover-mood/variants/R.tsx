// PROTOTYPE - throwaway. Variant R, "Search bar palette": the bar is the product. A static title, then one wide
// segmented bar (Mood search, Mood, Streaming, Watched, More), then the status line. A tap on a segment opens L's
// palette anchored under that segment, scrolled to its part; the bar lights the part in view as the palette scrolls.
// The Mood search segment turns into the field in place: typing shows "Search the mood" and the filters matching the
// words. Common filters are the palette's big parts; the niche ones sit under More, grouped by kind, one tap each.
// Phones: the bar is a stacked card and the palette a full-screen sheet with the same bar as its header.
import { Dialog, DialogPanel } from "@headlessui/react"
import { ArrowTurnDownLeftIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterGroups, ShowTitlesButton } from "~/ui/filter-bar"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { EXAMPLE_PROMPTS, type ProtoDiscover, useFilterPieces } from "../kit"
import {
	CountryLine,
	GenreControl,
	GridUnder,
	NicheControl,
	NicheRow,
	NotSeenControl,
	PRIVATE,
	PageTitle,
	PhoneBar,
	type Pieces,
	ReleasedControl,
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
	clearCard,
	nicheFor,
	segValues,
	useClearAll,
	useOutsideClose,
	useSlashKey,
} from "./R-parts"

export const NAME = "Search bar palette"

const PANEL_W = 920
const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"

// ---------------------------------------------------------------------------------------------------------------
// The palette's content, shared by the desktop panel and the phone sheet.

function Part({
	id,
	k,
	title,
	accent,
	children,
}: { id: string; k: SegKey; title: string; accent?: string; children: ReactNode }) {
	return (
		<section id={`${id}-${k}`} data-part={k} aria-label={title} className="scroll-mt-2 pt-6 first:pt-1">
			<h3 className="mb-4 flex items-center gap-2 text-[17px] font-bold text-white">
				<span className={`h-4 w-1 rounded-full ${accent ?? "bg-white/30"}`} />
				{title}
			</h3>
			{children}
		</section>
	)
}

function MoodSearchPart({ d, onRun }: { d: ProtoDiscover; onRun: (text: string) => void }) {
	return (
		<section
			data-part="search"
			aria-label="Mood search"
			className="rounded-2xl bg-amber-500/[0.07] p-1.5 ring-1 ring-inset ring-amber-400/25"
		>
			<h3 className={`${SECTION_LABEL} flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-amber-300/90`}>
				<MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden />
				{d.q ? "Searching the mood" : "Try"}
			</h3>
			{d.q ? (
				<div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-3 py-2">
					<span className={`brand-header min-w-0 truncate text-xl text-white ${PRIVATE}`}>{d.q}</span>
					{d.reading.length > 0 && <ReadAsChips reading={d.reading} />}
					<button
						type="button"
						onClick={() => d.setQ(null)}
						className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 cursor-pointer outline-none hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-4 w-4" aria-hidden />
						Clear
					</button>
				</div>
			) : (
				<div className="grid sm:grid-cols-2">
					{EXAMPLE_PROMPTS.slice(0, 4).map((prompt) => (
						<button
							key={prompt}
							type="button"
							onClick={() => onRun(prompt)}
							className="flex h-10 min-w-0 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-amber-50/80 cursor-pointer outline-none hover:bg-amber-400/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-400/70" aria-hidden />
							<span className="truncate">{prompt}</span>
						</button>
					))}
				</div>
			)}
		</section>
	)
}

/** While typing: the search answer first, then every filter option that matches the words (L's two answers). */
function TypingBody({ pieces, text, onRun }: { pieces: Pieces; text: string; onRun: (t: string) => void }) {
	return (
		<>
			<section aria-label="Mood search" className="rounded-2xl bg-amber-500/[0.07] p-1.5 ring-1 ring-inset ring-amber-400/25">
				<h3 className={`${SECTION_LABEL} flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-amber-300/90`}>
					<MagnifyingGlassIcon className="h-3.5 w-3.5" aria-hidden />
					Mood search
				</h3>
				<button
					type="button"
					onClick={() => onRun(text)}
					className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-xl bg-amber-400/[0.12] px-3 text-left cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search the mood:</span>
					<span className={`brand-header min-w-0 flex-1 truncate text-xl text-white ${PRIVATE}`}>{text}</span>
					<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-1 font-sans text-xs font-semibold text-amber-200/80 sm:flex">
						<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
						Enter
					</kbd>
				</button>
			</section>
			<section aria-label="Filters" className="mt-6">
				<h3 className={`${SECTION_LABEL} mb-3 flex items-center gap-2 text-gray-400`}>
					Filters matching “{text}”
					<span className="h-px flex-1 bg-white/[0.08]" />
				</h3>
				<FilterGroups data={pieces.groups} query={text} />
			</section>
		</>
	)
}

function MorePart({ d, pieces, id }: { d: ProtoDiscover; pieces: Pieces; id: string }) {
	const [open, setOpen] = useState<CardKey | null>(null)
	return (
		<section id={`${id}-more`} data-part="more" aria-label="More filters" className="scroll-mt-2 pt-8">
			<h3 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-gray-200">
				More filters
				<span className="h-px flex-1 bg-white/[0.08]" />
			</h3>
			<div className="mt-3 grid gap-x-6 gap-y-4 rounded-2xl bg-black/25 p-3 ring-1 ring-white/[0.05] sm:grid-cols-2">
				{nicheFor(pieces).map((g) => (
					<div key={g.kind} className="min-w-0">
						<h4 className={`${SECTION_LABEL} mb-1 px-3 text-gray-500`}>{g.kind}</h4>
						{g.items.map((item) => (
							<div key={item.k}>
								<NicheRow
									item={item}
									pieces={pieces}
									open={open === item.k}
									chevron="down"
									onClick={() => setOpen(open === item.k ? null : item.k)}
								/>
								<AnimatePresence initial={false}>
									{open === item.k && (
										<motion.div
											initial={{ opacity: 0, y: -6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0 }}
											transition={{ duration: 0.16 }}
											className="px-3 pt-2 pb-4"
										>
											<NicheControl d={d} pieces={pieces} k={item.k} />
											<button
												type="button"
												onClick={() => clearCard(d, pieces, item.k)}
												className="mt-2 text-[12px] text-gray-500 cursor-pointer hover:text-white"
											>
												Clear {item.title.toLowerCase()}
											</button>
										</motion.div>
									)}
								</AnimatePresence>
							</div>
						))}
					</div>
				))}
			</div>
		</section>
	)
}

function PaletteParts({ d, pieces, id, onRun }: { d: ProtoDiscover; pieces: Pieces; id: string; onRun: (t: string) => void }) {
	return (
		<>
			<div id={`${id}-search`}>
				<MoodSearchPart d={d} onRun={onRun} />
			</div>
			<Part id={id} k="mood" title="Mood" accent={FILTER_ACCENTS.moods.bar}>
				<TagChips d={d} group="moods" big />
				<div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
					<TypeControl d={d} />
					<GenreControl d={d} limit={8} />
				</div>
			</Part>
			<Part id={id} k="streaming" title="Streaming" accent={FILTER_ACCENTS.services.bar}>
				<StreamingModes d={d} pieces={pieces} />
				<div className="mt-3">
					<ServiceLogos d={d} pieces={pieces} layout="chips" limit={10} />
				</div>
				<div className="mt-2">
					<CountryLine d={d} pieces={pieces} />
				</div>
			</Part>
			<Part id={id} k="watched" title="Watched" accent={FILTER_ACCENTS.notSeenYet.bar}>
				<NotSeenControl pieces={pieces} />
				<div className="mt-5 grid gap-5 sm:grid-cols-2">
					<ScoreControl d={d} />
					<ReleasedControl d={d} />
				</div>
			</Part>
			<MorePart d={d} pieces={pieces} id={id} />
		</>
	)
}

/**
 * The palette's scroller: scrolls to the part `jump` asks for, and reports the part in view (the last one whose top
 * has passed the top edge; the last part once the end is reached).
 */
function useParts(id: string, jump: { k: SegKey; n: number } | null, onSpy: (k: SegKey) => void, active: boolean) {
	const scroller = useRef<HTMLDivElement>(null)
	const quietUntil = useRef(0)
	useEffect(() => {
		if (!jump || !active) return
		const el = scroller.current
		const part = document.getElementById(`${id}-${jump.k}`)
		if (!el || !part) return
		const top = jump.k === "search" ? 0 : part.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
		quietUntil.current = performance.now() + 600
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		el.scrollTo({ top, behavior: still ? "auto" : "smooth" })
	}, [jump, id, active])
	const onScroll = () => {
		const el = scroller.current
		if (!el || performance.now() < quietUntil.current) return
		if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) return onSpy("more")
		let seen: SegKey = "search"
		const edge = el.getBoundingClientRect().top + 48
		for (const k of SEG_ORDER) {
			const part = document.getElementById(`${id}-${k}`)
			if (part && part.getBoundingClientRect().top <= edge) seen = k
		}
		onSpy(seen)
	}
	return { scroller, onScroll }
}

function PaletteFooter({ d, pieces, onDone }: { d: ProtoDiscover; pieces: Pieces; onDone: () => void }) {
	const clearAll = useClearAll(d)
	const n = pieces.secondaryCount + (d.q ? 1 : 0)
	return (
		<footer className="flex shrink-0 items-center gap-4 border-t border-white/[0.08] bg-gray-950/80 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] lg:pb-3">
			<button
				type="button"
				onClick={clearAll}
				disabled={!n}
				className="rounded-md px-2 py-1 text-sm text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
			>
				{n ? `Clear all ${n}` : "Clear all"}
			</button>
			<ShowTitlesButton counts={d.counts} onClick={onDone} className="ml-auto h-11 min-w-44 max-sm:flex-1" />
		</footer>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop

function useBarGeometry(bar: React.RefObject<HTMLDivElement>, open: boolean) {
	const [geom, setGeom] = useState<{ w: number; left: Record<string, number> } | null>(null)
	useLayoutEffect(() => {
		if (!open) return
		const measure = () => {
			const el = bar.current
			if (!el) return
			const box = el.getBoundingClientRect()
			const left: Record<string, number> = {}
			for (const seg of el.querySelectorAll<HTMLElement>("[data-seg]")) {
				left[seg.dataset.seg ?? ""] = seg.getBoundingClientRect().left - box.left
			}
			setGeom({ w: box.width, left })
		}
		measure()
		window.addEventListener("resize", measure)
		return () => window.removeEventListener("resize", measure)
	}, [bar, open])
	return geom
}

function DesktopPanel({
	d,
	pieces,
	x,
	width,
	typing,
	text,
	jump,
	onSpy,
	onRun,
	onClose,
}: {
	d: ProtoDiscover
	pieces: Pieces
	x: number
	width: number
	typing: boolean
	text: string
	jump: { k: SegKey; n: number } | null
	onSpy: (k: SegKey) => void
	onRun: (t: string) => void
	onClose: () => void
}) {
	const ref = useRef<HTMLDivElement>(null)
	useOutsideClose(true, onClose, ref)
	const { scroller, onScroll } = useParts("rd", jump, onSpy, !typing)
	return (
		<motion.div
			ref={ref}
			role="dialog"
			aria-label="Filters"
			initial={{ opacity: 0, y: -8, x }}
			animate={{ opacity: 1, y: 0, x }}
			exit={{ opacity: 0, y: -6 }}
			transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
			style={{ width }}
			className="absolute top-[calc(76px+10px)] left-0 z-40 flex h-[min(640px,calc(100vh-220px))] flex-col overflow-hidden rounded-[22px] bg-[#0b1120] shadow-[0_30px_80px_-20px_rgba(0,0,0,.95),0_0_0_1px_rgba(255,255,255,0.09)]"
		>
			<div
				ref={scroller}
				onScroll={onScroll}
				className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-8"
			>
				{typing ? <TypingBody pieces={pieces} text={text} onRun={onRun} /> : <PaletteParts d={d} pieces={pieces} id="rd" onRun={onRun} />}
			</div>
			<PaletteFooter d={d} pieces={pieces} onDone={onClose} />
		</motion.div>
	)
}

function Desktop({ d, pieces, onOpenChange }: { d: ProtoDiscover; pieces: Pieces; onOpenChange: (open: boolean) => void }) {
	const values = segValues(d, pieces)
	const bar = useRef<HTMLDivElement>(null)
	const [anchor, setAnchor] = useState<SegKey | null>(null)
	const [lit, setLit] = useState<SegKey | null>(null)
	const [jump, setJump] = useState<{ k: SegKey; n: number } | null>(null)
	const [text, setText] = useState("")
	const [editing, setEditing] = useState(false)
	const open = anchor !== null
	useEffect(() => onOpenChange(open), [open, onOpenChange])
	const geom = useBarGeometry(bar, open)
	const close = useCallback(() => {
		setAnchor(null)
		setLit(null)
		setEditing(false)
	}, [])
	const pick = (k: SegKey) => {
		if (k === "search") setText(d.q ?? "")
		setEditing(k === "search")
		setAnchor(k)
		setLit(k)
		setJump((j) => ({ k, n: (j?.n ?? 0) + 1 }))
	}
	useSlashKey(() => pick("search"))
	const typed = text.trim()
	const typing = editing && typed !== "" && typed !== d.q
	const run = (t: string) => {
		d.setQ(t || null)
		close()
	}
	const width = geom ? Math.min(PANEL_W, geom.w) : PANEL_W
	const x = geom && anchor ? Math.max(0, Math.min((geom.left[anchor] ?? 0) - 6, geom.w - width)) : 0
	return (
		<div className="hidden lg:block">
			<div className="relative mt-5">
				<SegmentBar
					id="r"
					barRef={bar}
					values={values}
					active={lit}
					onPick={pick}
					onClearSearch={() => d.setQ(null)}
					searchInput={
						editing ? (
							<SearchInput
								value={text}
								onChange={(v) => {
									setText(v)
									setLit("search")
								}}
								onEnter={() => (typed ? run(typed) : close())}
								onEscape={close}
							/>
						) : undefined
					}
				/>
				<AnimatePresence>
					{open && (
						<DesktopPanel
							d={d}
							pieces={pieces}
							x={x}
							width={width}
							typing={typing}
							text={typed}
							jump={jump}
							onSpy={setLit}
							onRun={run}
							onClose={close}
						/>
					)}
				</AnimatePresence>
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={pick} className="mt-3" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones

function PhoneSheet({
	d,
	pieces,
	at,
	onClose,
}: { d: ProtoDiscover; pieces: Pieces; at: SegKey | null; onClose: () => void }) {
	const values = segValues(d, pieces)
	const [lit, setLit] = useState<SegKey | null>(at)
	const [jump, setJump] = useState<{ k: SegKey; n: number } | null>(at ? { k: at, n: 1 } : null)
	const [text, setText] = useState(d.q ?? "")
	const typed = text.trim()
	const typing = typed !== "" && typed !== d.q
	const { scroller, onScroll } = useParts("rp", jump, setLit, !typing)
	const run = (t: string) => {
		d.setQ(t || null)
		onClose()
	}
	return (
		<DialogPanel
			transition
			className="flex h-full flex-col bg-[#0b1120] transition duration-200 ease-out data-closed:translate-y-6 data-closed:opacity-0 motion-reduce:data-closed:translate-y-0"
		>
			<header className="shrink-0 px-3 pt-[calc(10px+env(safe-area-inset-top))] pb-2">
				<div className="mb-2 flex items-center justify-between px-1">
					<span className="text-[15px] font-bold text-white">Refine</span>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.07] text-gray-300 cursor-pointer"
					>
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>
				<PhoneBar
					values={values}
					active={typing ? "search" : lit}
					onPick={(k) => {
						setLit(k)
						setJump((j) => ({ k, n: (j?.n ?? 0) + 1 }))
					}}
					searchInput={
						<SearchInput
							value={text}
							onChange={setText}
							onEnter={() => (typed ? run(typed) : onClose())}
							size="md"
							autoFocus={at === "search"}
						/>
					}
				/>
			</header>
			<div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-10">
				{typing ? <TypingBody pieces={pieces} text={typed} onRun={run} /> : <PaletteParts d={d} pieces={pieces} id="rp" onRun={run} />}
			</div>
			<PaletteFooter d={d} pieces={pieces} onDone={onClose} />
		</DialogPanel>
	)
}

function Phone({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const values = segValues(d, pieces)
	const [at, setAt] = useState<SegKey | null>(null)
	const [open, setOpen] = useState(false)
	const openAt = (k: SegKey) => {
		setAt(k)
		setOpen(true)
	}
	return (
		<div className="lg:hidden">
			<div className="mt-3">
				<PhoneBar values={values} onPick={openAt} onClearSearch={() => d.setQ(null)} />
			</div>
			<StatusLine d={d} pieces={pieces} onOpen={openAt} className="mt-2" />
			<Dialog open={open} onClose={() => setOpen(false)} className="relative z-[1100]" aria-label="Refine">
				<div className="fixed inset-0">
					{open && <PhoneSheet key={at ?? "x"} d={d} pieces={pieces} at={at} onClose={() => setOpen(false)} />}
				</div>
			</Dialog>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantR({ d }: { d: ProtoDiscover }) {
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
