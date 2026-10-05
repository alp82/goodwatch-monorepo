// PROTOTYPE - throwaway. The "existing components" variants of the ordered Wishlist (#176, round 3):
// a ranked list, a numbered poster grid, auto-placement with a "placed at #7" moment, and sort proposals
// with pruning. Each sits under the unchanged start hero, which already shows #1 to #5.
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon, PlayIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { LayoutGroup, Reorder, motion } from "framer-motion"
import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { QItem } from "~/ui/prototype-rec-watch-next/kit"
import { posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, ageLabel, onMine } from "~/ui/prototype-rec-watch-next-2/model"
import { Btn, Landed, Match, QPoster, QRow, Rank, SHORT, SectionHead, SuggestShelf, WRAP } from "./kit3"
import { HERO, type Queue, SORTS, type SortKey } from "./model"

export type VariantProps = { q: Queue; onPeek: (t: WTitle) => void }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function span(q: Queue) {
	if (!q.count) return ""
	const oldest = Math.min(...q.order.map((k) => q.addedAt(k)))
	return `added over ${ageLabel(oldest, q.now).replace(" ago", "")}`
}

// When the queue fits in the hero, below it there is only room to grow.
function OnlyHero({ q }: { q: Queue }) {
	if (q.count === 0) return null
	return <p className="text-sm text-gray-400">{q.count === 1 ? "Your queue is one title: the one above." : `All ${q.count} titles in your queue are in the hero above.`}</p>
}

// ------------------------------------------------------------------ collapsed long tail

// The part of the queue nobody needs to see every day: collapsed to a count, opened on demand, searchable,
// and shown 30 at a time so hundreds of titles stay light.
export function Tail({ q, from, onPeek, row }: { q: Queue; from: number; onPeek: (t: WTitle) => void; row?: (t: WTitle) => React.ReactNode }) {
	const [open, setOpen] = useState(false)
	const [find, setFind] = useState("")
	const [shown, setShown] = useState(30)
	const tail = q.titles.slice(from)
	if (!tail.length) return null
	const hits = find ? tail.filter((t) => t.title.toLowerCase().includes(find.toLowerCase())) : tail
	return (
		<section className="mt-6" aria-label="The rest of your Wishlist">
			<button
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left hover:bg-white/[0.06] cursor-pointer"
			>
				<div className="flex -space-x-5">
					{tail.slice(0, 5).map((t) => (
						<img key={t.key} src={posterUrl(t, "w92")} alt="" className="h-14 w-10 rounded-md object-cover ring-2 ring-gray-900" />
					))}
				</div>
				<div className="min-w-0 flex-1">
					<p className="font-bold text-white">
						{plural(tail.length, "more title")}, #{from + 1} to #{q.count}
					</p>
					<p className="truncate text-xs text-gray-400">{span(q)}. In your order; move any of them up when you want it sooner.</p>
				</div>
				<ChevronRightIcon className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} />
			</button>
			{open && (
				<div className="mt-3">
					<label className="mb-3 flex h-10 items-center gap-2 rounded-lg bg-white/5 px-3 ring-1 ring-white/10 focus-within:ring-amber-400/60">
						<MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
						<input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find in your Wishlist" className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none" />
					</label>
					<div className="grid gap-1.5 md:grid-cols-2">
						{hits.slice(0, shown).map((t) => (
							<div key={t.key}>
								{row ? (
									row(t)
								) : (
									<QRow
										q={q}
										t={t}
										onOpen={onPeek}
										meta={`${ageLabel(q.addedAt(t.key), q.now)}, ${onMine(t) ? t.offers.find((o) => o.owned)?.name : "not on your services"}`}
										actions={
											<>
												<Btn onClick={() => q.move(t.key, from - 1)} label={`Move ${t.title} up to #${from}`}>
													<ArrowUpIcon className="h-4 w-4" />
													<span className="hidden sm:inline">#{from}</span>
												</Btn>
												<Btn onClick={() => q.toTop(t.key)} label={`Play ${t.title} next`} tone="amber">
													<PlayIcon className="h-4 w-4" />
												</Btn>
											</>
										}
									/>
								)}
							</div>
						))}
					</div>
					{hits.length > shown && (
						<button type="button" onClick={() => setShown(shown + 30)} className="mt-3 h-10 w-full rounded-lg bg-white/5 text-sm font-semibold text-gray-200 hover:bg-white/10 cursor-pointer">
							Show 30 more of {hits.length - shown}
						</button>
					)}
					{find && !hits.length && <p className="text-sm text-gray-400">Nothing called “{find}” in your Wishlist.</p>}
				</div>
			)}
		</section>
	)
}

// ============================================================ 1. Ranked list

// The plain ordered list. The hero holds #1 to #5; below it the next ten are a draggable list with
// quick moves, and everything after that folds into one line. New titles join at the bottom.
export function Ranked({ q, onPeek }: VariantProps) {
	const HEAD = 10
	const head = q.titles.slice(HERO, HERO + HEAD)
	const keys = head.map((t) => t.key)
	return (
		<div className={`${WRAP} pt-4`}>
			<SectionHead
				title={q.count > HERO ? "After the top five" : "Your queue"}
				note={q.count > HERO ? "Drag to reorder, or use the arrows. New titles join at the bottom; move them up when you want them sooner." : undefined}
			/>
			<Landed q={q} className="mb-4" />
			{q.count <= HERO && <OnlyHero q={q} />}
			{head.length > 0 && (
				<Reorder.Group axis="y" values={keys} onReorder={(k) => q.reorderWishlist([...q.order.slice(0, HERO), ...k, ...q.order.slice(HERO + k.length)])} className="flex flex-col gap-1.5">
					{head.map((t, i) => (
						<QItem key={t.key} store={q} k={t.key} index={HERO + i} label={t.title} className="rounded-lg" gripClassName="left-0.5 top-1/2 -translate-y-1/2 h-9 w-6">
							<QRow
								q={q}
								t={t}
								onOpen={onPeek}
								actions={
									<>
										<Btn onClick={() => q.bump(t.key, -1)} label={`Move ${t.title} up one`}>
											<ArrowUpIcon className="h-4 w-4" />
										</Btn>
										<Btn onClick={() => q.toTop(t.key)} label={`Play ${t.title} next`} tone="amber">
											<PlayIcon className="h-4 w-4" />
											<span className="hidden sm:inline">Play next</span>
										</Btn>
										<Btn onClick={() => q.watched(t.key)} label={`I watched ${t.title}`} className="hidden sm:inline-flex">
											<CheckIcon className="h-4 w-4 text-green-400" />
										</Btn>
										<Btn onClick={() => q.remove(t.key)} label={`Remove ${t.title}`} tone="ghost" className="hidden sm:inline-flex">
											<XMarkIcon className="h-4 w-4" />
										</Btn>
									</>
								}
							/>
						</QItem>
					))}
				</Reorder.Group>
			)}
			<Tail q={q} from={HERO + HEAD} onPeek={onPeek} />
			<SuggestShelf q={q} onOpen={onPeek} className="mt-10" />
		</div>
	)
}

// ============================================================ 2. Numbered posters

// The queue as a poster wall in order, every poster wearing its number. Nudge with the arrows under it,
// drag one onto another with a mouse, or send it straight to #1.
export function Posters({ q, onPeek }: VariantProps) {
	const [shown, setShown] = useState(18)
	const [drag, setDrag] = useState<string | null>(null)
	const [over, setOver] = useState<string | null>(null)
	const rest = q.titles.slice(HERO)
	return (
		<div className={`${WRAP} pt-4`}>
			<SectionHead title={q.count > HERO ? "After the top five" : "Your queue"} note={q.count > HERO ? "Your Wishlist in order. New titles join at the end." : undefined} />
			<Landed q={q} className="mb-4" />
			<SuggestShelf q={q} onOpen={onPeek} className="mb-8" />
			{q.count <= HERO && q.count >= SHORT && <OnlyHero q={q} />}
			{rest.length > 0 && (
				<LayoutGroup>
					<div className="grid grid-cols-3 gap-x-1 gap-y-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
						{rest.slice(0, shown).map((t) => {
							const at = q.pos(t.key)
							return (
								<motion.div layout="position" key={t.key}>
								<div
									draggable
									onDragStart={(e) => {
										setDrag(t.key)
										e.dataTransfer.setData("text/plain", t.key)
									}}
									onDragEnd={() => {
										setDrag(null)
										setOver(null)
									}}
									onDragOver={(e) => {
										e.preventDefault()
										setOver(t.key)
									}}
									onDrop={(e) => {
										e.preventDefault()
										if (drag && drag !== t.key) q.move(drag, at - 1)
										setDrag(null)
										setOver(null)
									}}
									className={`relative rounded-xl ${over === t.key && drag !== t.key ? "ring-2 ring-amber-400" : ""} ${drag === t.key ? "opacity-40" : ""}`}
								>
									<span className="pointer-events-none absolute -left-1 -top-2 z-20 text-white [text-shadow:0_2px_12px_#000,0_0_2px_#000]">
										<Rank n={at} className="text-4xl md:text-5xl" />
									</span>
									<QPoster t={t} q={q} onOpen={onPeek} />
									<div className="mt-1 flex items-center justify-between gap-1 px-1">
										<button type="button" onClick={() => q.bump(t.key, -1)} aria-label={`Move ${t.title} earlier`} className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer">
											<ChevronLeftIcon className="h-4 w-4" />
										</button>
										<button type="button" onClick={() => q.toTop(t.key)} aria-label={`Play ${t.title} next`} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold text-amber-300 hover:bg-amber-400 hover:text-black cursor-pointer">
											<PlayIcon className="h-3.5 w-3.5" />
											Next
										</button>
										<button type="button" onClick={() => q.bump(t.key, 1)} aria-label={`Move ${t.title} later`} className="rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer">
											<ChevronRightIcon className="h-4 w-4" />
										</button>
									</div>
								</div>
								</motion.div>
							)
						})}
					</div>
				</LayoutGroup>
			)}
			{rest.length > shown && (
				<button type="button" onClick={() => setShown(shown + 36)} className="mt-6 h-11 w-full rounded-lg bg-white/5 text-sm font-semibold text-gray-200 hover:bg-white/10 cursor-pointer">
					Show #{HERO + shown + 1} to #{Math.min(q.count, HERO + shown + 36)} of {q.count}
				</button>
			)}
		</div>
	)
}

// ============================================================ 3. Auto-placed

// New titles don't sink to the bottom: each one is slotted by taste match and whether you can stream it,
// and the page shows where it went and why, with one tap to change it.
export function AutoPlaced({ q, onPeek }: VariantProps) {
	const rail = q.titles.slice(HERO, HERO + 20)
	const ref = useRef<HTMLDivElement>(null)
	const l = q.landed
	useEffect(() => {
		if (!l) return
		const el = ref.current?.querySelector(`[data-rail="${l.key}"]`) as HTMLElement | null
		if (el && ref.current) ref.current.scrollTo({ left: el.offsetLeft - 24, behavior: "smooth" })
	}, [l?.n])
	return (
		<div className={`${WRAP} pt-4`}>
			<SectionHead
				title={q.count > HERO ? "After the top five" : "Your queue"}
				note="Titles you add find their own place: higher for strong matches on your services, lower for the rest. Never above #2."
			/>
			<Landed q={q} className="mb-5" />
			{q.count <= HERO && q.count >= SHORT && <OnlyHero q={q} />}
			{rail.length > 0 && (
				<div ref={ref} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-3 pt-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
					{rail.map((t) => {
						const at = q.pos(t.key)
						const fresh = l?.key === t.key
						return (
							<div key={t.key} data-rail={t.key} className="flex shrink-0 snap-start items-end">
								<Rank n={at} className={`-mr-3 text-[5.5rem] md:text-[7.5rem] ${fresh ? "text-amber-400" : "text-transparent [-webkit-text-stroke:2px_rgba(255,255,255,.35)]"}`} />
								<motion.div
									initial={fresh ? { y: -24, opacity: 0 } : false}
									animate={{ y: 0, opacity: 1 }}
									transition={{ type: "spring", stiffness: 220, damping: 20 }}
									className={`relative w-[7.5rem] md:w-[9.5rem] ${fresh ? "rounded-xl ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-900" : ""}`}
								>
									<QPoster t={t} q={q} onOpen={onPeek} how="auto" meta={at > 2 ? <Match t={t} /> : undefined} />
									{at > 2 && (
										<button type="button" onClick={() => q.bump(t.key, -1)} aria-label={`Move ${t.title} earlier`} className="absolute left-2 top-2 z-10 rounded-full bg-black/70 p-1.5 text-white backdrop-blur hover:bg-amber-400 hover:text-black cursor-pointer">
											<ArrowUpIcon className="h-3.5 w-3.5 -rotate-90" />
										</button>
									)}
								</motion.div>
							</div>
						)
					})}
				</div>
			)}
			<Tail q={q} from={HERO + 20} onPeek={onPeek} />
			<SuggestShelf q={q} onOpen={onPeek} how="auto" className="mt-10" />
		</div>
	)
}

// ============================================================ 4. Sort for tonight

// Leave the order alone most days; when it has drifted, one tap proposes a new one to accept or ignore.
// Titles you added long ago and match weakly get asked about instead of piling up.
export function SortTonight({ q, onPeek }: VariantProps) {
	const [by, setBy] = useState<SortKey | null>(null)
	const proposal = useMemo(() => (by ? q.sorted(by) : null), [by, q.order])
	const moved = proposal ? proposal.slice(0, 8).filter((k, i) => q.order.indexOf(k) !== i).length : 0
	const stale = q.stale()
	const [pruneShown, setPruneShown] = useState(6)
	const accept = () => {
		if (!proposal || !by) return
		q.setOrder(proposal, `Sorted ${SORTS.find((s) => s.key === by)!.label.toLowerCase()}. ${q.T(proposal[0])?.title} is up next.`)
		setBy(null)
	}
	return (
		<div className={`${WRAP} pt-4`}>
			{q.count >= 2 && <SectionHead title="Reorder in one tap" note="Pick what matters tonight. You see the new order before anything changes." />}
			<Landed q={q} className="mb-5" />
			<SuggestShelf q={q} onOpen={onPeek} className="mb-8" />
			{q.count >= 2 && (
				<>
					<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
						{SORTS.map((s) => (
							<button
								key={s.key}
								type="button"
								onClick={() => setBy(by === s.key ? null : s.key)}
								aria-pressed={by === s.key}
								className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold cursor-pointer ${by === s.key ? "bg-white text-black" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}
							>
								{s.label}
							</button>
						))}
					</div>
					{proposal && by && (
						<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
							<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
								<div>
									<p className="font-bold text-white">{SORTS.find((s) => s.key === by)!.note}</p>
									<p className="text-sm text-gray-400">{moved ? `${plural(moved, "title")} in your top 8 would change place.` : "Your top 8 already follows this order."}</p>
								</div>
								<div className="flex gap-2">
									<button type="button" onClick={accept} disabled={!moved} className="h-11 rounded-lg bg-amber-400 px-5 font-bold text-black hover:bg-amber-300 disabled:opacity-40 cursor-pointer">
										Use this order
									</button>
									<button type="button" onClick={() => setBy(null)} className="h-11 rounded-lg bg-white/10 px-4 font-semibold text-white hover:bg-white/20 cursor-pointer">
										Keep mine
									</button>
								</div>
							</div>
							<ol className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
								{proposal.slice(0, 8).map((k, i) => {
									const t = q.T(k)!
									const was = q.order.indexOf(k)
									const d = was - i
									return (
										<li key={k} className="min-w-0">
											<button type="button" onClick={() => onPeek(t)} className="relative block w-full cursor-pointer">
												<img src={posterUrl(t, "w185")} alt={t.title} className={`aspect-[2/3] w-full rounded-lg object-cover ${d ? "" : "opacity-50"}`} />
												<span className="absolute bottom-1 left-1.5 text-white [text-shadow:0_2px_8px_#000]">
													<Rank n={i + 1} className="text-3xl" />
												</span>
											</button>
											<p className={`mt-1 truncate text-xs font-semibold ${d > 0 ? "text-green-400" : d < 0 ? "text-rose-300" : "text-gray-500"}`}>
												{d > 0 ? (
													<>
														<ArrowUpIcon className="inline h-3 w-3" /> from #{was + 1}
													</>
												) : d < 0 ? (
													<>
														<ArrowDownIcon className="inline h-3 w-3" /> from #{was + 1}
													</>
												) : (
													"Same place"
												)}
											</p>
										</li>
									)
								})}
							</ol>
						</motion.div>
					)}
				</>
			)}
			{q.count > 0 && q.count <= HERO && q.count >= SHORT && <OnlyHero q={q} />}

			{stale.length > 0 && (
				<section className="mt-10" aria-label="Titles to let go">
					<div className="mb-3 flex flex-wrap items-end justify-between gap-2">
						<div>
							<h3 className="text-lg font-bold text-white md:text-xl">Still want these?</h3>
							<p className="text-sm text-gray-400">{plural(stale.length, "title")} you added over 18 months ago that match you less well. Letting go keeps the queue honest.</p>
						</div>
						<button type="button" onClick={() => q.letGo(stale.map((t) => t.key))} className="h-9 rounded-lg bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20 cursor-pointer">
							Let go of all {stale.length}
						</button>
					</div>
					<div className="grid gap-1.5 md:grid-cols-2">
						{stale.slice(0, pruneShown).map((t) => (
							<QRow
								key={t.key}
								q={q}
								t={t}
								onOpen={onPeek}
								meta={`Added ${ageLabel(q.addedAt(t.key), q.now)}${t.match ? `, ${t.match}% match` : ""}`}
								actions={
									<>
										<Btn onClick={() => q.keep(t.key)} label={`Keep ${t.title}`}>
											Keep
										</Btn>
										<Btn onClick={() => q.letGo([t.key])} label={`Let go of ${t.title}`} tone="ghost">
											Let go
										</Btn>
									</>
								}
							/>
						))}
					</div>
					{stale.length > pruneShown && (
						<button type="button" onClick={() => setPruneShown(pruneShown + 12)} className="mt-3 text-sm font-semibold text-amber-300 hover:underline cursor-pointer">
							Show {Math.min(12, stale.length - pruneShown)} more
						</button>
					)}
				</section>
			)}
			<Tail q={q} from={HERO} onPeek={onPeek} />
		</div>
	)
}
