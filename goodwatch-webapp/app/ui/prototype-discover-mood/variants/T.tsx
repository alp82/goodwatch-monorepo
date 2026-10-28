// PROTOTYPE - throwaway. Variant T, "Bar, tabs": M's expanding bar, organized by tabs. Closed: a static title, one bar
// that starts with a wide mood search field (a filter: once set it shows on the status line as a removable value with
// its Read as), then Mood, Streaming, Not seen yet, Sort and Filters; one status line. Mood or Filters expands the bar
// into one wide panel under it, over the dimmed grid: tabs along its top edge (Vibe from Mood, Basics from Filters,
// More filters for the niche ones), "Find a filter" at the tabs' right end, and a sticky footer with Clear all and
// Show N. Phones: the same tabs pinned at the top of a bottom sheet; the essentials lead the status line.
import { ArrowTurnDownLeftIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useCallback, useEffect, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { FilterGroups, FilterSearchField, SnapSheet } from "~/ui/filter-bar"
import { EXAMPLE_PROMPTS, ProtoGrid, type ProtoDiscover, useFilterPieces } from "../kit"
import {
	PRIVATE,
	PageTitle,
	PanelFooter,
	type Pieces,
	PhoneEssentials,
	PhoneFiltersKey,
	QuickControls,
	SOLID_PANEL,
	StatusLine,
	TabBody,
	type TabKey,
	TabStrip,
	tabCounts,
} from "./P-tabs"

export const NAME = "Bar, tabs"

// ---------------------------------------------------------------------------------------------------------------
// The mood search field: the bar's first and widest control. Enter runs it; focused and empty, examples drop down;
// while typing, the drop-down offers "Search the mood".

function MoodSearchField({ d, className = "" }: { d: ProtoDiscover; className?: string }) {
	const [text, setText] = useState(d.q ?? "")
	const [focused, setFocused] = useState(false)
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => setText(d.q ?? ""), [d.q])
	const run = (value: string) => {
		const v = value.trim()
		setText(v)
		d.setQ(v || null)
		input.current?.blur()
	}
	const typed = text.trim()
	const fresh = typed && typed !== d.q
	const drop = focused && (!typed || fresh)
	return (
		<div className={`relative ${className}`}>
			<label
				className={`flex h-12 w-full min-w-0 items-center gap-3 rounded-2xl bg-white/[0.06] pr-2 pl-4 ring-1 transition-colors ${
					focused ? "ring-2 ring-amber-400/70" : d.q ? "ring-amber-400/50" : "ring-white/15 hover:ring-white/25"
				} ${PRIVATE}`}
			>
				<MagnifyingGlassIcon className={`h-5 w-5 shrink-0 ${d.q || focused ? "text-amber-400" : "text-gray-400"}`} aria-hidden />
				<span className="sr-only">Mood search</span>
				<input
					ref={input}
					type="search"
					value={text}
					maxLength={SEARCH_MAX_CHARS}
					autoComplete="off"
					enterKeyHint="search"
					data-ph-no-capture
					placeholder="What’s the mood?"
					onChange={(e) => setText(e.target.value)}
					onFocus={() => setFocused(true)}
					onBlur={() => setFocused(false)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault()
							run(text)
						} else if (e.key === "Escape") {
							setText(d.q ?? "")
							input.current?.blur()
						}
					}}
					className="brand-header min-w-0 flex-1 border-0 bg-transparent p-0 text-[19px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
				/>
				{(text || d.q) && (
					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => {
							setText("")
							if (d.q) d.setQ(null)
						}}
						aria-label="Remove the mood search"
						className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-gray-400 cursor-pointer outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-4 w-4" />
					</button>
				)}
			</label>
			<AnimatePresence>
				{drop && (
					<motion.div
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						transition={{ duration: 0.14 }}
						onMouseDown={(e) => e.preventDefault()}
						className={`absolute inset-x-0 top-[calc(100%+8px)] z-50 rounded-2xl p-1.5 ${SOLID_PANEL}`}
					>
						{fresh ? (
							<button
								type="button"
								onClick={() => run(typed)}
								className="flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl bg-amber-400/[0.12] px-3 text-left cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search the mood:</span>
								<span className={`brand-header min-w-0 flex-1 truncate text-lg text-white ${PRIVATE}`}>{typed}</span>
								<ArrowTurnDownLeftIcon className="h-4 w-4 shrink-0 text-amber-200/70" aria-hidden />
							</button>
						) : (
							EXAMPLE_PROMPTS.slice(0, 5).map((prompt) => (
								<button
									key={prompt}
									type="button"
									onClick={() => run(prompt)}
									className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] text-amber-50/80 cursor-pointer outline-none hover:bg-amber-400/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
								>
									<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-400/70" aria-hidden />
									{prompt}
								</button>
							))
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Desktop: the bar and the panel it expands into.

function DesktopPanel({
	d,
	pieces,
	tab,
	onTab,
	onClose,
}: { d: ProtoDiscover; pieces: Pieces; tab: TabKey; onTab: (tab: TabKey) => void; onClose: () => void }) {
	const ref = useRef<HTMLDivElement>(null)
	const [find, setFind] = useState("")
	useEffect(() => {
		const key = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		const down = (e: Event) => {
			const t = e.target as HTMLElement
			if (ref.current?.contains(t) || t.closest("[data-bar-trigger], [data-bar-row]")) return
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
	const query = find.trim()
	return (
		<motion.div
			ref={ref}
			role="dialog"
			aria-label="Mood and filters"
			initial={{ opacity: 0, scaleY: 0.96, y: -6 }}
			animate={{ opacity: 1, scaleY: 1, y: 0 }}
			exit={{ opacity: 0, scaleY: 0.97, y: -4 }}
			transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
			style={{ transformOrigin: "top center" }}
			className={`absolute inset-x-0 top-[calc(3rem+10px)] z-40 flex h-[min(620px,calc(100vh-210px))] flex-col overflow-hidden rounded-2xl text-gray-200 ${SOLID_PANEL}`}
		>
			<TabStrip
				tab={tab}
				onTab={(t) => {
					setFind("")
					onTab(t)
				}}
				counts={tabCounts(pieces)}
				className="shrink-0 px-4 pt-1"
				right={<FilterSearchField value={find} onChange={setFind} className="h-9 w-80" />}
			/>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pt-5 pb-8">
				{query ? (
					<FilterGroups data={pieces.groups} query={query} />
				) : (
					<TabBody tab={tab} d={d} pieces={pieces} layout="panel" onPrompt={(text) => d.setQ(text)} />
				)}
			</div>
			<PanelFooter d={d} pieces={pieces} onDone={onClose} />
		</motion.div>
	)
}

function DesktopBar({
	d,
	pieces,
	open,
	setOpen,
}: { d: ProtoDiscover; pieces: Pieces; open: TabKey | null; setOpen: (f: (o: TabKey | null) => TabKey | null) => void }) {
	const close = useCallback(() => setOpen(() => null), [setOpen])
	return (
		<div className="relative mt-4 hidden lg:block">
			<div data-bar-row className="flex items-center gap-2.5">
				<MoodSearchField d={d} className="min-w-[16rem] flex-1" />
				<QuickControls
					d={d}
					pieces={pieces}
					open={open}
					onMood={() => setOpen((o) => (o === "vibe" ? null : "vibe"))}
					onFilters={() => setOpen((o) => (o === "basics" || o === "more" ? null : "basics"))}
				/>
			</div>
			<StatusLine d={d} pieces={pieces} className="mt-3" />
			<AnimatePresence>
				{open && <DesktopPanel d={d} pieces={pieces} tab={open} onTab={(t) => setOpen(() => t)} onClose={close} />}
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Phones: the same field and the Filters key; the panel is a bottom sheet with the tabs pinned at its top.

function PhoneBar({ d, pieces }: { d: ProtoDiscover; pieces: Pieces }) {
	const [sheet, setSheet] = useState(-1)
	const [tab, setTab] = useState<TabKey>("basics")
	const openAt = (t: TabKey) => {
		setTab(t)
		setSheet(0)
	}
	const open = sheet >= 0
	return (
		<div className="lg:hidden">
			<div className="mt-3 flex items-center gap-2">
				<MoodSearchField d={d} className="min-w-0 flex-1" />
				<PhoneFiltersKey count={pieces.secondaryCount} onClick={() => openAt("basics")} />
			</div>
			<StatusLine
				d={d}
				pieces={pieces}
				className="mt-2.5"
				lead={<PhoneEssentials d={d} pieces={pieces} onMood={() => openAt("vibe")} />}
			/>
			<SnapSheet
				index={sheet}
				onIndex={setSheet}
				snaps={[0.92]}
				label="Mood and filters"
				header={open ? <TabStrip tab={tab} onTab={setTab} counts={tabCounts(pieces)} className="px-2" /> : null}
				footer={<PanelFooter d={d} pieces={pieces} onDone={() => setSheet(-1)} />}
			>
				{open && (
					<div className="px-5 pt-4 pb-6">
						<TabBody
							tab={tab}
							d={d}
							pieces={pieces}
							layout="phone"
							onPrompt={(text) => {
								d.setQ(text)
								setSheet(-1)
							}}
						/>
					</div>
				)}
			</SnapSheet>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantT({ d }: { d: ProtoDiscover }) {
	const pieces = useFilterPieces(d)
	const [open, setOpen] = useState<TabKey | null>(null)
	return (
		<MotionConfig reducedMotion="user">
			<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8">
				<PageTitle />
				<DesktopBar d={d} pieces={pieces} open={open} setOpen={setOpen} />
				<PhoneBar d={d} pieces={pieces} />
				<div className="relative mt-3 lg:mt-4">
					<ProtoGrid d={d} />
					<AnimatePresence>
						{open && (
							<motion.button
								type="button"
								aria-label="Close the filters"
								tabIndex={-1}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.18 }}
								onClick={() => setOpen(null)}
								className="absolute inset-0 z-30 hidden cursor-default bg-gray-950/50 lg:block"
							/>
						)}
					</AnimatePresence>
				</div>
			</div>
		</MotionConfig>
	)
}
