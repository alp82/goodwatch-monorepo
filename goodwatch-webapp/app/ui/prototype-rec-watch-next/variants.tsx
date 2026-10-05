// PROTOTYPE - throwaway. The "existing components" variants of Watch next (#176):
// top of Wishlist, dock, drawer, and Up next. They reuse the production poster card, overlays,
// ScoreRing, service tiles, and action buttons, and vary only placement and motion.
import { ChevronDownIcon, ChevronUpIcon, QueueListIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, Reorder, motion } from "framer-motion"
import { useRef, useState } from "react"
import Drawer from "~/ui/modal/Drawer"
import {
	BrowseGrid,
	EpisodeLine,
	ItemActions,
	KeyHint,
	MiniLogo,
	PosterCard,
	QItem,
	RateDialog,
	ResetLink,
	ServiceTiles,
	TitleHero,
	ToastBar,
	useIsMobile,
	watchLine,
} from "./kit"
import { type Store, type Title, backdropUrl, posterUrl } from "./model"

export type VariantProps = { titles: Title[]; store: Store; demoServices: boolean }

// The details hero opens on whatever poster you click; it starts on a title that is not queued yet.
function useOpenTitle(titles: Title[], store: Store) {
	const [key, setKey] = useState<string | null>(null)
	const ref = useRef<HTMLDivElement>(null)
	const fallback = titles.find((t) => !store.has(t.key) && t.offers.some((o) => o.owned) && !store.isSeen(t.key)) ?? titles[0]
	const open = (key && store.byKey.get(key)) || fallback
	return {
		open,
		ref,
		show: (t: Title) => {
			setKey(t.key)
			ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })
		},
	}
}

function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
	return <div className={`mx-auto w-full max-w-7xl px-4 pb-32 pt-6 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}

// ============================================================ A. Top of Wishlist

// One ordered Wishlist. The first five are Watch next; a line marks where it ends.
export function WishlistTop({ titles, store }: VariantProps) {
	const hero = useOpenTitle(titles, store)
	const top = store.queueTitles
	const rest = store.state.wishlist.slice(store.cfg.cap).map((k) => store.byKey.get(k)).filter((t): t is Title => !!t)
	return (
		<Page>
			<div className="flex items-baseline justify-between gap-4">
				<h1 className="text-lg font-semibold text-white md:text-xl lg:text-2xl">My Wishlist</h1>
				<ResetLink store={store} />
			</div>
			<p className="mt-1 max-w-2xl text-sm text-gray-400">Your Wishlist in the order you want to watch it. The first five are Watch next.</p>

			<section className="mt-6" aria-label="Watch next">
				<div className="mb-2 flex items-center gap-2 text-amber-300">
					<QueueListIcon className="h-5 w-5" />
					<h2 className="text-lg font-bold">Watch next</h2>
				</div>
				<Reorder.Group
					axis="x"
					values={top.map((t) => t.key)}
					onReorder={store.reorder}
					className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0"
				>
					{top.map((t, i) => (
						<QItem key={t.key} store={store} k={t.key} index={i} label={t.title} className="w-[42vw] shrink-0 snap-start rounded-lg md:w-auto">
							<div className="group/card relative">
								<span className="pointer-events-none absolute left-1 bottom-24 z-10 text-6xl font-black leading-none text-white [text-shadow:0_2px_12px_rgba(0,0,0,.9)] md:text-7xl">{i + 1}</span>
								<PosterCard title={t} store={store} onOpen={hero.show} />
							</div>
							<div className="mt-1 px-1">
								<EpisodeLine store={store} title={t} className="block truncate text-xs text-gray-400" />
								<ServiceTiles title={t} size={28} max={2} className="mt-1.5" />
								<ItemActions store={store} title={t} className="mt-2" />
							</div>
						</QItem>
					))}
				</Reorder.Group>
				<KeyHint className="mt-2" />
			</section>

			<div className="relative my-8 flex items-center gap-3" role="separator">
				<span className="h-px flex-1 border-t-2 border-dashed border-amber-500/40" />
				<span className="text-xs text-amber-200/70">Watch next ends here. Move a title up to watch it sooner.</span>
				<span className="h-px flex-1 border-t-2 border-dashed border-amber-500/40" />
			</div>

			<section aria-label="Rest of Wishlist">
				<h2 className="mb-3 text-lg font-bold text-white">
					Rest of Wishlist <span className="font-normal text-gray-500">{rest.length}</span>
				</h2>
				<div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
					{rest.map((t) => (
						<div key={t.key} className="group/card">
							<PosterCard title={t} store={store} onOpen={hero.show} addLabel="Move up" />
						</div>
					))}
				</div>
			</section>

			<div ref={hero.ref} className="mt-12 scroll-mt-20">
				<TitleHero title={hero.open} store={store} />
			</div>
			<BrowseGrid titles={titles.filter((t) => !store.onWishlist(t.key))} store={store} onOpen={hero.show} heading="Discover" className="mt-12" />
			<RateDialog store={store} />
			<ToastBar store={store} />
		</Page>
	)
}

// ============================================================ B. Dock

// A strip that stays at the bottom of every page, like a player bar. Tap a poster to act on it.
export function Dock({ titles, store }: VariantProps) {
	const hero = useOpenTitle(titles, store)
	const [open, setOpen] = useState(true)
	const [sel, setSel] = useState<string | null>(null)
	const q = store.queueTitles
	const selected = q.find((t) => t.key === sel) ?? null
	const first = q[0]
	return (
		<>
			<Page className="pb-72">
				<div ref={hero.ref} className="scroll-mt-20">
					<TitleHero title={hero.open} store={store} />
				</div>
				<BrowseGrid titles={titles} store={store} onOpen={hero.show} className="mt-10" />
				<div className="mt-6">
					<ResetLink store={store} />
				</div>
			</Page>

			<div className="fixed inset-x-0 bottom-[60px] z-[900] border-t border-gray-800 bg-gray-950/95 backdrop-blur lg:bottom-0">
				<AnimatePresence>
					{selected && open && (
						<motion.div
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 8 }}
							className="absolute bottom-full left-0 right-0 mx-auto mb-2 flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-stone-900 p-3 shadow-2xl shadow-black/70 sm:flex-nowrap"
						>
							<img src={posterUrl(selected, "w154")} alt="" className="h-16 w-[2.7rem] rounded object-cover" />
							<div className="min-w-0 flex-1">
								<button type="button" onClick={() => hero.show(selected)} className="block max-w-full truncate text-left font-bold text-white hover:underline cursor-pointer">
									{selected.title}
								</button>
								<EpisodeLine store={store} title={selected} className="block truncate text-xs text-gray-400" />
							</div>
							<ServiceTiles title={selected} size={32} max={3} />
							<ItemActions store={store} title={selected} />
						</motion.div>
					)}
				</AnimatePresence>
				<div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-6 lg:px-8">
					<button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex shrink-0 flex-col items-start text-left cursor-pointer">
						<span className="flex items-center gap-1 text-sm font-bold text-amber-300">
							<QueueListIcon className="h-4 w-4" />
							Watch next
							{open ? <ChevronDownIcon className="h-4 w-4 text-gray-400" /> : <ChevronUpIcon className="h-4 w-4 text-gray-400" />}
						</span>
						<span className="text-xs text-gray-500">
							{q.length} of {store.cfg.cap}
						</span>
					</button>
					{!open && first && (
						<p className="min-w-0 truncate text-sm text-gray-300">
							Up first: <span className="font-semibold text-white">{first.title}</span> <span className="text-gray-500">{watchLine(first).text}</span>
						</p>
					)}
					{open && (
						<Reorder.Group axis="x" values={q.map((t) => t.key)} onReorder={store.reorder} className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
							{q.map((t, i) => (
								<QItem key={t.key} store={store} k={t.key} index={i} label={t.title} grip={false} className="shrink-0 rounded-md">
									<div
										role="button"
										onClick={() => setSel(sel === t.key ? null : t.key)}
										onKeyDown={(e) => e.key === "Enter" && setSel(sel === t.key ? null : t.key)}
										aria-pressed={sel === t.key}
										className={`relative flex items-center gap-2 rounded-md cursor-pointer ${i === 0 ? "bg-white/5 pr-3" : ""} ${sel === t.key ? "ring-2 ring-amber-400" : ""}`}
									>
										<img src={posterUrl(t, "w154")} alt={t.title} draggable={false} className="h-20 w-[3.35rem] rounded-md object-cover md:h-24 md:w-16" />
										<MiniLogo title={t} className="absolute bottom-1 left-1 h-5 w-5" />
										{i === 0 && (
											<span className="hidden max-w-40 flex-col text-left sm:flex">
												<span className="text-[11px] font-semibold text-amber-300">Up first</span>
												<span className="truncate text-sm font-bold text-white">{t.title}</span>
												<EpisodeLine store={store} title={t} className="truncate text-xs text-gray-400" />
											</span>
										)}
									</div>
								</QItem>
							))}
							{Array.from({ length: Math.max(0, store.cfg.cap - q.length) }, (_, i) => (
								<span key={i} className="h-20 w-[3.35rem] shrink-0 rounded-md border-2 border-dashed border-white/10 md:h-24 md:w-16" aria-hidden="true" />
							))}
						</Reorder.Group>
					)}
				</div>
			</div>
			<RateDialog store={store} />
			<ToastBar store={store} bottom="bottom-[190px] lg:bottom-[130px]" />
		</>
	)
}

// ============================================================ C. Drawer

// Out of the way until you want it: a header button with the count opens a side panel (a sheet on phones).
export function DrawerVariant({ titles, store }: VariantProps) {
	const hero = useOpenTitle(titles, store)
	const [open, setOpen] = useState(false)
	const mobile = useIsMobile()
	const q = store.queueTitles
	const list = (
		<div>
			<div className="flex items-baseline justify-between">
				<h2 className="flex items-center gap-2 text-lg font-bold text-white">
					<QueueListIcon className="h-5 w-5 text-amber-300" /> Watch next
				</h2>
				<span className="text-xs text-gray-500">
					{q.length} of {store.cfg.cap}
				</span>
			</div>
			{q.length === 0 && <p className="mt-6 text-sm text-gray-400">Nothing queued. Hover a poster and choose Watch next, or long-press it on your phone.</p>}
			<Reorder.Group axis="y" values={q.map((t) => t.key)} onReorder={store.reorder} className="mt-3 flex flex-col gap-2">
				{q.map((t, i) => (
					<QItem key={t.key} store={store} k={t.key} index={i} label={t.title} className="rounded-xl" gripClassName="right-2 top-2 h-8 w-8">
						<div className={`relative flex gap-3 overflow-hidden rounded-xl border border-white/10 p-2 ${i === 0 ? "bg-stone-900" : "bg-white/[0.03]"}`}>
							{i === 0 && (
								<>
									<img src={backdropUrl(t, "w780")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
									<div className="absolute inset-0 bg-gradient-to-r from-stone-950 via-stone-950/80 to-transparent" />
								</>
							)}
							<img src={posterUrl(t, "w154")} alt="" draggable={false} className="relative h-24 w-16 shrink-0 rounded-md object-cover" />
							<div className="relative min-w-0 flex-1 pr-8">
								{i === 0 && <p className="text-[11px] font-semibold text-amber-300">Up first</p>}
								<button type="button" onClick={() => hero.show(t)} className="block max-w-full truncate text-left font-bold text-white hover:underline cursor-pointer">
									{t.title}
								</button>
								<EpisodeLine store={store} title={t} className="block truncate text-xs text-gray-400" />
								<ServiceTiles title={t} size={26} max={3} className="mt-1.5" />
								<ItemActions store={store} title={t} className="mt-2" />
							</div>
						</div>
					</QItem>
				))}
			</Reorder.Group>
			<KeyHint className="mt-3" />
		</div>
	)
	return (
		<>
			<Page>
				<div className="mb-4 flex items-center justify-between gap-3">
					<ResetLink store={store} />
					<button
						type="button"
						onClick={() => setOpen(true)}
						className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white hover:bg-white/10 md:inline-flex cursor-pointer"
					>
						<span className="flex -space-x-3">
							{q.slice(0, 3).map((t) => (
								<img key={t.key} src={posterUrl(t, "w92")} alt="" className="h-9 w-6 rounded-sm object-cover ring-2 ring-gray-900" />
							))}
						</span>
						Watch next
						<motion.span key={q.length} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="rounded-full bg-amber-400 px-2 text-xs font-bold text-black">
							{q.length}
						</motion.span>
					</button>
				</div>
				<div ref={hero.ref} className="scroll-mt-20">
					<TitleHero title={hero.open} store={store} />
				</div>
				<BrowseGrid titles={titles} store={store} onOpen={hero.show} className="mt-10" />
			</Page>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="fixed bottom-[76px] right-4 z-[900] flex items-center gap-2 rounded-full bg-amber-400 py-2.5 pl-3 pr-4 text-sm font-bold text-black shadow-xl shadow-black/60 md:hidden cursor-pointer"
			>
				<QueueListIcon className="h-5 w-5" />
				Watch next
				<motion.span key={q.length} initial={{ scale: 1.6 }} animate={{ scale: 1 }} className="rounded-full bg-black px-1.5 text-xs text-amber-300">
					{q.length}
				</motion.span>
			</button>
			{mobile ? (
				<Drawer open={open} onClose={() => setOpen(false)}>
					{list}
				</Drawer>
			) : (
				<AnimatePresence>
					{open && (
						<>
							<motion.div className="fixed inset-0 z-[1010] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
							<motion.aside
								initial={{ x: "100%" }}
								animate={{ x: 0 }}
								exit={{ x: "100%" }}
								transition={{ type: "tween", duration: 0.25 }}
								className="fixed bottom-0 right-0 top-0 z-[1020] w-[27rem] overflow-y-auto border-l border-white/10 bg-gray-900 p-5 shadow-2xl"
							>
								<button type="button" onClick={() => setOpen(false)} className="mb-3 text-sm text-gray-400 hover:text-white cursor-pointer">
									Close
								</button>
								{list}
							</motion.aside>
						</>
					)}
				</AnimatePresence>
			)}
			<RateDialog store={store} />
			<ToastBar store={store} />
		</>
	)
}

// ============================================================ F. Up next

// Landscape "continue watching" cards. Shows sit at their next episode and stay until the last one.
export function UpNext({ titles, store }: VariantProps) {
	const hero = useOpenTitle(titles, store)
	const mobile = useIsMobile()
	const q = store.queueTitles
	return (
		<Page>
			<div className="flex items-baseline justify-between gap-4">
				<h1 className="flex items-center gap-2 text-xl font-bold text-white md:text-2xl">
					<QueueListIcon className="h-6 w-6 text-amber-300" /> Up next
				</h1>
				<ResetLink store={store} />
			</div>
			<Reorder.Group
				axis={mobile ? "y" : "x"}
				values={q.map((t) => t.key)}
				onReorder={store.reorder}
				className="mt-4 flex flex-col gap-3 md:-mx-2 md:flex-row md:overflow-x-auto md:px-2 md:pb-3"
			>
				{q.map((t, i) => {
					const ep = store.nextEpisode(t)
					const w = watchLine(t)
					return (
						<QItem key={t.key} store={store} k={t.key} index={i} label={t.title} className="rounded-xl md:w-[22rem] md:shrink-0" gripClassName="right-2 top-2 h-8 w-8">
							<div className="group relative aspect-video overflow-hidden rounded-xl border-4 border-gray-800 bg-gray-900 hover:border-amber-700/50">
								<img src={backdropUrl(t, "w780")} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
								<div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
								<div className="absolute left-2 top-2 flex items-center gap-2">
									<MiniLogo title={t} className="h-8 w-8 rounded-lg border-2" />
									{!w.owned && <span className="rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-gray-300">{w.text}</span>}
								</div>
								<div className="absolute inset-x-0 bottom-0 p-3">
									<p className="text-[11px] font-semibold text-amber-300">{i === 0 ? "Up first" : `${i + 1}`}</p>
									<button type="button" onClick={() => hero.show(t)} className="block max-w-full truncate text-left text-lg font-bold text-white hover:underline cursor-pointer">
										{t.title}
									</button>
									<EpisodeLine store={store} title={t} className="block truncate text-sm text-gray-300" />
									<div className="mt-2 flex items-center justify-between gap-2">
										{ep ? (
											<div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20" title={`${Math.round(store.episodeProgress(t) * 100)}% of the show watched`}>
												<div className="h-full bg-amber-400" style={{ width: `${store.episodeProgress(t) * 100}%` }} />
											</div>
										) : (
											<span className="flex-1" />
										)}
										<ItemActions store={store} title={t} />
									</div>
								</div>
							</div>
						</QItem>
					)
				})}
			</Reorder.Group>
			<KeyHint className="mt-1" />
			<div ref={hero.ref} className="mt-10 scroll-mt-20">
				<TitleHero title={hero.open} store={store} />
			</div>
			<BrowseGrid titles={titles} store={store} onOpen={hero.show} className="mt-10" />
			<RateDialog store={store} />
			<ToastBar store={store} />
		</Page>
	)
}
