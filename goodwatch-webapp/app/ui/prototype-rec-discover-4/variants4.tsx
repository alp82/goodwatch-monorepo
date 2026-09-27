// PROTOTYPE - throwaway. Round 4 of #179. Owner verdict on round 3: `morph` has the best layout, but its transition
// wasn't good. Every variant here is `morph`'s layout exactly (the Discover heading turns into a large field; the
// query becomes the heading), with the For you explanation area swapping to the "Read as ..." line during a search.
// The five variants differ only in how the page moves between browsing and searching, each within ~150-280 ms:
// the heading/field plate morph, the text swaps, the count line and the result grid.
// framer-motion is already loaded on every page (app.tsx). MotionConfig reducedMotion="user" drops transforms and
// layout motion for people who ask for less motion; the skeleton beat is skipped for them too.
import { ArrowDownIcon, ArrowUpIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, LayoutGroup, MotionConfig, type Transition, type Variants, motion, useReducedMotion } from "framer-motion"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { type D3, matchQuery, useDiscover3 } from "~/ui/prototype-rec-discover-3/rank3"
import { CoinCard } from "~/ui/prototype-rec-discover/cards"
import type { Payload, SearchList } from "~/ui/prototype-rec-discover/types"
import { SPRING, TAP, buzz } from "~/ui/prototype-rec-filter-bar-2/kit2"
import { GRID } from "~/ui/prototype-rec-filter-bar/kit"
import { ExplainLine, QueryInput, Recover4, Shell4, useDraft } from "./bar4"
import { EASE_IN, EASE_OUT, EASE_SPRING, FEELS, type Feel, FeelProvider, Swap, Tick, useFeel } from "./swap4"

const LIMIT = 36

// ---------------------------------------------------------------- the cards (round 3's grid body)

// For you flips keep round 2's glide; `flip` uses a 260 ms one so a new query reflows on time.
const SLOW_GLIDE: Transition = { type: "spring", stiffness: 140, damping: 22 }
const FAST_GLIDE: Transition = { duration: 0.26, ease: EASE_SPRING }

function Cards({ d, pop = false }: { d: D3; pop?: boolean }) {
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
							initial={pop ? { opacity: 0, scale: 0.9 } : { opacity: 0, y: -12 }}
							animate={{ opacity: 1, y: 0, scale: 1, transition: pop ? { duration: 0.18, ease: EASE_OUT } : { duration: 0.3 } }}
							exit={{ opacity: 0, scale: pop ? 0.96 : 0.9, transition: { duration: pop ? 0.1 : 0.15 } }}
							transition={pop ? FAST_GLIDE : SLOW_GLIDE}
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
			{d.bar.recoveries.length > 0 && <Recover4 d={d} className={d.bar.results.length ? "aspect-[2/3] scale-95" : "col-span-full py-12"} />}
		</div>
	)
}

// ---------------------------------------------------------------- the grid transitions

type Kind = "fade" | "flip" | "shimmer" | "slide" | "roll"

// Whole-grid swaps: the old list leaves in 100-140 ms while the new one lands in 160-220 ms.
const GRID_SWAP: Record<"fade" | "slide" | "roll", Variants> = {
	fade: {
		enter: { opacity: 0, scale: 0.985 },
		center: { opacity: 1, scale: 1, transition: { duration: 0.22, ease: EASE_OUT } },
		leave: { opacity: 0, scale: 1.005, transition: { duration: 0.12, ease: EASE_IN } },
	},
	slide: {
		enter: (dir: number) => ({ opacity: 0, x: 56 * dir }),
		center: { opacity: 1, x: 0, transition: { duration: 0.22, ease: EASE_OUT } },
		leave: (dir: number) => ({ opacity: 0, x: -56 * dir, transition: { duration: 0.14, ease: EASE_IN } }),
	},
	roll: {
		enter: (dir: number) => ({ opacity: 0, y: 14 * dir }),
		center: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
		leave: { opacity: 0, transition: { duration: 0.1 } },
	},
}

function Skeleton({ n }: { n: number }) {
	return (
		<div className={GRID} aria-hidden>
			{Array.from({ length: n }, (_, i) => (
				<div key={i} className="d4-skel relative aspect-[2/3] scale-95 overflow-hidden rounded-lg border-4 border-gray-800 bg-gray-900">
					<span className="absolute top-2 right-2 h-11 w-8 rounded-t-full rounded-b-md bg-white/[0.06]" />
					<span className="absolute bottom-3 left-2 h-3 w-2/3 rounded bg-white/[0.06]" />
				</div>
			))}
		</div>
	)
}

// The old grid dissolves into a skeleton, holds it for 100 ms, then the new list snaps in (~240 ms in all).
function ShimmerGrid({ d }: { d: D3 }) {
	const k = d.query?.q ?? "browse"
	const reduce = useReducedMotion()
	const [shown, setShown] = useState(k)
	const pending = !reduce && shown !== k
	useEffect(() => {
		if (shown === k) return
		if (reduce) return void setShown(k)
		const id = setTimeout(() => setShown(k), 100)
		return () => clearTimeout(id)
	}, [k, shown, reduce])
	const n = Math.min(Math.max(d.ranked.length, 6), 18)
	return (
		<div data-d4-motion="grid" className="relative">
			<AnimatePresence initial={false} mode="popLayout">
				{pending ? (
					<motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.08 } }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
						<Skeleton n={n} />
					</motion.div>
				) : (
					<motion.div key={k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.14, ease: EASE_OUT } }} exit={{ opacity: 0, transition: { duration: 0.08 } }}>
						<Cards d={d} />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

function Grid4({ d, kind }: { d: D3; kind: Kind }) {
	const { dir } = useFeel()
	if (kind === "flip")
		return (
			<div data-d4-motion="grid">
				<Cards d={d} pop />
			</div>
		)
	if (kind === "shimmer") return <ShimmerGrid d={d} />
	const k = d.query?.q ?? "browse"
	return (
		<div data-d4-motion="grid" className={`relative ${kind === "slide" ? "overflow-x-clip" : ""}`}>
			<AnimatePresence initial={false} mode="popLayout" custom={dir}>
				<motion.div key={k} custom={dir} variants={GRID_SWAP[kind]} initial="enter" animate="center" exit="leave" style={{ transformOrigin: "50% 0" }}>
					<Cards d={d} />
				</motion.div>
			</AnimatePresence>
		</div>
	)
}

// ---------------------------------------------------------------- the head: round 3's morph layout

// Prefetch as you type: once the draft maps to a captured search, warm its posters so the transition isn't judged on
// TMDB image latency. A live search could do the same with the first results it streams back.
const warmed = new Set<string>()
function warm(list: SearchList | null) {
	if (!list || warmed.has(list.q)) return
	warmed.add(list.q)
	for (const t of list.titles) if (t.poster_path) new Image().src = `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${t.poster_path}`
}

function Title({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <h1 className={`brand-header text-3xl text-white lg:text-4xl ${className}`}>{children}</h1>
}

// The heading and the field share one plate (layoutId). The plate morphs between the two boxes on the variant's
// curve; the words on it cross-fade quickly, so text never stretches.
function Head4({ d }: { d: D3 }) {
	const { feel } = useFeel()
	const [editing, setEditing] = useState(false)
	const dr = useDraft(d, 800)
	const q = d.query?.q
	// Enter commits through the router, which lands a frame or few later. Closing the field right away made the plate
	// move first and the grid follow ~80 ms behind; waiting for the query lets both start on the same frame.
	const closing = useRef<ReturnType<typeof setTimeout>>()
	const done = () => {
		clearTimeout(closing.current)
		const hit = matchQuery(dr.draft, d.data.search).hit
		if (hit && hit.q === q) return setEditing(false)
		closing.current = setTimeout(() => setEditing(false), 150) // a pick, or no match: don't wait forever
	}
	useEffect(() => {
		if (!closing.current) return
		clearTimeout(closing.current)
		closing.current = undefined
		setEditing(false)
	}, [q])
	useEffect(() => () => clearTimeout(closing.current), [])
	useEffect(() => warm(matchQuery(dr.draft, d.data.search).hit), [dr.draft, d.data.search])
	const content = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.14, delay: 0.06 } }, exit: { opacity: 0, transition: { duration: 0.06 } } }
	return (
		<LayoutGroup id="d4-morph">
			<div data-d4-motion="head" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 lg:min-h-16">
				<AnimatePresence mode="popLayout" initial={false}>
					{editing ? (
						<motion.div key="field" exit={{ opacity: 0, transition: { duration: 0.18 } }} className="relative flex h-14 w-full items-center px-4 lg:h-16 lg:max-w-2xl">
							<motion.span layoutId="d4-plate" transition={feel.plate} className="absolute inset-0 rounded-2xl bg-white/[0.07] ring-1 ring-white/25 shadow-[0_20px_60px_-24px_rgba(0,0,0,.9)]" />
							<motion.div {...content} className="relative flex h-full min-w-0 flex-1 items-center">
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
						</motion.div>
					) : (
						<motion.div key="head" exit={{ opacity: 0, transition: { duration: 0.18 } }} className="relative flex min-w-0 items-center gap-3">
							<motion.span layoutId="d4-plate" transition={feel.plate} className="absolute -inset-x-3 -inset-y-2 rounded-2xl bg-white/0 ring-1 ring-white/0" />
							<motion.div {...content} className="relative flex min-w-0 items-center gap-3">
								<button type="button" onClick={() => (buzz(), setEditing(true))} className="group flex min-w-0 items-center gap-3 text-left cursor-text" aria-label={q ? `Edit search ${q}` : "Search Discover"}>
									<Title className={`min-w-0 overflow-hidden ${q ? "!text-4xl lg:!text-5xl" : ""}`}>
										<Swap k={q ?? "browse"} className="-my-1 max-w-full py-1 align-middle" origin="0% 60%">
											<span className="block truncate">{q ?? "Discover"}</span>
										</Swap>
									</Title>
									<motion.span layout="position" transition={feel.plate} className={`grid shrink-0 place-items-center rounded-full ring-1 transition-colors ${q ? "h-9 w-9 text-gray-500 ring-white/10 group-hover:text-white" : "h-11 w-11 bg-white/[0.06] text-gray-200 ring-white/15 group-hover:bg-white/10"}`}>
										<MagnifyingGlassIcon className="h-5 w-5" />
									</motion.span>
								</button>
								<AnimatePresence initial={false} mode="popLayout">
									{q && (
										<motion.button
											key="clear"
											type="button"
											layout="position"
											initial={{ opacity: 0, scale: 0.6 }}
											animate={{ opacity: 1, scale: 1, transition: { duration: 0.16, ease: EASE_OUT } }}
											exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
											whileTap={TAP}
											onClick={() => (buzz(), d.clear())}
											aria-label="Clear search, back to Discover"
											className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white cursor-pointer"
										>
											<XMarkIcon className="h-5 w-5" />
										</motion.button>
									)}
								</AnimatePresence>
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>
				<motion.div layout="position" transition={feel.plate} className="w-full lg:w-auto lg:max-w-[34rem]">
					<ExplainLine d={d} />
				</motion.div>
			</div>
		</LayoutGroup>
	)
}

// ---------------------------------------------------------------- the `roll` count line

function RollCount({ d }: { d: D3 }) {
	const bar = d.bar
	const n = bar.results.length
	return (
		<span data-d4-motion="count" className="inline-flex items-center whitespace-nowrap text-sm text-gray-400">
			<Tick value={n} className="font-bold text-white" />
			&nbsp;
			<Swap k={d.query ? (n === 1 ? "match" : "matches") : "showing"}>{d.query ? (n === 1 ? "match" : "matches") : "showing"}</Swap>
			{bar.hidden > 0 && (
				<>
					,&nbsp;
					<Tick value={bar.hidden} />
					&nbsp;hidden by your filters
				</>
			)}
		</span>
	)
}

// ---------------------------------------------------------------- variants

function make(kind: Kind, feel: Feel) {
	return function View({ data }: { data: Payload }) {
		const d = useDiscover3(data)
		return (
			<MotionConfig reducedMotion="user">
				<FeelProvider feel={feel} dir={d.query ? 1 : -1}>
					<Shell4 d={d} slots={{ head: <Head4 d={d} />, withQuery: false, reading: false, count: kind === "roll" ? <RollCount d={d} /> : undefined }}>
						<Grid4 d={d} kind={kind} />
					</Shell4>
				</FeelProvider>
			</MotionConfig>
		)
	}
}

export type Variant = { name: string; pitch: string; View: (p: { data: Payload }) => JSX.Element }

export const VARIANTS: Record<string, Variant> = {
	shared: {
		name: "Shared plate, cross-fade",
		pitch: "The heading and the field are one plate that springs between sizes in about 200 ms while the words cross-fade. The whole result grid cross-fades with a slight scale, all at once.",
		View: make("fade", FEELS.fade),
	},
	flip: {
		name: "Cards reflow (FLIP)",
		pitch: "The grid is never replaced: titles in both lists glide to their new place in 260 ms, new ones pop in, the rest vanish in 100 ms. Text nudges up into place.",
		View: make("flip", FEELS.nudge),
	},
	shimmer: {
		name: "Skeleton beat",
		pitch: "The old grid dissolves to a skeleton for 100 ms, as if fetching, then the new list snaps in. Text comes into focus from a light blur.",
		View: make("shimmer", FEELS.focus),
	},
	slide: {
		name: "Directional slide",
		pitch: "Searching moves forward: the grid and every swapped line slide in from the right. Clearing goes back and slides the other way.",
		View: make("slide", FEELS.slide),
	},
	roll: {
		name: "Odometer",
		pitch: "Heading, explanation and count line roll like an odometer; the numbers count from old to new (62 → 19). The grid lifts in with a short fade.",
		View: make("roll", FEELS.roll),
	},
}
