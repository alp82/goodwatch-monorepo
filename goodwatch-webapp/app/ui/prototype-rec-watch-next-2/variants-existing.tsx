// PROTOTYPE - throwaway. The "existing components" variants for growing and managing the Wishlist (#176, round 2).
// Each one sits under the kept top (start hero or Tonight) and handles a near-empty Wishlist and one with hundreds.
import { BookmarkIcon, CheckIcon, QueueListIcon, TrashIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import type React from "react"
import { forwardRef, useState } from "react"
import { type Title, ownedOffers } from "~/ui/prototype-rec-watch-next/model"
import { CineRow, FlowBar, IconBtn, PipelineCard, Rail, RailItem, StageButton, TitleRow, Why, XMarkIcon } from "./kit2"
import { type LoaderData, MOOD_LABEL, type Mood, SORTS, type SortKey, type Store2, type WTitle, ageLabel, onMine } from "./model"

export type VariantProps = { store: Store2; data: LoaderData; onPeek: (t: Title) => void }
export const GROW_BELOW = 20
const WRAP = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"

function Head({ store, title, note, suggested }: { store: Store2; title: string; note: string; suggested?: number }) {
	return (
		<header className="mb-6 flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-end md:justify-between">
			<div className="min-w-0">
				<h2 className="text-2xl font-bold text-white md:text-3xl">{title}</h2>
				<p className="mt-1 max-w-2xl text-sm text-gray-400">{note}</p>
			</div>
			<FlowBar store={store} suggested={suggested} className="shrink-0" />
		</header>
	)
}

// ============================================================ 1. Shelves

// Rows that change with the size of the list: suggestion rows while it is small, backlog rows once it is big.
export function Shelves({ store, onPeek }: VariantProps) {
	const n = store.wishCount
	const big = n >= GROW_BELOW
	const card = (t: WTitle, kind: Parameters<typeof Why>[0]["kind"]) => (
		<RailItem key={t.key}>
			<PipelineCard t={t} store={store} onOpen={onPeek} meta={<Why t={t} store={store} kind={kind} />} />
		</RailItem>
	)
	const because = store.suggest.because(big ? 1 : 3)
	const fresh = store.suggest.fresh(16)
	const forYou = store.suggest.forYou(16)
	const tonight = store.backlog.tonight()
	const forgotten = store.backlog.forgotten()
	const leaving = store.backlog.leaving()
	const short = tonight.filter((t) => t.type === "movie" && (t.runtime ?? 999) <= 100)
	return (
		<div className={`${WRAP} space-y-8 pt-4`}>
			<Head
				store={store}
				title={big ? `${n} titles on your Wishlist` : n ? "Your Wishlist is getting started" : "Start your Wishlist"}
				note={
					big
						? "Rows sort your backlog by what you can watch tonight. The button on each poster moves it one step: Want to See, then Watch next."
						: "Tap Want to See on anything that looks good. Each add brings a new row of titles like it."
				}
				suggested={forYou.length + fresh.length}
			/>
			{!big && n > 0 && (
				<Rail title="On your Wishlist" note="Move the one you want soonest up to Watch next.">
					{[...store.queueTitles, ...store.wishTitles].map((t) => card(t as WTitle, "service"))}
				</Rail>
			)}
			{big && (
				<>
					<Rail title={`Ready tonight on your services (${tonight.length})`} note="Your Wishlist, best taste match first.">
						{tonight.slice(0, 24).map((t) => card(t, "match"))}
					</Rail>
					{leaving.length > 0 && (
						<Rail title="Leaving your services soon" note="Watch these before they go.">
							{leaving.map((t) => card(t, "leaving"))}
						</Rail>
					)}
					{forgotten.length > 0 && (
						<Rail title="Forgotten gems" note="Added more than a year ago and still a strong match.">
							{forgotten.slice(0, 24).map((t) => card(t, "added"))}
						</Rail>
					)}
					{short.length > 0 && (
						<Rail title="Under 100 minutes" note="Films from your Wishlist that fit a weeknight.">
							{short.slice(0, 24).map((t) => card(t, "runtime"))}
						</Rail>
					)}
				</>
			)}
			{because.map((b) => (
				<Rail key={b.seed.key} title={`Because you added ${b.seed.title}`}>
					{b.titles.map((t) => card(t, "match"))}
				</Rail>
			))}
			{fresh.length > 0 && (
				<Rail title="New on your services" note="Arrived in the last 30 days.">
					{fresh.map((t) => card(t, "new"))}
				</Rail>
			)}
			{!big && (
				<Rail title="Picked for your taste" note="Best matches for your ratings, on your services first.">
					{forYou.map((t) => card(t, "match"))}
				</Rail>
			)}
		</div>
	)
}

// ============================================================ 2. Backlog grid

// The Wishlist as the familiar poster grid with the sorts that answer "what now": services, match, runtime, age.
export function Backlog({ store, onPeek }: VariantProps) {
	const [sort, setSort] = useState<SortKey>("tonight")
	const [mine, setMine] = useState(false)
	const [mood, setMood] = useState<Mood | null>(null)
	const [limit, setLimit] = useState(30)
	const n = store.wishCount
	const all = store.backlog.sort(store.wishTitles, sort).filter((t) => (!mine || onMine(t)) && (!mood || t.moods.includes(mood)))
	const shown = all.slice(0, limit)
	const fill = n < GROW_BELOW ? store.suggest.because(1)[0]?.titles.slice(0, 6).concat(store.suggest.forYou(12)).filter((t, i, a) => a.findIndex((x) => x.key === t.key) === i).slice(0, 12) ?? store.suggest.forYou(12) : []
	const meta = (t: WTitle) => <Why t={t} store={store} kind={sort === "short" ? "runtime" : sort === "added" || sort === "oldest" ? "added" : sort === "tonight" ? "service" : "match"} />
	const chip = (on: boolean) => `h-8 shrink-0 rounded-full px-3 text-sm font-semibold cursor-pointer transition-colors ${on ? "bg-white text-black" : "bg-white/10 text-gray-200 hover:bg-white/20"}`
	return (
		<div className={`${WRAP} pt-4`}>
			<Head
				store={store}
				title={n ? `Wishlist (${n})` : "Wishlist"}
				note={n >= GROW_BELOW ? "Sort the backlog by what fits tonight. Promote a title to Watch next from its poster." : "A short list. Suggestions fill the rest of the grid; tap Want to See to keep one."}
				suggested={fill.length || undefined}
			/>
			{n > 0 && (
				<div className="sticky top-16 z-20 -mx-4 mb-4 flex flex-col gap-2 bg-gray-900/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
					<div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
						{SORTS.map((s) => (
							<button key={s.key} type="button" onClick={() => setSort(s.key)} className={chip(sort === s.key)}>
								{s.label}
							</button>
						))}
					</div>
					<div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
						<button type="button" onClick={() => setMine(!mine)} className={chip(mine)}>
							{mine && <CheckIcon className="-ml-1 mr-1 inline h-4 w-4" />}
							Only on my services
						</button>
						{(Object.keys(MOOD_LABEL) as Mood[]).map((m) => (
							<button key={m} type="button" onClick={() => setMood(mood === m ? null : m)} className={chip(mood === m)}>
								{MOOD_LABEL[m]}
							</button>
						))}
					</div>
				</div>
			)}
			<div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
				{shown.map((t) => (
					<PipelineCard key={t.key} t={t} store={store} onOpen={onPeek} meta={meta(t)} />
				))}
				{store.queueTitles.length > 0 && n < GROW_BELOW && (store.queueTitles as WTitle[]).map((t) => <PipelineCard key={t.key} t={t} store={store} onOpen={onPeek} meta="In Watch next" />)}
			</div>
			{all.length > limit && (
				<button type="button" onClick={() => setLimit(limit + 60)} className="mt-4 h-11 w-full rounded-lg bg-white/10 font-semibold text-white hover:bg-white/20 cursor-pointer">
					Show {Math.min(60, all.length - limit)} more of {all.length}
				</button>
			)}
			{n > 0 && !all.length && <p className="py-10 text-center text-gray-400">Nothing on your Wishlist fits these filters.</p>}
			{fill.length > 0 && (
				<>
					<h3 className="mb-2 mt-8 text-lg font-bold text-white">{n ? "More like what you added" : "Pick a few to start"}</h3>
					<div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
						{fill.map((t) => (
							<PipelineCard key={t.key} t={t} store={store} onOpen={onPeek} meta={<Why t={t} store={store} kind="match" />} />
						))}
					</div>
				</>
			)}
		</div>
	)
}

// ============================================================ 3. By service

// One band per service you pay for: what is waiting there, then what just arrived there.
export function ByService({ store, data, onPeek }: VariantProps) {
	const { groups, elsewhere } = store.backlog.byService()
	const [openElse, setOpenElse] = useState(false)
	const n = store.wishCount
	const extras = [...store.suggest.fresh(60), ...store.suggest.popular(80)]
	const bands = data.services
		.map((s) => {
			const g = groups.find((x) => x.name === s.name)
			const titles = g ? g.titles.sort((a, b) => (b.match ?? 0) - (a.match ?? 0)) : []
			const more = extras.filter((t, i, a) => ownedOffers(t)[0]?.name === s.name && a.findIndex((x) => x.key === t.key) === i).slice(0, 12)
			return { ...s, titles, more }
		})
		.filter((b) => b.titles.length || b.more.length)
		.sort((a, b) => b.titles.length - a.titles.length)
	return (
		<div className={`${WRAP} pt-4`}>
			<Head
				store={store}
				title="Your Wishlist by service"
				note={n ? "What is waiting on each service you pay for, then what just arrived there." : "Nothing saved yet. Here is what is worth watching on each service you pay for."}
			/>
			<div className="space-y-4">
				{bands.map((b) => (
					<section key={b.name} className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[11rem_1fr] md:p-4">
						<div className="flex items-center gap-3 md:flex-col md:items-start">
							<img src={b.logo} alt="" className="h-12 w-12 rounded-xl md:h-16 md:w-16" />
							<div>
								<h3 className="text-lg font-bold text-white">{b.name}</h3>
								<p className="text-sm text-gray-400">{b.titles.length ? `${b.titles.length} on your Wishlist` : "Nothing saved here yet"}</p>
								{b.titles.some((t) => t.leavingInDays != null) && <p className="text-sm text-rose-300">{b.titles.filter((t) => t.leavingInDays != null).length} leaving soon</p>}
							</div>
						</div>
						<div className="-mx-3 flex min-w-0 gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
							{b.titles.slice(0, 30).map((t) => (
								<RailItem key={t.key}>
									<PipelineCard t={t} store={store} onOpen={onPeek} meta={t.leavingInDays != null ? <Why t={t} store={store} kind="leaving" /> : <Why t={t} store={store} kind="match" />} />
								</RailItem>
							))}
							{b.more.length > 0 && (
								<div className="flex shrink-0 items-center px-2" aria-hidden="true">
									<span className="w-24 text-center text-xs font-semibold text-gray-400 [writing-mode:vertical-rl] rotate-180">{b.titles.length ? "Also worth adding" : "Worth adding"}</span>
								</div>
							)}
							{b.more.map((t) => (
								<RailItem key={t.key}>
									<PipelineCard t={t} store={store} onOpen={onPeek} meta={t.newOnMine ? <Why t={t} store={store} kind="new" /> : <Why t={t} store={store} kind="match" />} />
								</RailItem>
							))}
						</div>
					</section>
				))}
				{elsewhere.length > 0 && (
					<section className="rounded-2xl border border-white/10 p-3 md:p-4">
						<button type="button" onClick={() => setOpenElse(!openElse)} className="flex w-full items-center justify-between text-left cursor-pointer">
							<span>
								<span className="text-lg font-bold text-white">Not on your services ({elsewhere.length})</span>
								<span className="block text-sm text-gray-400">Rent, buy, or wait for them to arrive.</span>
							</span>
							<span className="text-sm font-semibold text-amber-300">{openElse ? "Hide" : "Show"}</span>
						</button>
						{openElse && (
							<div className="mt-3 grid grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-8">
								{elsewhere.slice(0, 80).map((t) => (
									<PipelineCard key={t.key} t={t} store={store} onOpen={onPeek} meta={t.offers[0] ? `On ${t.offers[0].name}` : "Not streaming"} />
								))}
							</div>
						)}
					</section>
				)}
			</div>
		</div>
	)
}

// ============================================================ 4. Pipeline

type Col = "suggested" | "wishlist" | "next"

const PRow = forwardRef<HTMLDivElement, { t: WTitle; store: Store2; onPeek: (t: Title) => void; meta?: React.ReactNode; actions?: React.ReactNode; className?: string }>(function PRow({ t, onPeek, meta, actions, className = "" }, ref) {
	return (
		<motion.div ref={ref} layout layoutId={`pl-${t.key}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: 30 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}>
			<CineRow t={t} onOpen={onPeek} meta={meta} actions={actions} accent={className.includes("amber")} />
		</motion.div>
	)
})

// Three lanes side by side. A title visibly slides from Suggested to Wishlist to Watch next.
export function Pipeline({ store, onPeek }: VariantProps) {
	const [tab, setTab] = useState<Col>(store.wishCount >= GROW_BELOW ? "wishlist" : "suggested")
	const [source, setSource] = useState<"for-you" | "because" | "new">("for-you")
	const [sort, setSort] = useState<SortKey>("tonight")
	const [limit, setLimit] = useState(25)
	const because = store.suggest.because(1)[0]
	const sugg = source === "because" && because ? because.titles : source === "new" ? store.suggest.fresh(16) : store.suggest.forYou(16)
	const wish = store.backlog.sort(store.wishTitles, sort)
	const stale = store.backlog.stale()
	const q = store.queueTitles as WTitle[]
	const lane = (c: Col) => `${tab === c ? "flex" : "hidden"} min-w-0 flex-col gap-2 md:flex`
	const tabs: { c: Col; label: string; n: number }[] = [
		{ c: "suggested", label: "Suggested", n: sugg.length },
		{ c: "wishlist", label: "Wishlist", n: store.state.wishlist.length },
		{ c: "next", label: "Watch next", n: q.length },
	]
	return (
		<div className={`${WRAP} pt-4`}>
			<Head store={store} title="From suggestion to tonight" note="Three lanes, left to right. Want to See moves a title into your Wishlist; the arrow moves it up to Watch next." suggested={sugg.length} />
			<div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1 md:hidden" role="tablist">
				{tabs.map((x) => (
					<button key={x.c} type="button" role="tab" aria-selected={tab === x.c} onClick={() => setTab(x.c)} className={`h-10 rounded-lg text-sm font-semibold cursor-pointer ${tab === x.c ? "bg-white text-black" : "text-gray-300"}`}>
						{x.label} <span className="tabular-nums opacity-70">{x.n}</span>
					</button>
				))}
			</div>
			<LayoutGroup>
				<div className="grid gap-4 md:grid-cols-3">
					<div className={lane("suggested")}>
						<h3 className="hidden text-sm font-semibold text-gray-300 md:block">Suggested</h3>
						<div className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
							{(
								[
									["for-you", "For your taste"],
									["because", because ? `Like ${because.seed.title}` : "Like your adds"],
									["new", "New on your services"],
								] as const
							).map(([k, label]) => (
								<button key={k} type="button" onClick={() => setSource(k)} className={`h-8 max-w-[12rem] shrink-0 truncate rounded-full px-3 text-xs font-semibold cursor-pointer ${source === k ? "bg-white text-black" : "bg-white/10 text-gray-200"}`}>
									{label}
								</button>
							))}
						</div>
						<AnimatePresence mode="popLayout" initial={false}>
							{sugg.slice(0, 10).map((t) => (
								<PRow store={store} onPeek={onPeek}
									key={t.key}
									t={t}
									meta={<Why t={t} store={store} kind={source === "new" ? "new" : "match"} />}
									actions={
										<>
											<IconBtn onClick={() => store.dismiss(t.key)} label={`Not interested in ${t.title}`}>
												<XMarkIcon className="h-4 w-4" />
											</IconBtn>
											<IconBtn tone="amber" onClick={() => store.want(t.key)} label={`Want to See ${t.title}`}>
												<BookmarkIcon className="h-4 w-4" />
												<span className="hidden lg:inline">Want</span>
											</IconBtn>
										</>
									}
								/>
							))}
						</AnimatePresence>
					</div>

					<div className={lane("wishlist")}>
						<div className="hidden items-baseline justify-between md:flex">
							<h3 className="text-sm font-semibold text-gray-300">Wishlist ({store.state.wishlist.length})</h3>
						</div>
						{store.state.wishlist.length > 1 && (
							<select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="h-9 rounded-lg border border-white/10 bg-gray-800 px-2 text-sm text-white" aria-label="Sort Wishlist">
								{SORTS.map((s) => (
									<option key={s.key} value={s.key}>
										{s.label}
									</option>
								))}
							</select>
						)}
						{stale[0] && (
							<div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-2">
								<p className="mb-1.5 px-1 text-xs font-semibold text-amber-200">
									Still want to see this? {stale.length} titles are over 18 months old.
								</p>
								<TitleRow
									t={stale[0]}
									store={store}
									onOpen={onPeek}
									className="border-none bg-transparent p-0"
									meta={`Added ${ageLabel(store.addedAt(stale[0].key) ?? store.now, store.now)}. ${stale[0].match ?? "?"}% match`}
									actions={
										<>
											<IconBtn tone="rose" onClick={() => store.unwant(stale[0].key)} label={`Remove ${stale[0].title}`}>
												<TrashIcon className="h-4 w-4" />
											</IconBtn>
											<IconBtn onClick={() => store.keep(stale[0].key)} label={`Keep ${stale[0].title}`}>
												Keep
											</IconBtn>
										</>
									}
								/>
							</div>
						)}
						{!wish.length && <p className="rounded-lg border-2 border-dashed border-white/10 p-6 text-center text-sm text-gray-500">Want to See something on the left and it lands here.</p>}
						<AnimatePresence mode="popLayout" initial={false}>
							{wish.slice(0, limit).map((t) => (
								<PRow store={store} onPeek={onPeek}
									key={t.key}
									t={t}
									meta={<Why t={t} store={store} kind={sort === "short" ? "runtime" : sort === "added" || sort === "oldest" ? "added" : sort === "tonight" ? "service" : "match"} />}
									actions={
										<>
											<IconBtn onClick={() => store.unwant(t.key)} label={`Remove ${t.title} from Wishlist`}>
												<XMarkIcon className="h-4 w-4" />
											</IconBtn>
											<IconBtn tone="amber" onClick={() => store.add(t.key)} label={`Move ${t.title} up to Watch next`}>
												<QueueListIcon className="h-4 w-4" />
												<span className="hidden lg:inline">Next</span>
											</IconBtn>
										</>
									}
								/>
							))}
						</AnimatePresence>
						{wish.length > limit && (
							<button type="button" onClick={() => setLimit(limit + 50)} className="h-10 rounded-lg bg-white/10 text-sm font-semibold text-white hover:bg-white/20 cursor-pointer">
								Show more ({wish.length - limit} left)
							</button>
						)}
					</div>

					<div className={lane("next")}>
						<h3 className="hidden text-sm font-semibold text-gray-300 md:block">
							Watch next ({q.length} of {store.cfg.cap})
						</h3>
						<AnimatePresence mode="popLayout" initial={false}>
							{q.map((t, i) => (
								<PRow store={store} onPeek={onPeek}
									key={t.key}
									t={t}
									className="border-amber-400/40 bg-amber-400/5"
									meta={
										<>
											#{i + 1}. <Why t={t} store={store} kind="service" />
										</>
									}
									actions={
										<>
											<IconBtn onClick={() => store.remove(t.key)} label={`Send ${t.title} back to Wishlist`}>
												<XMarkIcon className="h-4 w-4" />
											</IconBtn>
											<IconBtn tone="green" onClick={() => store.watched(t.key)} label={`I watched ${t.title}`}>
												<CheckIcon className="h-4 w-4" />
											</IconBtn>
										</>
									}
								/>
							))}
						</AnimatePresence>
						{Array.from({ length: Math.max(0, store.cfg.cap - q.length) }, (_, i) => (
							<div key={i} className="flex h-[5.3rem] items-center justify-center rounded-lg border-2 border-dashed border-white/10 text-xs text-gray-500">
								Open slot
							</div>
						))}
					</div>
				</div>
			</LayoutGroup>
		</div>
	)
}

export { StageButton }
