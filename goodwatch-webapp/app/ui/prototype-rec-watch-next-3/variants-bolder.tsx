// PROTOTYPE - throwaway. The "bolder" variants of the ordered Wishlist (#176, round 3): "which first?"
// questions that place new titles and tidy the top, and the queue laid out as evenings ahead of you.
import { ArrowUpIcon, PlayIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { useMemo, useState } from "react"
import { ServiceTiles } from "~/ui/prototype-rec-watch-next/kit"
import { backdropUrl, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { DISPLAY, Landed, QPoster, Rank, SHORT, SectionHead, SuggestShelf, WRAP } from "./kit3"
import { HERO, type Queue } from "./model"
import { Tail, type VariantProps } from "./variants-existing"

// ============================================================ 5. Which first?

// Placing asks, it doesn't guess: a new title meets titles already in your queue, two at a time, and
// three or four taps find its place in your top 16. With nothing to place, the same question tidies the top.
const PLACE_IN = 16

export function WhichFirst({ q, onPeek }: VariantProps) {
	const pending = q.pending ? q.T(q.pending) : undefined
	// Binary search bounds for the pending title, as 0-based insert positions.
	const [range, setRange] = useState<{ key: string; lo: number; hi: number; asked: number } | null>(null)
	const [tidy, setTidy] = useState(0)
	const [tidyOn, setTidyOn] = useState(false)

	const enter = (key: string) => {
		if (q.count < 2) return q.addQ(key, q.count === 0 ? "top" : "bottom")
		q.setPending(key)
		setRange({ key, lo: 0, hi: Math.min(q.count, PLACE_IN), asked: 0 })
	}
	const r = pending && range?.key === pending.key ? range : pending ? { key: pending.key, lo: 0, hi: Math.min(q.count, PLACE_IN), asked: 0 } : null

	let pair: [WTitle, WTitle] | null = null
	let mid = 0
	if (pending && r && r.lo < r.hi) {
		mid = Math.floor((r.lo + r.hi) / 2)
		const other = q.T(q.order[mid])
		if (other) pair = [pending, other]
	}

	// Tidy: walk adjacent pairs in the top ten; picking the lower one swaps them.
	const tidyMax = Math.min(10, q.count) - 1
	const ti = tidyMax > 0 ? tidy % tidyMax : 0
	if (!pending && tidyOn && tidyMax > 0) {
		const a = q.T(q.order[ti])
		const b = q.T(q.order[ti + 1])
		if (a && b) pair = [a, b]
	}

	const choose = (winner: WTitle) => {
		if (pending && r) {
			const first = winner.key === pending.key
			const next = { key: pending.key, lo: first ? r.lo : mid + 1, hi: first ? mid : r.hi, asked: r.asked + 1 }
			if (next.lo < next.hi) return setRange(next)
			// The search has closed: place it. Losing to #16 means it goes last.
			q.setPending(null)
			setRange(null)
			q.addQ(pending.key, "at", next.lo >= PLACE_IN ? q.count : next.lo)
			return
		}
		if (pair && winner.key === pair[1].key) q.move(pair[1].key, ti)
		setTidy(tidy + 1)
	}
	const skip = () => {
		if (pending) {
			q.setPending(null)
			setRange(null)
			q.addQ(pending.key, "bottom")
		} else setTidy(tidy + 1)
	}
	const questionsLeft = r ? Math.max(1, Math.round(Math.log2(r.hi - r.lo + 1))) : 0

	return (
		<div className="pt-4">
			<div className={WRAP}>
				<SectionHead
					title={pending ? `Where does ${pending.title} go?` : "Which first?"}
					note={
						pending
							? `Tap the one you'd watch first. ${questionsLeft > 1 ? `About ${questionsLeft} more taps` : "One more tap"} and it has its place.`
							: q.count >= 3
								? "Every new title gets placed with a few quick questions. With nothing to place, the same question tidies your top ten."
								: "Add a few titles; each new one gets placed with a quick question or two."
					}
					right={
						!pending && q.count >= 3 ? (
							<button
								type="button"
								onClick={() => setTidyOn(!tidyOn)}
								className={`h-10 rounded-full px-4 text-sm font-semibold cursor-pointer ${tidyOn ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
							>
								{tidyOn ? "Done tidying" : q.count >= 10 ? "Tidy my top ten" : "Tidy the order"}
							</button>
						) : undefined
					}
				/>
				<Landed q={q} className="mb-5" />
			</div>

			<AnimatePresence mode="wait">
				{pair && (
					<motion.div key={`${pair[0].key}-${pair[1].key}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative mb-6 grid md:h-[26rem] md:grid-cols-2">
						{pair.map((t, i) => {
							const at = q.pos(t.key)
							return (
								<button
									key={t.key}
									type="button"
									onClick={() => choose(t)}
									aria-label={`${t.title} first`}
									className="group relative isolate flex h-60 min-w-0 cursor-pointer items-end overflow-hidden text-left outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-amber-400 md:h-full"
								>
									<img src={backdropUrl(t, "w1280")} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
									<div className={`absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/60 to-gray-900/10 group-hover:via-gray-900/35 ${i ? "md:bg-gradient-to-l" : "md:bg-gradient-to-r"}`} />
									<div className={`flex w-full items-end gap-4 p-4 md:p-8 ${i ? "md:flex-row-reverse md:text-right" : ""}`}>
										<img src={posterUrl(t, "w342")} alt="" className="hidden w-32 rounded-lg shadow-2xl shadow-black ring-1 ring-white/15 transition-transform group-hover:-translate-y-2 sm:block lg:w-40" />
										<div className="min-w-0">
											<p className="text-sm font-bold text-amber-300">{at ? `Now #${at}` : "New on your Wishlist"}</p>
											<h3 className={`${DISPLAY} text-3xl leading-[0.95] text-white md:text-5xl`}>{t.title}</h3>
											<p className="mt-2 text-sm text-gray-200">
												{t.year}, {runtimeLabel(t)}
												{t.match ? `, ${t.match}% match` : ""}
											</p>
											<div className={`mt-3 hidden sm:flex ${i ? "md:justify-end" : ""}`}>
												<ServiceTiles title={t} size={30} max={2} names />
											</div>
										</div>
									</div>
								</button>
							)
						})}
						<div className="pointer-events-none absolute right-4 top-60 z-10 -translate-y-1/2 md:right-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2">
							<span className={`${DISPLAY} flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-lg text-black shadow-2xl shadow-black md:h-20 md:w-20 md:text-xl`}>first?</span>
						</div>
						<div className="flex justify-center pt-3 md:absolute md:bottom-4 md:left-1/2 md:z-10 md:-translate-x-1/2 md:pt-0">
							<button type="button" onClick={skip} className="h-9 whitespace-nowrap rounded-full bg-black/70 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-black cursor-pointer">
								{pending ? "Skip, put it last" : "Skip this pair"}
							</button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			<div className={WRAP}>
				{q.count > 0 && (
					<LayoutGroup>
						<ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" aria-label="Your top titles">
							{q.titles.slice(0, 12).map((t, i) => (
								<motion.li layout key={t.key} className={`relative w-24 shrink-0 md:w-28 ${pair?.some((p) => p.key === t.key) ? "rounded-lg ring-2 ring-amber-400" : ""}`}>
									<button type="button" onClick={() => onPeek(t)} className="block w-full cursor-pointer">
										<img src={posterUrl(t, "w185")} alt={t.title} className={`aspect-[2/3] w-full rounded-lg object-cover ${i < HERO ? "" : "opacity-80"}`} />
									</button>
									<span className="pointer-events-none absolute bottom-1 left-1.5 text-white [text-shadow:0_2px_8px_#000]">
										<Rank n={i + 1} className="text-3xl" />
									</span>
								</motion.li>
							))}
						</ol>
					</LayoutGroup>
				)}
				<Tail q={q} from={12} onPeek={onPeek} />
				<SuggestShelf q={q} onOpen={onPeek} onAdd={(t) => enter(t.key)} className="mt-10" />
			</div>
		</div>
	)
}

// ============================================================ 6. Evenings

// The queue as the evenings ahead of you. Pick your pace and the order becomes a schedule: the five in
// the hero are this week, the rest land on next week, next month, or someday. Someday is where pruning starts.
type Pace = 7 | 4 | 2
const PACES: { n: Pace; label: string }[] = [
	{ n: 7, label: "Every night" },
	{ n: 4, label: "Few nights a week" },
	{ n: 2, label: "Weekends" },
]
const BUCKETS: { upTo: number; label: string }[] = [
	{ upTo: 7, label: "This week" },
	{ upTo: 14, label: "Next week" },
	{ upTo: 31, label: "Later this month" },
	{ upTo: 92, label: "In the next three months" },
	{ upTo: 365, label: "Later this year" },
	{ upTo: Number.POSITIVE_INFINITY, label: "Someday" },
]
// A film is one evening; a series takes three.
const evenings = (t: WTitle) => (t.type === "show" ? 3 : 1)

export function Evenings({ q, onPeek }: VariantProps) {
	const [pace, setPace] = useState<Pace>(4)
	const groups = useMemo(() => {
		let used = 0
		const out = BUCKETS.map((b) => ({ ...b, titles: [] as { t: WTitle; day: number }[] }))
		for (const t of q.titles) {
			const day = Math.floor((used / pace) * 7)
			used += evenings(t)
			out.find((b) => day < b.upTo)!.titles.push({ t, day })
		}
		return out.filter((g) => g.titles.length)
	}, [q.titles, pace])
	const total = q.titles.reduce((s, t) => s + evenings(t), 0)
	const weeks = Math.ceil(total / pace)
	const someday = groups.find((g) => g.upTo === Number.POSITIVE_INFINITY)
	const lasts = weeks <= 1 ? "less than a week" : weeks < 9 ? `${weeks} weeks` : weeks < 104 ? `${Math.round(weeks / 4.3)} months` : `${Math.round(weeks / 52)} years`
	return (
		<div className={`${WRAP} pt-4`}>
			<SectionHead
				title={q.count ? `Your queue lasts ${lasts}` : "No evenings planned"}
				note={q.count ? "The order is the plan. Move a title up and it moves closer in time. When you finish one, everything slides forward." : undefined}
				right={
					q.count > 0 ? (
						<div className="inline-flex rounded-full bg-white/10 p-1" role="radiogroup" aria-label="How often you watch">
							{PACES.map((p) => (
								<button
									key={p.n}
									type="button"
									role="radio"
									aria-checked={pace === p.n}
									onClick={() => setPace(p.n)}
									className={`h-8 rounded-full px-3 text-xs font-semibold cursor-pointer sm:text-sm ${pace === p.n ? "bg-white text-black" : "text-gray-300 hover:text-white"}`}
								>
									{p.label}
								</button>
							))}
						</div>
					) : undefined
				}
			/>
			<Landed q={q} className="mb-5" />
			<LayoutGroup>
				<ol className="relative">
					{groups.map((g, gi) => {
						const far = g.upTo > 92
						const shown = far ? g.titles.slice(0, g.upTo === Number.POSITIVE_INFINITY ? 14 : 20) : g.titles
						return (
							<li key={g.label} className="relative grid gap-3 border-l-2 border-white/10 pb-10 pl-5 md:grid-cols-[13rem_1fr] md:gap-6 md:border-l-0 md:pl-0">
								<span className={`absolute -left-[7px] top-2 h-3 w-3 rounded-full md:hidden ${gi === 0 ? "bg-amber-400" : "bg-gray-600"}`} />
								<div className="md:sticky md:top-20 md:self-start md:border-r-2 md:border-white/10 md:pr-6 md:text-right">
									<h3 className={`${DISPLAY} text-2xl leading-none md:text-3xl ${gi === 0 ? "text-amber-300" : far ? "text-gray-400" : "text-white"}`}>{g.label}</h3>
									<p className="mt-1 text-sm text-gray-400">
										#{q.pos(g.titles[0].t.key)}
										{g.titles.length > 1 ? ` to #${q.pos(g.titles[g.titles.length - 1].t.key)}` : ""}
										{`, ${g.titles.length} ${g.titles.length === 1 ? "title" : "titles"}`}
									</p>
								</div>
								<div className="min-w-0">
									<div className={`md:flex md:flex-wrap ${far ? "grid grid-cols-6 gap-1" : "grid grid-cols-3 gap-2"}`}>
										{shown.map(({ t }) => {
											const at = q.pos(t.key)
											const inHero = at <= HERO
											return (
												<motion.div layout="position" key={t.key} className={`group relative min-w-0 ${far ? "md:w-16" : "md:w-32"}`}>
													{far ? (
														<button type="button" onClick={() => onPeek(t)} className="block w-full cursor-pointer" title={`#${at} ${t.title}`}>
															<img src={posterUrl(t, "w92")} alt={t.title} loading="lazy" className="aspect-[2/3] w-full rounded-md object-cover opacity-70 hover:opacity-100" />
														</button>
													) : inHero ? (
														<button type="button" onClick={() => onPeek(t)} className="relative block w-full cursor-pointer">
															<img src={posterUrl(t, "w185")} alt={t.title} className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-white/10" />
															<span className="absolute bottom-1 left-1.5 text-white [text-shadow:0_2px_8px_#000]">
																<Rank n={at} className="text-3xl" />
															</span>
														</button>
													) : (
														<>
															<QPoster t={t} q={q} onOpen={onPeek} />
															<span className="pointer-events-none absolute left-2 top-1.5 z-20 text-white [text-shadow:0_2px_10px_#000]">
																<Rank n={at} className="text-3xl" />
															</span>
															<button
																type="button"
																onClick={() => q.move(t.key, Math.max(0, at - 1 - pace))}
																aria-label={`Move ${t.title} a week earlier`}
																title="A week earlier"
																className="mt-1 inline-flex h-7 w-full items-center justify-center gap-1 rounded-md bg-white/5 text-xs font-semibold text-gray-200 hover:bg-amber-400 hover:text-black cursor-pointer"
															>
																<ArrowUpIcon className="h-3.5 w-3.5 shrink-0" />
																<span className="md:hidden">Sooner</span>
																<span className="hidden md:inline">A week sooner</span>
															</button>
														</>
													)}
												</motion.div>
											)
										})}
										{g.titles.length > shown.length && (
											<span className={`flex aspect-[2/3] items-center justify-center rounded-md bg-white/5 text-center text-xs font-semibold text-gray-300 ${far ? "md:w-16" : "md:w-32"}`}>+{g.titles.length - shown.length}</span>
										)}
									</div>
									{gi === 0 && q.count > HERO && <p className="mt-2 text-xs text-gray-500">These are the ones in the hero above.</p>}
									{g === someday && g.titles.some(({ t }) => (t.match ?? 0) < 72) && (
										<div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
											<p className="min-w-0 flex-1 text-sm text-gray-300">
												At this pace you would reach these in over a year. Keep the ones you really want and let the rest go.
											</p>
											<button type="button" onClick={() => q.letGo(g.titles.filter(({ t }) => (t.match ?? 0) < 72).map(({ t }) => t.key))} className="h-9 rounded-lg bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20 cursor-pointer">
												Let go of the {g.titles.filter(({ t }) => (t.match ?? 0) < 72).length} weaker matches
											</button>
										</div>
									)}
								</div>
							</li>
						)
					})}
				</ol>
			</LayoutGroup>
			{q.count > 0 && q.count < SHORT && (
				<p className="-mt-4 mb-8 flex items-center gap-2 text-sm text-gray-400">
					<PlayIcon className="h-4 w-4 text-amber-300" />
					After that, nothing planned.
				</p>
			)}
			<SuggestShelf q={q} onOpen={onPeek} />
		</div>
	)
}

