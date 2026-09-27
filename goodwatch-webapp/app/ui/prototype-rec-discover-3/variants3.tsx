// PROTOTYPE - throwaway. Round 3 of #179: Discover and Search on one page, no tabs. Every variant shares the settled
// bar (studio row, slab, the glowing For you control with its fingerprint explanation) and the same state: a query
// turns browsing into searching, the grid re-ranks by relevance, filters stay, Relevance joins the sort, and For you
// moves a search result 5 places at most. The six variants differ only in where the query lives and how the page
// changes between the two states.
import { ArrowDownIcon, ArrowUpIcon, MagnifyingGlassIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CoinCard } from "~/ui/prototype-rec-discover/cards"
import { listSentence } from "~/ui/prototype-rec-discover/rank"
import type { Payload } from "~/ui/prototype-rec-discover/types"
import { SPRING, TAP, buzz } from "~/ui/prototype-rec-filter-bar-2/kit2"
import { GRID } from "~/ui/prototype-rec-filter-bar/kit"
import { Pop, QueryInput, Recover3, SHELL, Shell3, SlabMenu, SuggestList, TasteLine, useDraft } from "./bar3"
import { type D3, SEARCH_MAX_MOVE, suggestions, useDiscover3, wantWords } from "./rank3"

const LIMIT = 36

// ---------------------------------------------------------------- the result grid (round 2's `motion` grid)

// Cards glide to their new place; after a For you flip each moved card says how far, for a few seconds.
// `stagger` fades a new result list in card by card (the morph variant's one orchestrated moment).
function Grid({ d, stagger = false }: { d: D3; stagger?: boolean }) {
	const [, tick] = useState(0)
	const live = d.before.current && Date.now() - d.flipAt < 2600
	useEffect(() => {
		if (!d.flipAt) return
		const id = setTimeout(() => tick((n) => n + 1), 2650)
		return () => clearTimeout(id)
	}, [d.flipAt])
	const items = d.ranked.slice(0, LIMIT)
	return (
		<div className={GRID}>
			<AnimatePresence initial={false} mode="popLayout">
				{items.map((r, i) => {
					const was = live ? d.before.current?.get(r.t.ref) : undefined
					const delta = was == null ? 0 : was - i
					return (
						<motion.div
							key={r.t.ref}
							layout
							initial={stagger ? { opacity: 0, y: 18, scale: 0.97 } : { opacity: 0, y: -12 }}
							animate={{ opacity: 1, y: 0, scale: 1, transition: stagger ? { delay: Math.min(i, 18) * 0.025, type: "spring", stiffness: 260, damping: 26 } : { duration: 0.3 } }}
							exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
							transition={{ type: "spring", stiffness: 140, damping: 22 }}
						>
							<CoinCard t={r.t} mine={d.data.mine}>
								<AnimatePresence>
									{delta !== 0 && (
										<motion.span
											key={`${d.flipAt}`}
											initial={{ opacity: 0, scale: 0.6 }}
											animate={{ opacity: 1, scale: 1 }}
											exit={{ opacity: 0 }}
											transition={SPRING}
											className={`absolute top-3 left-3 flex h-7 items-center gap-0.5 rounded-full px-2 text-[13px] font-black tabular-nums ring-[3px] ring-gray-900 shadow-lg ${delta > 0 ? "bg-amber-400 text-gray-950" : "bg-gray-700 text-gray-200"}`}
										>
											{delta > 0 ? <ArrowUpIcon className="h-3.5 w-3.5" /> : <ArrowDownIcon className="h-3.5 w-3.5" />}
											{Math.abs(delta)}
										</motion.span>
									)}
								</AnimatePresence>
							</CoinCard>
						</motion.div>
					)
				})}
			</AnimatePresence>
			{d.bar.recoveries.length > 0 && <Recover3 d={d} className={d.bar.results.length ? "aspect-[2/3] scale-95" : "col-span-full py-12"} />}
		</div>
	)
}

// ---------------------------------------------------------------- shared pieces

function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <h1 className={`brand-header text-3xl text-white lg:text-4xl ${className}`}>{children}</h1>
}

function PlainHead({ d }: { d: D3 }) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
			<Title>Discover</Title>
			<TasteLine d={d} className={d.query ? "hidden lg:flex" : ""} />
		</div>
	)
}

// The query as a removable token: white, so it reads as the thing the list is about, not another filter.
function QueryChip({ d, onEdit, size = "md" }: { d: D3; onEdit?: () => void; size?: "md" | "sm" }) {
	if (!d.query) return null
	return (
		<motion.span layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className={`flex shrink-0 items-center rounded-full bg-white font-bold text-gray-950 shadow-[0_6px_20px_-8px_rgba(255,255,255,.35)] ${size === "md" ? "h-9 text-sm" : "h-8 text-[13px]"}`}>
			<button type="button" onClick={onEdit} className="flex h-full items-center gap-1.5 pl-3 pr-1 cursor-pointer" aria-label={`Search: ${d.query.q}${onEdit ? ", edit" : ""}`}>
				<MagnifyingGlassIcon className="h-4 w-4 text-gray-500" />
				{d.query.q}
			</button>
			<button type="button" onClick={() => (buzz(), d.clear())} aria-label="Clear search" className="mr-1 grid h-7 w-7 place-items-center rounded-full text-gray-500 hover:bg-gray-950/10 hover:text-gray-950 cursor-pointer">
				<XMarkIcon className="h-4 w-4" />
			</button>
		</motion.span>
	)
}

// ---------------------------------------------------------------- 1. lead: the query field leads the bar

function Lead({ data }: { data: Payload }) {
	const d = useDiscover3(data)
	const desk = useDraft(d)
	const phone = useDraft(d)
	return (
		<Shell3
			d={d}
			slots={{
				head: <PlainHead d={d} />,
				lead: (
					<div className={`h-12 min-w-[13rem] flex-1 rounded-2xl px-4 transition-shadow ${SHELL} focus-within:!ring-white/30 ${d.query ? "!bg-white/[0.08] !ring-white/20" : ""}`}>
						<QueryInput d={d} dr={desk} className="h-full" inputClass="text-[15px] font-bold" placeholder="Search or describe" />
					</div>
				),
				compactFilters: true,
				slab: {
					above: (
						<div className={`h-11 rounded-[16px] px-3.5 ring-1 ${d.query ? "bg-white/[0.09] ring-white/20" : "bg-white/[0.05] ring-white/10"}`}>
							<QueryInput d={d} dr={phone} up className="h-full" inputClass="text-[15px] font-bold" placeholder="Search or describe a mood" popClass="absolute -left-3 bottom-full mb-3 w-[calc(100vw-1.5rem)]" />
						</div>
					),
				},
			}}
		>
			<Grid d={d} />
		</Shell3>
	)
}

// ---------------------------------------------------------------- 2. header: the site header search drives this page

// The real header search stays mounted but hidden; this input takes its slot. It never calls the paid search.
function HeaderSlot({ d }: { d: D3 }) {
	const [slot, setSlot] = useState<HTMLElement | null>(null)
	const dr = useDraft(d)
	useEffect(() => {
		const real = document.querySelector<HTMLElement>(".search-private")
		const parent = real?.parentElement
		if (!parent) return
		const el = document.createElement("div")
		el.className = "d3-header-slot"
		parent.appendChild(el)
		setSlot(el)
		return () => el.remove()
	}, [])
	if (!slot) return null
	return createPortal(
		<div className={`flex h-9 w-32 items-center rounded-md border-2 px-2.5 text-gray-200 transition-colors sm:w-52 lg:!w-80 ${d.query ? "border-amber-500/70 bg-gray-800" : "border-slate-700 bg-gray-800"}`}>
			<QueryInput d={d} dr={dr} className="h-full w-full" inputClass="text-sm sm:text-base" placeholder="Search…" popClass="fixed inset-x-3 top-16 lg:absolute lg:inset-x-auto lg:top-full lg:right-0 lg:mt-3 lg:w-[340px]" />
		</div>,
		slot,
	)
}

function HeaderHead({ d }: { d: D3 }) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
			<AnimatePresence mode="wait" initial={false}>
				{d.query ? (
					<motion.div key="q" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="flex min-w-0 items-center gap-3">
						<Title className="min-w-0 break-words">{d.query.q}</Title>
						<motion.button type="button" whileTap={TAP} onClick={() => (buzz(), d.clear())} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] pl-2.5 pr-3.5 text-sm font-bold text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white cursor-pointer">
							<XMarkIcon className="h-4 w-4" />
							<span className="hidden sm:inline">Back to Discover</span>
							<span className="sm:hidden">Back</span>
						</motion.button>
					</motion.div>
				) : (
					<motion.div key="b" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
						<Title>Discover</Title>
					</motion.div>
				)}
			</AnimatePresence>
			<TasteLine d={d} className={d.query ? "hidden lg:flex" : ""} />
		</div>
	)
}

function Header({ data }: { data: Payload }) {
	const d = useDiscover3(data)
	return (
		<>
			<HeaderSlot d={d} />
			<style>{".search-private{display:none!important}"}</style>
			<Shell3 d={d} slots={{ head: <HeaderHead d={d} />, withQuery: false }}>
				<Grid d={d} />
			</Shell3>
		</>
	)
}

// ---------------------------------------------------------------- 3. chip: the query is a chip in the bar

function SearchPop({ d, close }: { d: D3; close: () => void }) {
	const dr = useDraft(d, 900)
	return (
		<div className="p-1.5">
			<div className="flex h-11 items-center rounded-xl bg-white/[0.06] px-3 ring-1 ring-white/10 focus-within:ring-white/30">
				<QueryInput d={d} dr={dr} pop={false} autoFocus className="h-full w-full" inputClass="text-sm font-bold" placeholder="Search this list" onDone={close} />
			</div>
			<SuggestList d={d} hint={dr.noMatch} onPick={close} className="mt-1" />
		</div>
	)
}

function ChipSearchButton({ d }: { d: D3 }) {
	return (
		<Pop
			width={340}
			align="right"
			trigger={(open, toggle) => (
				<motion.button type="button" whileTap={TAP} aria-expanded={open} aria-haspopup="dialog" onClick={toggle} className={`flex h-12 w-32 items-center gap-2 px-4 text-sm font-bold cursor-pointer ${SHELL} ${open ? "ring-white/25 text-white" : "text-gray-200 hover:ring-white/20"}`}>
					<MagnifyingGlassIcon className="h-4 w-4" />
					Search
					<span className={`ml-auto h-2 w-2 rounded-full ${d.query ? "bg-white" : "bg-transparent"}`} />
				</motion.button>
			)}
		>
			{(close) => <SearchPop d={d} close={close} />}
		</Pop>
	)
}

// Phone: the slab's top line is the search entry, or the query chip with the count.
function ChipSlabLine({ d }: { d: D3 }) {
	const [open, setOpen] = useState(false)
	return (
		<>
			<div className="flex h-9 items-center gap-2.5">
				{d.query ? (
					<>
						<QueryChip d={d} size="sm" onEdit={() => setOpen(true)} />
						<span className="truncate text-xs text-gray-400">
							<span className="font-bold text-white">{d.bar.results.length}</span> matches{d.bar.hidden > 0 && `, ${d.bar.hidden} hidden`}
						</span>
					</>
				) : (
					<button type="button" data-slab-trigger onClick={() => (buzz(), setOpen((o) => !o))} className="flex h-9 flex-1 items-center gap-2 rounded-full bg-white/[0.05] px-3.5 text-sm text-gray-400 ring-1 ring-white/10 cursor-pointer">
						<MagnifyingGlassIcon className="h-4 w-4" />
						Search this list
						<span className="ml-auto text-xs text-gray-500">{d.bar.results.length} showing</span>
					</button>
				)}
			</div>
			<SlabMenu open={open} onClose={() => setOpen(false)} width={366}>
				<SearchPop d={d} close={() => setOpen(false)} />
			</SlabMenu>
		</>
	)
}

function Chip({ data }: { data: Payload }) {
	const d = useDiscover3(data)
	return (
		<Shell3
			d={d}
			slots={{
				head: <PlainHead d={d} />,
				trail: <ChipSearchButton d={d} />,
				chip: <QueryChip d={d} />,
				withQuery: false,
				slab: { line: <ChipSlabLine d={d} /> },
			}}
		>
			<Grid d={d} />
		</Shell3>
	)
}

// ---------------------------------------------------------------- 4. describe: a sentence above the grid becomes the query

function DescribeLine({ d }: { d: D3 }) {
	const dr = useDraft(d, 800)
	const list = suggestions(d)
	const input = useRef<HTMLInputElement>(null)
	return (
		<div>
			<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
				<label htmlFor="d3-describe" className="brand-header shrink-0 text-3xl text-gray-500 lg:text-5xl">
					Show me
				</label>
				<div className={`relative flex w-full min-w-0 items-baseline border-b-2 sm:w-auto sm:flex-1 pb-1 transition-colors ${d.query ? "border-amber-500" : "border-white/15 focus-within:border-white/40"}`}>
					<input
						ref={input}
						id="d3-describe"
						type="search"
						value={dr.draft}
						onChange={(e) => dr.setDraft(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), dr.enter())}
						placeholder="anything good, or describe a mood"
						className="brand-header min-w-0 flex-1 border-0 bg-transparent p-0 text-3xl text-white caret-amber-400 placeholder:text-gray-700 outline-none focus:ring-0 lg:text-5xl [&::-webkit-search-cancel-button]:hidden"
					/>
					{dr.draft && (
						<button type="button" onClick={() => (buzz(), dr.clear(), input.current?.focus())} aria-label="Clear search" className="grid h-9 w-9 shrink-0 self-center place-items-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer">
							<XMarkIcon className="h-5 w-5" />
						</button>
					)}
				</div>
			</div>
			<AnimatePresence mode="wait" initial={false}>
				{d.query && !dr.noMatch ? (
					<motion.p key="read" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-3 text-sm text-gray-400 lg:text-base">
						Read as <span className="text-gray-100">{listSentence(wantWords(d.query))}</span>.{" "}
						<span className="text-gray-500">{d.forYou ? `For you only swaps close matches, ${SEARCH_MAX_MOVE} places at most.` : "Pure relevance, taste is off."}</span>
					</motion.p>
				) : (
					<motion.div key="try" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-4">
						{dr.noMatch && <p className="mb-2 text-sm text-fuchsia-200">Prototype: no captured search fits “{dr.draft}”. Pick one of these queries.</p>}
						<div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0">
							{list.map(({ s, forYou }) => (
								<motion.button key={s.q} type="button" whileTap={TAP} onClick={() => (buzz(), d.pick(s))} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.05] px-3.5 text-sm text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white cursor-pointer">
									{forYou && <FingerPrintIcon className="h-3.5 w-3.5 text-amber-500" />}
									{s.q}
								</motion.button>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

function Describe({ data }: { data: Payload }) {
	const d = useDiscover3(data)
	return (
		<Shell3 d={d} slots={{ head: <DescribeLine d={d} />, reading: false }}>
			<Grid d={d} />
		</Shell3>
	)
}

// ---------------------------------------------------------------- 5. morph: the heading turns into the search

function MorphHead({ d }: { d: D3 }) {
	const [editing, setEditing] = useState(false)
	const dr = useDraft(d, 800)
	const done = () => setEditing(false)
	return (
		<LayoutGroup id="d3-morph">
			<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
				<AnimatePresence mode="popLayout" initial={false}>
					{editing ? (
						<motion.div
							key="field"
							layoutId="d3-morph-box"
							transition={{ type: "spring", stiffness: 320, damping: 32 }}
							className="flex h-14 w-full items-center rounded-2xl bg-white/[0.07] px-4 ring-1 ring-white/25 shadow-[0_20px_60px_-24px_rgba(0,0,0,.9)] lg:h-16 lg:max-w-2xl"
						>
							<QueryInput
								d={d}
								dr={dr}
								autoFocus
								className="h-full min-w-0 flex-1"
								inputClass="brand-header text-2xl lg:text-3xl"
								placeholder="What’s the mood?"
								popClass="absolute left-0 top-full mt-3 w-full max-w-[340px]"
								onDone={done}
							/>
							<button type="button" onClick={done} className="ml-2 shrink-0 rounded-full px-3 py-1.5 text-sm font-bold text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer">
								Done
							</button>
						</motion.div>
					) : (
						<motion.div key={d.query ? "q" : "b"} layoutId="d3-morph-box" transition={{ type: "spring", stiffness: 320, damping: 32 }} className="flex min-w-0 items-center gap-3 rounded-2xl">
							<button type="button" onClick={() => (buzz(), setEditing(true))} className="group flex min-w-0 items-center gap-3 text-left cursor-text" aria-label={d.query ? `Edit search ${d.query.q}` : "Search Discover"}>
								<Title className={`truncate ${d.query ? "!text-4xl lg:!text-5xl" : ""}`}>{d.query ? d.query.q : "Discover"}</Title>
								<span className={`grid shrink-0 place-items-center rounded-full ring-1 transition-colors ${d.query ? "h-9 w-9 text-gray-500 ring-white/10 group-hover:text-white" : "h-11 w-11 bg-white/[0.06] text-gray-200 ring-white/15 group-hover:bg-white/10"}`}>
									<MagnifyingGlassIcon className="h-5 w-5" />
								</span>
							</button>
							{d.query && (
								<motion.button type="button" whileTap={TAP} onClick={() => (buzz(), d.clear())} aria-label="Clear search, back to Discover" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white cursor-pointer">
									<XMarkIcon className="h-5 w-5" />
								</motion.button>
							)}
						</motion.div>
					)}
				</AnimatePresence>
				{!editing && <TasteLine d={d} className={d.query ? "hidden lg:flex" : ""} />}
			</div>
		</LayoutGroup>
	)
}

function Morph({ data }: { data: Payload }) {
	const d = useDiscover3(data)
	return (
		<Shell3 d={d} slots={{ head: <MorphHead d={d} />, withQuery: false }}>
			<Grid key={d.query?.q ?? "browse"} d={d} stagger />
		</Shell3>
	)
}

// ---------------------------------------------------------------- 6. suggest: suggested searches as chips under the bar

function SuggestRail({ d }: { d: D3 }) {
	const [typing, setTyping] = useState(false)
	const dr = useDraft(d, 900)
	const list = suggestions(d)
	return (
		<div className="mt-5 lg:mt-6">
			<LayoutGroup id="d3-rail">
				<div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
					<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" />
					{list.map(({ s, forYou }) => {
						const on = d.query?.q === s.q
						return (
							<motion.button
								layout
								key={s.q}
								type="button"
								whileTap={TAP}
								aria-pressed={on}
								onClick={() => (buzz(), on ? d.clear() : d.pick(s))}
								transition={SPRING}
								className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm cursor-pointer transition-colors ${
									on ? "bg-white font-bold text-gray-950 shadow-[0_6px_20px_-8px_rgba(255,255,255,.35)]" : d.query ? "text-gray-500 ring-1 ring-white/10 hover:text-gray-200" : "bg-white/[0.05] text-gray-200 ring-1 ring-white/10 hover:bg-white/10"
								}`}
							>
								{forYou && !on && <FingerPrintIcon className="h-3.5 w-3.5 text-amber-500" />}
								{s.q}
								{on && <XMarkIcon className="h-4 w-4 text-gray-500" />}
							</motion.button>
						)
					})}
					{typing ? (
						<motion.div layout initial={{ width: 120, opacity: 0.6 }} animate={{ width: 260, opacity: 1 }} transition={SPRING} className="flex h-9 shrink-0 items-center rounded-full bg-white/[0.07] px-3.5 ring-1 ring-white/25">
							<QueryInput d={d} dr={dr} autoFocus icon={false} className="h-full w-full" inputClass="text-sm" placeholder="Type your own" popClass="fixed inset-x-3 bottom-48 lg:absolute lg:inset-x-auto lg:bottom-auto lg:top-full lg:left-0 lg:mt-3 lg:w-[340px]" onDone={() => setTyping(false)} />
						</motion.div>
					) : (
						<motion.button layout type="button" whileTap={TAP} onClick={() => (buzz(), setTyping(true))} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm text-gray-400 border border-dashed border-white/20 hover:text-white cursor-pointer">
							<PlusIcon className="h-4 w-4" />
							Type your own
						</motion.button>
					)}
				</div>
			</LayoutGroup>
		</div>
	)
}

function Suggest({ data }: { data: Payload }) {
	const d = useDiscover3(data)
	return (
		<Shell3 d={d} slots={{ head: <PlainHead d={d} />, aboveGrid: <SuggestRail d={d} /> }}>
			<Grid d={d} />
		</Shell3>
	)
}

// ---------------------------------------------------------------- registry

export type Variant = { name: string; style: "existing" | "bolder"; pitch: string; View: (p: { data: Payload }) => JSX.Element }

export const VARIANTS: Record<string, Variant> = {
	lead: {
		name: "Query field leads the bar",
		style: "existing",
		pitch: "A search field is the first thing in the studio row (on phones, the top of the slab). Typing turns the same grid into search results; filters stay, Relevance joins the sort.",
		View: Lead,
	},
	header: {
		name: "Header search drives the page",
		style: "existing",
		pitch: "The site's own header search is the only input. On this page it re-ranks the grid in place, and the heading becomes the query with a way back to Discover.",
		View: Header,
	},
	chip: {
		name: "Query as a chip in the bar",
		style: "existing",
		pitch: "Search is one more control at the end of the row. The query shows as a white chip before the filter chips; clearing it returns to browsing.",
		View: Chip,
	},
	suggest: {
		name: "Suggested searches as chips",
		style: "existing",
		pitch: "Under the bar sit searches to try, the ones that fit your taste marked with the fingerprint. One tap searches, a second tap goes back; you can also type your own.",
		View: Suggest,
	},
	describe: {
		name: "Describe what you want",
		style: "bolder",
		pitch: "The page opens with a large “Show me …” line. Whatever you write there becomes the query, read back to you in plain words; empty, it offers searches to try.",
		View: Describe,
	},
	morph: {
		name: "The heading morphs into search",
		style: "bolder",
		pitch: "Tap the Discover heading or its magnifier and it morphs into a large field. The query then becomes the heading, and the new results fade in card by card.",
		View: Morph,
	},
}

