// PROTOTYPE - throwaway. Variant P, "Palette, tabs": a static title, one bar, one status line. The bar starts with a big
// mood search field that opens L's centered palette (also the / key), then Mood, Streaming, Not seen yet, Sort and
// Filters. The palette keeps the large field at the top; under it three tabs split the filters: Vibe (the mood search,
// moods large, About and Style folded), Basics (the common filters as full controls), More filters (the niche ones as
// compact rows that open their card). Typing in the field swaps the tabs for L's two answers: "Search the mood" and the
// filters matching the text. Footer: the active values as chips, Clear all, Show N. Phones: the palette is full screen
// with the tabs pinned under the field; the essentials lead the status line.
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react"
import { AdjustmentsHorizontalIcon, ArrowTurnDownLeftIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { MotionConfig } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { FilterGroups } from "~/ui/filter-bar"
import { ProtoGrid, type ProtoDiscover, useFilterPieces } from "../kit"
import {
	PRIVATE,
	PageTitle,
	PanelFooter,
	type Pieces,
	PhoneEssentials,
	PhoneFiltersKey,
	QuickControls,
	StatusLine,
	TabBody,
	type TabKey,
	TabStrip,
	tabCounts,
	useWide,
} from "./P-tabs"

export const NAME = "Palette, tabs"

const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"

// ---------------------------------------------------------------------------------------------------------------
// The bar's search field: looks like a field, opens the palette. With a mood search on, it shows the query and ×.

function SearchKey({ d, onOpen, className = "" }: { d: ProtoDiscover; onOpen: () => void; className?: string }) {
	return (
		<div className={`relative ${className}`}>
			<button
				type="button"
				onClick={onOpen}
				aria-haspopup="dialog"
				aria-keyshortcuts="/"
				aria-label={d.q ? `Mood search: ${d.q}` : "What’s the mood?"}
				className={`flex h-12 w-full min-w-0 items-center gap-3 rounded-2xl bg-white/[0.06] pr-12 pl-4 text-left cursor-text outline-none ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
					d.q ? "ring-amber-400/50 hover:ring-amber-400/80" : "ring-white/15 hover:bg-white/[0.08] hover:ring-white/25"
				}`}
			>
				<MagnifyingGlassIcon className={`h-5 w-5 shrink-0 ${d.q ? "text-amber-400" : "text-gray-400"}`} aria-hidden />
				<span className={`brand-header min-w-0 flex-1 truncate text-[19px] ${d.q ? `text-white ${PRIVATE}` : "text-gray-500"}`}>
					{d.q ?? "What’s the mood?"}
				</span>
			</button>
			<span className="absolute inset-y-0 right-2 flex items-center">
				{d.q ? (
					<button
						type="button"
						onClick={() => d.setQ(null)}
						aria-label="Remove the mood search"
						className="grid h-8 w-8 place-items-center rounded-md text-gray-400 cursor-pointer outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
				) : (
					<kbd className="pointer-events-none hidden h-6 min-w-6 place-items-center rounded-md bg-white/10 px-1.5 font-sans text-xs font-semibold text-gray-400 lg:grid">
						/
					</kbd>
				)}
			</span>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The palette

/** While typing: L's two answers, kept apart. The amber one runs the text as the mood search. */
function TypedAnswers({ pieces, text, onRun }: { pieces: Pieces; text: string; onRun: (text: string) => void }) {
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
					<AdjustmentsHorizontalIcon className="h-3.5 w-3.5" aria-hidden />
					Filters matching “{text}”
					<span className="h-px flex-1 bg-white/[0.08]" />
				</h3>
				<FilterGroups data={pieces.groups} query={text} />
			</section>
		</>
	)
}

function Palette({
	d,
	pieces,
	open,
	tab,
	setTab,
	text,
	setText,
	onClose,
}: {
	d: ProtoDiscover
	pieces: Pieces
	open: boolean
	tab: TabKey
	setTab: (tab: TabKey) => void
	text: string
	setText: (text: string) => void
	onClose: () => void
}) {
	const wide = useWide()
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (open) requestAnimationFrame(() => input.current?.select())
	}, [open])
	const run = (value: string) => {
		d.setQ(value)
		onClose()
	}
	const typed = text.trim()
	return (
		<Dialog open={open} onClose={onClose} className="relative z-[1100]" aria-label="Mood and filters">
			<DialogBackdrop transition className="fixed inset-0 bg-black/60 transition-opacity duration-200 data-closed:opacity-0" />
			<div className="fixed inset-0 flex flex-col lg:items-center lg:justify-start lg:pt-[7vh]">
				<DialogPanel
					transition
					className="flex h-full w-full flex-col overflow-hidden bg-[#0b1120] shadow-[0_0_0_1px_rgba(255,255,255,0.09)] transition duration-200 ease-out data-closed:translate-y-6 data-closed:opacity-0 motion-reduce:transition-opacity motion-reduce:data-closed:translate-y-0 lg:h-[min(780px,86vh)] lg:w-[920px] lg:rounded-[18px] lg:shadow-[0_30px_90px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.09)] lg:data-closed:-translate-y-3"
				>
					<header className="shrink-0 px-4 pt-[calc(12px+env(safe-area-inset-top))] lg:px-6 lg:pt-5">
						<div
							className={`flex h-[60px] items-center gap-3 rounded-2xl bg-white/[0.07] pr-2 pl-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)] ${PRIVATE}`}
						>
							<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
							<input
								ref={input}
								// biome-ignore lint/a11y/noAutofocus: the palette opens to type
								autoFocus
								data-autofocus
								type="search"
								value={text}
								maxLength={SEARCH_MAX_CHARS}
								autoComplete="off"
								enterKeyHint="search"
								data-ph-no-capture
								aria-label="What’s the mood? Or find a filter"
								placeholder="What’s the mood?"
								onChange={(e) => setText(e.target.value)}
								onKeyDown={(e) => {
									if (e.key !== "Enter") return
									e.preventDefault()
									if (typed) run(typed)
									else onClose()
								}}
								className="brand-header min-w-0 flex-1 border-0 bg-transparent p-0 text-[22px] text-white outline-none placeholder:text-gray-500 focus:ring-0 lg:text-[24px] [&::-webkit-search-cancel-button]:hidden"
							/>
							{text ? (
								<button
									type="button"
									onClick={() => {
										setText("")
										input.current?.focus()
									}}
									aria-label="Clear the text"
									className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-gray-400 cursor-pointer hover:bg-white/10 hover:text-white"
								>
									<XMarkIcon className="h-4 w-4" />
								</button>
							) : (
								<>
									<kbd className="hidden rounded-md bg-white/10 px-[7px] py-0.5 font-sans text-xs text-gray-300 lg:block">Esc</kbd>
									<button
										type="button"
										onClick={onClose}
										aria-label="Close"
										className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-gray-400 cursor-pointer hover:bg-white/10 hover:text-white lg:hidden"
									>
										<XMarkIcon className="h-5 w-5" />
									</button>
								</>
							)}
						</div>
						{!typed && <TabStrip tab={tab} onTab={setTab} counts={tabCounts(pieces)} className="mt-2" />}
					</header>
					<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-8 lg:px-6">
						{typed ? (
							<TypedAnswers pieces={pieces} text={typed} onRun={run} />
						) : (
							<TabBody tab={tab} d={d} pieces={pieces} layout={wide ? "palette" : "phone"} onPrompt={run} />
						)}
					</div>
					<PanelFooter d={d} pieces={pieces} onDone={onClose} chips />
				</DialogPanel>
			</div>
		</Dialog>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function useSlashKey(onOpen: () => void) {
	const latest = useRef(onOpen)
	latest.current = onOpen
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
			const el = e.target as HTMLElement
			if (el.closest("input, textarea, select, [contenteditable=true]")) return
			e.preventDefault()
			e.stopImmediatePropagation()
			latest.current()
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [])
}

export function VariantP({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const [open, setOpen] = useState(false)
	const [tab, setTab] = useState<TabKey>("vibe")
	const [text, setText] = useState("")
	const openAt = (at: TabKey, value = "") => {
		setTab(at)
		setText(value)
		setOpen(true)
	}
	useSlashKey(() => openAt("vibe"))
	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8">
				<PageTitle />
				<div className="mt-4 hidden items-center gap-2.5 lg:flex">
					<SearchKey d={d} onOpen={() => openAt("vibe", d.q ?? "")} className="min-w-[16rem] flex-1" />
					<QuickControls
						d={d}
						pieces={pieces}
						open={null}
						onMood={() => openAt("vibe")}
						onFilters={() => openAt("basics")}
					/>
				</div>
				<div className="mt-3 flex items-center gap-2 lg:hidden">
					<SearchKey d={d} onOpen={() => openAt("vibe", d.q ?? "")} className="min-w-0 flex-1" />
					<PhoneFiltersKey count={pieces.secondaryCount} onClick={() => openAt("basics")} />
				</div>
				<StatusLine
					d={d}
					pieces={pieces}
					className="mt-2.5 lg:mt-3"
					lead={
						<span className="contents lg:hidden">
							<PhoneEssentials d={d} pieces={pieces} onMood={() => openAt("vibe")} />
						</span>
					}
				/>
				<div className="mt-3 lg:mt-4">
					<ProtoGrid d={d} />
				</div>
				<Palette
					d={d}
					pieces={pieces}
					open={open}
					tab={tab}
					setTab={setTab}
					text={text}
					setText={setText}
					onClose={() => setOpen(false)}
				/>
			</div>
		</MotionConfig>
	)
}
