// PROTOTYPE - throwaway. Variant J, "Split heading": the heading gives the two ways in equal weight. Left, the mood
// search in the heading's look ("Describe a mood"); right, "Pick a mood", showing the picked tags' hue dots. Pick a mood
// opens a panel under the heading: the mood chips with counts, About and Style folded, and "All filters", which
// unfolds the real card stack in the same panel. Under the heading, today's FilterBar and count line, unchanged.
// Phones: the two halves are one segmented row ("Describe" | "Pick a mood"), the panel a SnapSheet.
import { AdjustmentsHorizontalIcon, ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterBar, FilterGroups, FilterSearchField, SLAB_CLEARANCE, ShowTitlesButton, SnapSheet } from "~/ui/filter-bar"
import { MENU, TAP } from "~/ui/filter-bar/motion"
import { ProtoGrid, type ProtoDiscover, useFilterPieces } from "../kit"
import { Disclosure, FoldedGroup, HueDots, MoodSection, pickedLabel } from "./J-vibe"

export const NAME = "Split heading"

const COMMIT_MS = 800
const PRIVATE = "search-private ph-no-capture sentry-mask"

/** The search's draft, committed 800 ms after typing stops or on Enter, following the URL when it changes. */
function useDraft(d: ProtoDiscover) {
	const [draft, setDraft] = useState(d.q ?? "")
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const latest = useRef(d)
	latest.current = d
	useEffect(() => setDraft(d.q ?? ""), [d.q])
	useEffect(() => () => clearTimeout(timer.current), [])
	const run = (text: string) => {
		clearTimeout(timer.current)
		const t = text.trim()
		if (t !== (latest.current.q ?? "")) latest.current.setQ(t || null)
	}
	return {
		draft,
		type: (text: string) => {
			setDraft(text)
			clearTimeout(timer.current)
			timer.current = setTimeout(() => run(text), COMMIT_MS)
		},
		run,
		reset: () => {
			clearTimeout(timer.current)
			setDraft(latest.current.q ?? "")
		},
		clear: () => {
			clearTimeout(timer.current)
			setDraft("")
			latest.current.setQ(null)
		},
	}
}

// ---------------------------------------------------------------------------------------------------------------
// The panel's content, the same on desktop and phones.

function PanelBody({ d, pieces }: { d: ProtoDiscover; pieces: ReturnType<typeof useFilterPieces> }) {
	const [all, setAll] = useState(false)
	const [query, setQuery] = useState("")
	const tagCount = d.picked.length
	const deep = Math.max(0, pieces.secondaryCount - tagCount)
	return (
		<div className="flex flex-col gap-5">
			<MoodSection d={d} />
			<FoldedGroup d={d} group="themes" />
			<FoldedGroup d={d} group="styles" />
			<Disclosure
				label="All filters"
				icon={<AdjustmentsHorizontalIcon className="h-4 w-4 text-gray-400" />}
				badge={deep}
				open={all}
				onToggle={() => setAll(!all)}
			>
				<FilterSearchField value={query} onChange={setQuery} />
				<FilterGroups data={pieces.groups} query={query} className="mt-4" />
			</Disclosure>
		</div>
	)
}

function PanelFooter({ d, onDone }: { d: ProtoDiscover; onDone: () => void }) {
	return (
		<div className="flex shrink-0 items-center gap-3 border-t border-white/[0.06] bg-gray-950/80 px-5 py-3">
			<button
				type="button"
				onClick={d.clearTags}
				disabled={!d.picked.length}
				className="rounded-md px-2 py-1 text-sm text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-default disabled:text-gray-700"
			>
				Clear moods
			</button>
			<ShowTitlesButton counts={d.counts} onClick={onDone} className="ml-auto min-w-48" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop: two halves of one heading row.

function SearchHalf({ d }: { d: ProtoDiscover }) {
	const { draft, type, run, reset, clear } = useDraft(d)
	const input = useRef<HTMLInputElement>(null)
	const on = d.q !== null
	return (
		<div className="group/half min-w-0">
			<div className={`flex h-16 min-w-0 items-center gap-3 ${PRIVATE}`}>
				<MagnifyingGlassIcon className={`h-6 w-6 shrink-0 ${on ? "text-amber-400" : "text-gray-500"}`} aria-hidden />
				<label htmlFor="j-search" className="sr-only">
					Describe a mood
				</label>
				<input
					ref={input}
					id="j-search"
					type="search"
					value={draft}
					autoComplete="off"
					enterKeyHint="search"
					maxLength={SEARCH_MAX_CHARS}
					data-ph-no-capture
					placeholder="Describe a mood"
					onChange={(e) => type(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault()
							run(draft)
						}
						if (e.key === "Escape") {
							e.preventDefault()
							reset()
							input.current?.blur()
						}
					}}
					className="brand-header h-full min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-[34px] leading-tight text-white outline-none placeholder:text-gray-400 hover:placeholder:text-gray-300 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
				/>
				{(on || draft) && (
					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={clear}
						className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 cursor-pointer outline-none hover:bg-amber-400/10 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-4 w-4" aria-hidden />
						Clear
					</button>
				)}
			</div>
			<div className="h-px bg-linear-to-r from-white/25 via-white/10 to-transparent transition-colors group-focus-within/half:from-amber-400/80 group-focus-within/half:via-amber-400/20" />
		</div>
	)
}

function MoodHalf({ d, open, onToggle }: { d: ProtoDiscover; open: boolean; onToggle: () => void }) {
	const label = pickedLabel(d.picked)
	return (
		<div className="min-w-0">
			<button
				type="button"
				data-j-mood-trigger
				onClick={onToggle}
				aria-expanded={open}
				aria-haspopup="dialog"
				className="group flex h-16 w-full min-w-0 items-center gap-3 rounded-lg text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<HueDots tags={d.picked} size={18} idle />
				<span
					className={`brand-header min-w-0 flex-1 truncate text-[34px] leading-tight ${label ? "text-white" : "text-gray-400 group-hover:text-gray-300"}`}
				>
					{label ?? "Pick a mood"}
				</span>
				<ChevronDownIcon
					className={`h-6 w-6 shrink-0 text-gray-500 transition-transform group-hover:text-gray-300 ${open ? "rotate-180 text-amber-400" : ""}`}
				/>
			</button>
			<div
				className={`h-px bg-linear-to-r transition-colors ${open ? "from-amber-400/80 via-amber-400/20" : "from-white/25 via-white/10"} to-transparent`}
			/>
		</div>
	)
}

function DesktopPanel({
	d,
	pieces,
	onClose,
}: { d: ProtoDiscover; pieces: ReturnType<typeof useFilterPieces>; onClose: () => void }) {
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		const down = (e: Event) => {
			const t = e.target as HTMLElement
			if (ref.current?.contains(t) || t.closest("[data-j-mood-trigger]")) return
			// Popovers and dialogs the cards open (title pickers, previews) live outside the panel.
			if (t.closest("[role=dialog], [role=menu], [role=listbox]")) return
			onClose()
		}
		document.addEventListener("keydown", key)
		document.addEventListener("pointerdown", down)
		return () => {
			document.removeEventListener("keydown", key)
			document.removeEventListener("pointerdown", down)
		}
	}, [onClose])
	return (
		<motion.div
			ref={ref}
			role="dialog"
			aria-label="Pick a mood"
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -6 }}
			transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
			className={`absolute top-[calc(4rem+10px)] right-0 z-40 flex max-h-[calc(100vh-200px)] w-[calc(50%-1rem)] min-w-[560px] flex-col overflow-hidden ${MENU}`}
		>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-4">
				<PanelBody d={d} pieces={pieces} />
			</div>
			<PanelFooter d={d} onDone={onClose} />
		</motion.div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones: one segmented row.

function PhoneRow({ d, onPick }: { d: ProtoDiscover; onPick: () => void }) {
	const { draft, type, run, reset, clear } = useDraft(d)
	const input = useRef<HTMLInputElement>(null)
	const [focused, setFocused] = useState(false)
	const on = d.q !== null
	const label = pickedLabel(d.picked)
	const wide = focused || on || draft !== ""
	return (
		<div className="flex h-14 items-stretch rounded-2xl bg-white/[0.04] p-1 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] focus-within:ring-amber-500/50">
			<label
				className={`flex min-w-0 items-center gap-2 rounded-xl pr-1 pl-3 ${wide ? "flex-[1.6]" : "flex-1"} ${PRIVATE}`}
			>
				<MagnifyingGlassIcon className={`h-5 w-5 shrink-0 ${on ? "text-amber-400" : "text-gray-400"}`} aria-hidden />
				<span className="sr-only">Describe a mood</span>
				<input
					ref={input}
					type="search"
					value={draft}
					autoComplete="off"
					enterKeyHint="search"
					maxLength={SEARCH_MAX_CHARS}
					data-ph-no-capture
					placeholder="Describe"
					onChange={(e) => type(e.target.value)}
					onFocus={() => setFocused(true)}
					onBlur={() => setFocused(false)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault()
							run(draft)
							input.current?.blur()
						}
						if (e.key === "Escape") {
							reset()
							input.current?.blur()
						}
					}}
					className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] font-semibold text-white outline-none placeholder:font-bold placeholder:text-gray-200 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
				/>
				{(on || draft) && (
					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={clear}
						aria-label="Clear the search"
						className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-amber-400 cursor-pointer"
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
				)}
			</label>
			<span aria-hidden className="my-2.5 w-px bg-white/10" />
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={onPick}
				aria-haspopup="dialog"
				className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-[16px] font-bold cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${label ? "bg-white/[0.08] text-white" : "text-gray-200"}`}
			>
				<HueDots tags={d.picked} size={14} idle />
				<span className="truncate">{label ?? "Pick a mood"}</span>
			</motion.button>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantJ({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const [panel, setPanel] = useState(false)
	const [sheet, setSheet] = useState(-1)
	const readAs = d.q && d.reading.length ? <ReadAsChips reading={d.reading} /> : null
	return (
		<div className={`mx-auto max-w-[1600px] px-4 pt-4 lg:px-8 ${SLAB_CLEARANCE}`}>
			<h1 className="sr-only">Discover movies and TV shows</h1>
			<div className="relative hidden lg:block">
				<div className="grid grid-cols-2 gap-8">
					<SearchHalf d={d} />
					<MoodHalf d={d} open={panel} onToggle={() => setPanel(!panel)} />
				</div>
				{/* Fixed height, so Read as arriving doesn't move the bar. */}
				<div className="h-9 overflow-hidden pt-2.5">{readAs}</div>
				<AnimatePresence>
					{panel && <DesktopPanel d={d} pieces={pieces} onClose={() => setPanel(false)} />}
				</AnimatePresence>
			</div>
			<div className="lg:hidden">
				<PhoneRow d={d} onPick={() => setSheet(1)} />
				{readAs && <div className="overflow-hidden pt-2.5">{readAs}</div>}
				<SnapSheet
					index={sheet}
					onIndex={setSheet}
					label="Pick a mood"
					header={
						<div className="flex items-center gap-2.5 px-5 pb-3">
							<HueDots tags={d.picked} size={14} idle />
							<h2 className="brand-header text-[22px] text-white">Pick a mood</h2>
						</div>
					}
					footer={<PanelFooter d={d} onDone={() => setSheet(-1)} />}
				>
					<div className="px-5 pt-1 pb-6">
						<PanelBody d={d} pieces={pieces} />
					</div>
				</SnapSheet>
			</div>
			<div className="mt-1 lg:mt-2">
				<FilterBar filters={d.filters} counts={d.counts} />
			</div>
			<div className="mt-4">
				<ProtoGrid d={d} />
			</div>
		</div>
	)
}
