// PROTOTYPE - throwaway. The Wishlist area (today's /watch-next page) under each variant of /prototype/watching (#371).
// The hero, its Then column and the poster tiers are drawn after ui/watch-next (WatchNextHero, SteppedGrid).
//   A section: a Watching shelf above the hero; the hero and the grid stay the Wishlist.
//   B merged:  the hero, Then and the first tier hold Next episodes ahead of Wishlist titles.
//   C view:    two views, Wishlist and Watching; Watching is a plain list with no hero.
//   D mix:     A's page; Tonight's pick is the first shelf card, and the hero is the first title of Watch next.
import { CheckIcon, PlayIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { DISPLAY, EASE, WRAP } from "~/ui/watch-next/style"
import { Collapsed, NewBadge, Progress, QuietRow, WatchedButton, episodeFacts } from "./kit"
import { type Entry, QUIET_DAYS, type Show, type Slot, type Store, type Title, type VariantKey, ago, aired, code, entryOf, img, isNew, isShow, tonightsPick, watchNextOf } from "./model"

type Props = { store: Store; variant: VariantKey; tab: "wishlist" | "watching"; setTab: (tab: "wishlist" | "watching") => void }

const runtime = (t: Title) => (t.runtime ? (t.type === "show" ? `${t.runtime} min episodes` : `${Math.floor(t.runtime / 60)}h ${t.runtime % 60}m`) : null)

/** A Wishlist show the member has not started, as an entry, so its first episode can be marked from the card. */
const unstarted = (store: Store, show: Show): Entry => entryOf(show, { status: null, watched: 0, lastWatch: null }, store.today)

function ServiceTile({ title }: { title: Title }) {
	if (!title.service) return <p className="text-xs text-gray-400">Not on your services</p>
	return (
		<span className="relative inline-flex h-11 items-center gap-2 rounded-lg border-2 border-green-500 bg-white/10 pr-2.5">
			{title.service.logo && <img src={img(title.service.logo, "w92")} alt="" className="aspect-square h-full rounded-md" />}
			<span className="truncate text-sm font-medium text-white">{title.service.name}</span>
			<span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-black ring-2 ring-stone-950">
				<CheckIcon className="h-3 w-3" aria-hidden />
			</span>
		</span>
	)
}

// The docked strip's place on the hero (desktop). Its controls are not part of this question, so they are drawn only.
function Strip() {
	return (
		<div className="flex h-14 items-center gap-2 rounded-2xl bg-black/45 px-3 text-sm font-bold text-gray-200 ring-1 ring-white/10 backdrop-blur" aria-hidden>
			<span className="rounded-full bg-white/10 px-3 py-1.5">+ Moods</span>
			<span className="grow" />
			<span className="rounded-full bg-green-500/15 px-3 py-1.5 text-green-300">On my services</span>
			<span className="rounded-full bg-white/10 px-3 py-1.5">Best match</span>
		</div>
	)
}

function Hero({ slot, then, store, eyebrow }: { slot: Slot | null; then: Slot[]; store: Store; eyebrow: ReactNode }) {
	const title = slot?.title
	const entry = slot?.entry
	const ep = entry?.next
	const startable = title && !entry && isShow(title) ? unstarted(store, title) : null
	return (
		<section className="relative isolate overflow-hidden" aria-label="Your next watch" data-hero={slot?.key}>
			<AnimatePresence mode="popLayout" initial={false}>
				{title?.backdrop && (
					<motion.img
						key={title.key}
						src={img(title.backdrop, "w1280")}
						alt=""
						initial={{ opacity: 0, scale: 1.06 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.9, ease: EASE }}
						className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]"
					/>
				)}
			</AnimatePresence>
			<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-900 via-gray-900/70 to-gray-900/10 md:bg-linear-to-r md:from-gray-900 md:via-gray-900/75 md:to-transparent" />
			<div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-linear-to-t from-gray-900 to-transparent" />
			<div className="absolute inset-x-0 top-0 -z-10 h-40 bg-linear-to-b from-gray-900/90 to-transparent" />
			<div className={`${WRAP} relative z-20 hidden pt-6 lg:block`}>
				<Strip />
			</div>
			<div className={`${WRAP} grid min-h-[30rem] items-end gap-6 pb-8 pt-24 md:min-h-[34rem] md:grid-cols-[1fr_auto] md:items-center md:gap-10 md:pt-6`}>
				<div className="min-w-0 max-w-2xl">
					{!title ? (
						<>
							<p className="text-sm font-semibold text-amber-300">Your Wishlist is empty</p>
							<h2 className={`${DISPLAY} mt-1 text-5xl leading-[0.9] text-white md:text-6xl`}>Nothing here yet</h2>
						</>
					) : (
						<motion.div key={`${title.key}:${entry?.track.watched ?? ""}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: EASE }}>
							<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-semibold">{eyebrow}</div>
							<h2
								className={`${DISPLAY} mt-1 leading-[0.9] text-white ${title.title.length > 22 ? "text-4xl md:text-6xl lg:text-7xl" : "text-5xl md:text-7xl lg:text-[7rem]"}`}
							>
								{title.title}
							</h2>
							{ep && entry ? (
								<>
									<p className="mt-3 flex flex-wrap items-center gap-2 text-xl font-bold text-white md:text-2xl" data-episode>
										{code(ep)} · {ep.name}
										{isNew(store.today, ep) && <NewBadge />}
									</p>
									<p className="mt-1 text-sm text-gray-400">
										{[aired(store.today, ep), title.runtime ? `${title.runtime} min` : null, `${entry.done} of ${entry.show.total} episodes watched`].filter(Boolean).join(", ")}
									</p>
								</>
							) : (
								<>
									{title.tagline && <p className="mt-3 text-base text-gray-200 md:text-lg">{title.tagline}</p>}
									<p className="mt-1 text-sm text-gray-400">
										{[title.year, runtime(title), `${title.match}% taste match`, title.score ? `GoodWatch score ${title.score}` : null].filter(Boolean).join(", ")}
									</p>
								</>
							)}
							<div className="mt-5">
								<ServiceTile title={title} />
							</div>
							<div className="mt-6 flex flex-wrap items-center gap-2">
								<span className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-white pl-2 pr-5 text-base font-bold text-black shadow-lg shadow-black/40">
									{title.service?.logo && <img src={img(title.service.logo, "w92")} alt="" className="h-8 w-8 rounded-md" />}
									<PlayIcon className="h-5 w-5" aria-hidden />
									{title.service ? `Watch on ${title.service.name}` : "Where to watch"}
								</span>
								{entry ? (
									<WatchedButton entry={entry} store={store} className="!h-12 !px-4 !text-base backdrop-blur" />
								) : (
									<button
										type="button"
										onClick={() => store.finishTitle(title.key)}
										className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white backdrop-blur hover:bg-white/20"
									>
										<CheckIcon className="h-5 w-5 text-green-400" aria-hidden />I watched it
									</button>
								)}
								{startable && <WatchedButton entry={startable} store={store} className="!h-12 !px-4 !text-base backdrop-blur" />}
								<button
									type="button"
									onClick={() => store.pass(title.key)}
									className="inline-flex h-12 cursor-pointer items-center rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10"
								>
									Not tonight
								</button>
							</div>
						</motion.div>
					)}
				</div>
				{then.length > 0 && (
					<div className="min-w-0" data-then>
						<p className="mb-2 text-sm font-semibold text-gray-300">Then</p>
						<ol className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:w-[20rem] md:flex-col md:overflow-visible md:px-0">
							{then.map((s, i) => (
								<li key={s.key} className="w-28 shrink-0 md:w-auto">
									<div className="flex w-full flex-col gap-2 rounded-lg bg-black/50 p-1.5 text-left backdrop-blur-md md:flex-row md:items-center md:gap-3">
										<span className="relative block shrink-0">
											<img src={img(s.title.poster, "w185")} alt="" className="aspect-[2/3] w-full rounded-md object-cover md:h-24 md:w-16" />
											<span className={`${DISPLAY} absolute -bottom-1 left-1 text-3xl text-white [text-shadow:0_2px_8px_#000]`} aria-hidden>
												{i + 2}
											</span>
										</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-bold text-white">{s.title.title}</span>
											<span className="block truncate text-xs text-gray-400">
												{s.entry?.next ? `${code(s.entry.next)} · ${s.entry.next.name}` : s.title.service ? `On ${s.title.service.name}` : "Not on your services"}
											</span>
											<span className="hidden truncate text-xs text-gray-500 md:block">
												{s.entry ? `Last watched ${ago(s.entry.track.lastWatch)}` : runtime(s.title)}
											</span>
										</span>
										{s.entry && (
											<span className="hidden md:block">
												<WatchedButton entry={s.entry} store={store} label="none" />
											</span>
										)}
									</div>
								</li>
							))}
						</ol>
					</div>
				)}
			</div>
		</section>
	)
}

/** The Wishlist under the hero and Then: four large, the rest smaller, as the stepped grid does. */
function WishlistGrid({ slots, store, heading = "After that", note }: { slots: Slot[]; store: Store; heading?: string; note: string }) {
	if (!slots.length) return null
	const big = slots.slice(0, 4)
	const rest = slots.slice(4)
	return (
		<section aria-label="The rest of your Wishlist" data-wishlist-grid>
			<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>{heading}</h2>
			<p className="mb-5 mt-1 text-sm text-gray-400">{note}</p>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{big.map((s) => (
					<div key={s.key} className="min-w-0">
						<img src={img(s.title.poster, "w342")} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg bg-white/5 object-cover ring-1 ring-white/5" />
						<div className="mt-1.5 truncate text-sm font-bold text-white">{s.title.title}</div>
						<div className="truncate text-xs text-gray-400">
							{s.title.match}% match{s.title.service ? ` · ${s.title.service.name}` : ""}
						</div>
						{isShow(s.title) && <WatchedButton entry={unstarted(store, s.title)} store={store} className="mt-2 !h-9 w-full !text-xs" />}
					</div>
				))}
			</div>
			{rest.length > 0 && (
				<div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
					{rest.map((s) => (
						<img key={s.key} src={img(s.title.poster, "w185")} alt={s.title.title} title={s.title.title} loading="lazy" className="aspect-[2/3] w-full rounded-md bg-white/5 object-cover ring-1 ring-white/5" />
					))}
				</div>
			)}
		</section>
	)
}

/** Shows with nothing to watch tonight: caught up, or Seen with a season announced. Then On hold, closed. */
function Waiting({ store }: { store: Store }) {
	const waiting = [...store.groups.caughtUp, ...store.groups.comingBack]
	return (
		<>
			{waiting.length > 0 && (
				<section data-group="Waiting for episodes">
					<h3 className="mb-2 text-sm font-bold text-gray-300">
						Waiting for episodes <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums">{waiting.length}</span>
					</h3>
					<ul className="grid gap-2 md:grid-cols-2">
						{waiting.map((e) => (
							<QuietRow key={e.show.key} entry={e} store={store} />
						))}
					</ul>
				</section>
			)}
			<Collapsed title="On hold" count={store.groups.onHold.length}>
				<ul className="grid gap-2 md:grid-cols-2">
					{store.groups.onHold.map((e) => (
						<QuietRow key={e.show.key} entry={e} store={store} />
					))}
				</ul>
			</Collapsed>
		</>
	)
}

/** What a member who tracks nothing sees where Watching would be. */
function NothingWatched({ store }: { store: Store }) {
	const shows = store.wishlist.filter(isShow).slice(0, 3)
	return (
		<div className="rounded-2xl border border-dashed border-white/15 p-5" data-empty>
			<h2 className={`${DISPLAY} text-2xl text-white`}>Watching</h2>
			<p className="mt-1 max-w-xl text-sm text-gray-400">
				You are not in the middle of a show. Mark an episode watched on a show's page and it appears here with its Next episode.
			</p>
			{shows.length > 0 && (
				<>
					<p className="mt-4 text-sm font-semibold text-gray-300">Shows on your Wishlist</p>
					<ul className="mt-2 flex flex-wrap gap-3">
						{shows.map((show) => (
							<li key={show.key} className="flex items-center gap-3 rounded-lg bg-white/[0.04] p-2 pr-3 ring-1 ring-white/5">
								<img src={img(show.poster, "w92")} alt="" className="h-14 w-[38px] rounded object-cover" />
								<span className="text-sm font-bold text-white">{show.title}</span>
								<WatchedButton entry={unstarted(store, show)} store={store} />
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// A: a Watching shelf above the hero.

function ShelfCard({ entry, store, tonight }: { entry: Entry; store: Store; tonight?: boolean }) {
	const { show, next } = entry
	if (!next) return null
	return (
		<li className="flex w-64 shrink-0 flex-col overflow-hidden rounded-xl bg-white/[0.05] ring-1 ring-white/10" data-card={show.key}>
			<div className="relative">
				{/* The show's backdrop, never the episode's still: stills of unwatched episodes stay hidden until tapped. */}
				<img src={img(show.backdrop, "w500")} alt="" loading="lazy" className="aspect-video w-full object-cover" />
				<span className="absolute inset-0 bg-linear-to-t from-gray-950/90 to-transparent" />
				<span className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
					<b className="min-w-0 truncate text-base text-white">{show.title}</b>
					{isNew(store.today, next) && <NewBadge />}
				</span>
				{entry.kind === "seenNew" && <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-gray-200">Seen</span>}
				{tonight && <span className="absolute left-2 top-2 rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-black text-black">Tonight's pick</span>}
			</div>
			<div className="flex flex-1 flex-col gap-1.5 p-3">
				<p className="truncate text-sm font-bold text-white">
					{code(next)} · <span className="font-medium text-gray-200">{next.name}</span>
				</p>
				<p className="truncate text-xs text-gray-400">{episodeFacts(store.today, entry)}</p>
				<Progress entry={entry} className="mt-1" />
				<WatchedButton entry={entry} store={store} className="mt-2 w-full" />
			</div>
		</li>
	)
}

function SectionPage({ store, variant }: Props) {
	const pick = variant === "mix" ? tonightsPick(store, variant) : null
	const { slots } = watchNextOf(store, "section")
	const shows = [...store.groups.next, ...store.groups.seenNew]
	const [all, setAll] = useState(false)
	const shown = all ? shows : shows.slice(0, 8)
	const tracked = shows.length + store.groups.caughtUp.length + store.groups.comingBack.length + store.groups.onHold.length
	return (
		<>
			<section className={`${WRAP} flex flex-col gap-4 pb-6 pt-6`} aria-label="Watching" data-watching-section>
				{tracked === 0 ? (
					<NothingWatched store={store} />
				) : (
					<>
						<header className="flex items-baseline gap-3">
							<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>Watching</h2>
							<p className="text-sm text-gray-400">
								{shows.length} with a Next episode, last watched first
							</p>
						</header>
						<ul className={all ? "flex flex-wrap gap-3" : "-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"}>
							{shown.map((e) => (
								<ShelfCard key={e.show.key} entry={e} store={store} tonight={pick?.entry?.show.key === e.show.key} />
							))}
							{shows.length > shown.length && (
								<li className="flex w-28 shrink-0">
									<button type="button" onClick={() => setAll(true)} className="w-full cursor-pointer rounded-xl bg-white/5 text-lg font-bold text-gray-300 hover:bg-white/10">
										+{shows.length - shown.length}
									</button>
								</li>
							)}
						</ul>
						<Waiting store={store} />
					</>
				)}
			</section>
			<Hero
				slot={slots[0] ?? null}
				then={slots.slice(1, 4)}
				store={store}
				eyebrow={<span className="text-amber-300">{pick?.entry ? "Watch next · best match on your Wishlist" : "Tonight's pick · best match on your Wishlist"}</span>}
			/>
			<div className={`${WRAP} pt-8`}>
				<WishlistGrid slots={slots.slice(4)} store={store} note="The rest of your Wishlist, by best match." />
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// B: Watch next holds Next episodes ahead of Wishlist titles.

function MergedPage({ store }: Props) {
	const { slots, quiet } = watchNextOf(store, "merged")
	const first = slots[0] ?? null
	const rest = slots.slice(4)
	const episodes = rest.filter((s) => s.entry)
	const titles = rest.filter((s) => !s.entry)
	return (
		<>
			<Hero
				slot={first}
				then={slots.slice(1, 4)}
				store={store}
				eyebrow={
					first?.entry ? (
						<>
							<span className="text-amber-300">Tonight's pick · Next episode</span>
							<span className="text-gray-300">
								{first.entry.kind === "seenNew" ? `${first.entry.left} new since you saw it` : `you watched the last one ${ago(first.entry.track.lastWatch)}`}
							</span>
						</>
					) : (
						<span className="text-amber-300">Tonight's pick · best match on your Wishlist</span>
					)
				}
			/>
			<div className={`${WRAP} flex flex-col gap-10 pt-8`}>
				{episodes.length > 0 && (
					<section data-tier="episodes">
						<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>More next episodes</h2>
						<p className="mb-5 mt-1 text-sm text-gray-400">Shows you watched in the last {QUIET_DAYS} days, most recent first.</p>
						<ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
							{episodes.map((s) => {
								const e = s.entry as Entry
								return (
									<li key={s.key} className="min-w-0" data-card={s.key}>
										<span className="relative block">
											<img src={img(s.title.poster, "w342")} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-white/5" />
											{isNew(store.today, e.next) && <NewBadge className="absolute left-2 top-2" />}
											<WatchedButton entry={e} store={store} label="none" className="absolute bottom-2 right-2 !bg-black/70 backdrop-blur" />
										</span>
										<span className="mt-1.5 block truncate text-sm font-bold text-white">{s.title.title}</span>
										<span className="block truncate text-xs text-gray-300">{e.next && `${code(e.next)} · ${e.next.name}`}</span>
										<span className="block truncate text-xs text-gray-500">{episodeFacts(store.today, e)}</span>
									</li>
								)
							})}
						</ul>
					</section>
				)}
				<WishlistGrid slots={titles} store={store} heading="From your Wishlist" note="The rest of your Wishlist, by best match." />
				<section className="flex flex-col gap-4" aria-label="Shows without an episode tonight">
					<Collapsed title={`Watching, not for ${QUIET_DAYS} days`} count={quiet.length}>
						<ul className="grid gap-2 md:grid-cols-2">
							{quiet.map((e) => (
								<QuietRow key={e.show.key} entry={e} store={store} />
							))}
						</ul>
					</Collapsed>
					<Waiting store={store} />
				</section>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// C: two views. Watching is a list.

function Row({ entry, store }: { entry: Entry; store: Store }) {
	const { show, next } = entry
	const quiet = (entry.track.lastWatch ?? 0) > QUIET_DAYS && entry.kind === "next"
	return (
		<li className="flex items-center gap-3 border-b border-white/5 py-3 md:gap-5" data-row={show.key} data-kind={entry.kind}>
			<img src={img(show.poster, "w92")} alt="" loading="lazy" className={`h-[72px] w-12 shrink-0 rounded-md object-cover ${quiet ? "opacity-60" : ""}`} />
			<div className="min-w-0 flex-1">
				<p className="flex items-center gap-2 truncate text-base font-bold text-white">
					<span className="truncate">{show.title}</span>
					{isNew(store.today, next) && <NewBadge />}
				</p>
				{next && (
					<p className="truncate text-sm text-gray-200">
						{code(next)} · {next.name}
					</p>
				)}
				<p className="truncate text-xs text-gray-400">{episodeFacts(store.today, entry)}</p>
			</div>
			<div className="hidden w-40 shrink-0 md:block">
				<Progress entry={entry} />
				<p className="mt-1 text-xs tabular-nums text-gray-500">
					{entry.done} of {show.total} episodes
				</p>
			</div>
			{entry.kind === "next" && (
				<button
					type="button"
					onClick={() => store.setStatus(show.key, "on-hold")}
					className={`hidden h-10 shrink-0 cursor-pointer rounded-lg px-3 text-sm font-semibold hover:bg-white/10 sm:block ${quiet ? "text-amber-300" : "text-gray-400"}`}
				>
					On hold
				</button>
			)}
			<span className="hidden sm:block">
				<WatchedButton entry={entry} store={store} />
			</span>
			<span className="sm:hidden">
				<WatchedButton entry={entry} store={store} label="none" />
			</span>
		</li>
	)
}

function Tabs({ store, tab, setTab }: Props) {
	const tracked = store.groups.next.length + store.groups.caughtUp.length
	const item = (key: "wishlist" | "watching", label: string, n: number) => (
		<button
			type="button"
			role="tab"
			aria-selected={tab === key}
			onClick={() => setTab(key)}
			className={`flex h-11 cursor-pointer items-center gap-2 rounded-full px-5 text-base font-bold ${tab === key ? "bg-amber-400 text-black" : "text-gray-300 hover:bg-white/10"}`}
		>
			{label}
			<span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${tab === key ? "bg-black/15" : "bg-white/10"}`}>{n}</span>
		</button>
	)
	return (
		<div className={`${WRAP} pt-5`}>
			<div role="tablist" aria-label="Wishlist and Watching" className="inline-flex gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10">
				{item("wishlist", "Wishlist", store.wishlist.length)}
				{item("watching", "Watching", tracked)}
			</div>
		</div>
	)
}

function ViewPage(props: Props) {
	const { store, tab } = props
	const { slots } = watchNextOf(store, "view")
	const { next, seenNew, caughtUp, comingBack, onHold } = store.groups
	const tracked = next.length + seenNew.length + caughtUp.length + comingBack.length + onHold.length
	return (
		<>
			<Tabs {...props} />
			{tab === "wishlist" ? (
				<>
					<Hero
						slot={slots[0] ?? null}
						then={slots.slice(1, 4)}
						store={store}
						eyebrow={<span className="text-amber-300">Tonight's pick · best match on your Wishlist</span>}
					/>
					<div className={`${WRAP} pt-8`}>
						<WishlistGrid slots={slots.slice(4)} store={store} note="The rest of your Wishlist, by best match." />
					</div>
				</>
			) : (
				<div className={`${WRAP} flex flex-col gap-8 pt-6`} data-watching-view>
					{tracked === 0 ? (
						<NothingWatched store={store} />
					) : (
						<>
							{next.length > 0 && (
								<section data-group="Next episode">
									<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>Next episode</h2>
									<p className="mt-1 text-sm text-gray-400">
										{next.length} {next.length === 1 ? "show" : "shows"}, last watched first.
									</p>
									<ul className="mt-2">
										{next.map((e) => (
											<Row key={e.show.key} entry={e} store={store} />
										))}
									</ul>
								</section>
							)}
							{seenNew.length > 0 && (
								<section data-group="New episodes">
									<h2 className={`${DISPLAY} text-2xl text-white`}>New episodes of shows you have Seen</h2>
									<ul className="mt-2">
										{seenNew.map((e) => (
											<Row key={e.show.key} entry={e} store={store} />
										))}
									</ul>
								</section>
							)}
							<Waiting store={store} />
						</>
					)}
				</div>
			)}
		</>
	)
}

export function WishlistArea(props: Props) {
	const Page = props.variant === "section" || props.variant === "mix" ? SectionPage : props.variant === "merged" ? MergedPage : ViewPage
	return (
		<div className="overflow-x-clip pb-40" data-watch-next>
			<Page {...props} />
		</div>
	)
}
