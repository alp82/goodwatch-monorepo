// PROTOTYPE - throwaway. The "bolder" variants of Watch next (#176): a start-page hero, Tonight,
// and a swipeable stack. Same data and actions as the existing-look variants; the staging goes further.
import { ArrowUturnLeftIcon, CheckIcon, PlayIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, Reorder, motion, useMotionValue, useTransform } from "framer-motion"
import { useEffect, useState } from "react"
import {
	BrowseGrid,
	EpisodeLine,
	HeroPeek,
	ItemActions,
	KeyHint,
	MiniLogo,
	QItem,
	RateDialog,
	ResetLink,
	ServiceTiles,
	TitleHero,
	ToastBar,
	useIsMobile,
	watchLine,
} from "./kit"
import { type Title, backdropUrl, posterUrl } from "./model"
import type { VariantProps } from "./variants"

const DISPLAY = "font-['Gabarito'] font-black tracking-[-0.03em]"

function PlayButton({ title: t }: { title: Title }) {
	const w = watchLine(t)
	if (!w.offer) return null
	return (
		<a
			href={`#play-${t.key}`}
			onClick={(e) => e.preventDefault()}
			className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-white pl-2 pr-5 text-base font-bold text-black shadow-lg shadow-black/40 hover:bg-gray-200"
		>
			<img src={w.offer.logo} alt="" className="h-8 w-8 rounded-md" />
			<PlayIcon className="h-5 w-5" />
			{w.owned ? `Play on ${w.offer.name}` : `Open ${w.offer.name}`}
		</a>
	)
}

// ============================================================ D. Start page hero

// The start page opens on your #1, full-bleed. The rest of Watch next waits beside it.
export function StartHero({ titles, store }: VariantProps) {
	const [peek, setPeek] = useState<Title | null>(null)
	const mobile = useIsMobile()
	const q = store.queueTitles
	const first = q[0]
	const rest = q.slice(1)
	const ep = first ? store.nextEpisode(first) : null
	return (
		<div className="pb-32">
			<section className="relative isolate min-h-[34rem] overflow-hidden md:min-h-[40rem]" aria-label="Your next watch">
				<AnimatePresence mode="popLayout">
					{first && (
						<motion.img
							key={first.key}
							src={backdropUrl(first, "original")}
							alt=""
							initial={{ opacity: 0, scale: 1.04 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.7 }}
							className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]"
						/>
					)}
				</AnimatePresence>
				<div className="absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/70 to-gray-900/10 md:bg-gradient-to-r md:from-gray-900 md:via-gray-900/75 md:to-transparent" />
				<div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-gray-900 to-transparent" />

				<div className="mx-auto grid min-h-[34rem] max-w-7xl items-end gap-8 px-4 pb-8 pt-40 sm:px-6 md:min-h-[40rem] md:grid-cols-[1fr_auto] md:items-center md:pt-10 lg:px-8">
					{first ? (
						<motion.div key={first.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="min-w-0 max-w-2xl">
							<p className="text-sm font-semibold text-amber-300">Watch next</p>
							<h1 className={`${DISPLAY} mt-1 text-5xl leading-[0.92] text-white md:text-7xl lg:text-8xl`}>{first.title}</h1>
							<p className="mt-3 text-base text-gray-200 md:text-lg">
								{ep ? <EpisodeLine store={store} title={first} /> : first.tagline || first.genres.join(", ")}
							</p>
							<div className="mt-5">
								<ServiceTiles title={first} size={44} max={3} names />
							</div>
							<div className="mt-6 flex flex-wrap items-center gap-2">
								<PlayButton title={first} />
								<button
									type="button"
									onClick={() => (ep ? store.episodeWatched(first.key) : store.watched(first.key))}
									className="inline-flex h-12 items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white backdrop-blur hover:bg-white/20 cursor-pointer"
								>
									<CheckIcon className="h-5 w-5 text-green-400" />
									{ep ? `Watched E${ep.e}` : "I watched it"}
								</button>
								<button
									type="button"
									onClick={() => store.move(first.key, q.length - 1)}
									className="inline-flex h-12 items-center gap-2 rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10 cursor-pointer"
								>
									<ArrowUturnLeftIcon className="h-5 w-5" />
									Not tonight
								</button>
							</div>
						</motion.div>
					) : (
						<div className="max-w-xl">
							<h1 className={`${DISPLAY} text-5xl text-white`}>Nothing queued</h1>
							<p className="mt-3 text-gray-300">Pick up to five titles below and the first one lands here.</p>
						</div>
					)}

					{rest.length > 0 && (
						<div className="min-w-0">
							<p className="mb-2 text-sm font-semibold text-gray-300">Then</p>
							<Reorder.Group
								axis={mobile ? "x" : "y"}
								values={rest.map((t) => t.key)}
								onReorder={(keys) => first && store.reorder([first.key, ...keys])}
								className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:w-[19rem] md:flex-col md:overflow-visible md:px-0"
							>
								{rest.map((t, i) => (
									<QItem key={t.key} store={store} k={t.key} index={i + 1} label={t.title} className="w-28 shrink-0 rounded-lg md:w-auto" gripClassName="right-1 top-1 h-7 w-7">
										<div className="flex flex-col gap-2 rounded-lg bg-black/50 p-1.5 backdrop-blur-md md:flex-row md:items-center md:gap-3">
											<div className="relative">
												<img src={posterUrl(t, "w185")} alt="" draggable={false} className="aspect-[2/3] w-full rounded-md object-cover md:h-24 md:w-16" />
												<span className={`${DISPLAY} absolute -bottom-1 left-1 text-3xl text-white [text-shadow:0_2px_8px_#000]`}>{i + 2}</span>
											</div>
											<div className="min-w-0 flex-1">
												<button type="button" onClick={() => setPeek(t)} className="block max-w-full truncate text-left text-sm font-bold text-white hover:underline cursor-pointer">
													{t.title}
												</button>
												<p className="truncate text-xs text-gray-400">{watchLine(t).text}</p>
												<ItemActions store={store} title={t} className="mt-1.5 hidden md:flex" />
											</div>
										</div>
									</QItem>
								))}
							</Reorder.Group>
							<KeyHint className="mt-2 max-w-[19rem]" />
						</div>
					)}
				</div>
			</section>

			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<BrowseGrid titles={titles} store={store} onOpen={setPeek} heading="Recommended for you" className="mt-6" />
				<div className="mt-6">
					<ResetLink store={store} />
				</div>
			</div>
			<HeroPeek title={peek} store={store} onClose={() => setPeek(null)} />
			<RateDialog store={store} />
			<ToastBar store={store} />
		</div>
	)
}

// ============================================================ E. Tonight

// One pick for tonight and two on deck. Adding a title makes it tonight's pick.
export function Tonight({ titles, store }: VariantProps) {
	const [peek, setPeek] = useState<Title | null>(null)
	const q = store.queueTitles
	const pick = q[0]
	const deck = q.slice(1)
	const [now, setNow] = useState<Date | null>(null)
	useEffect(() => setNow(new Date()), [])
	const ep = pick ? store.nextEpisode(pick) : null
	const minutes = pick ? (pick.runtime ?? (ep ? 50 : 110)) : 0
	const doneBy = now && pick ? new Date(now.getTime() + minutes * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null
	const makeTonight = (t: Title) => store.add(t.key, "top")
	return (
		<div className="pb-32">
			<section className="relative isolate overflow-hidden" aria-label="Tonight">
				<div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_70%_at_30%_0%,rgba(251,191,36,.16),transparent_70%)]" />
				{pick && <img src={backdropUrl(pick, "w1280")} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-[0.12] blur-sm" />}
				<div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[auto_1fr_16rem] md:items-center md:py-14 lg:px-8">
					{pick ? (
						<>
							<motion.button
								type="button"
								key={pick.key}
								initial={{ opacity: 0, rotateY: -12, y: 10 }}
								animate={{ opacity: 1, rotateY: 0, y: 0 }}
								transition={{ duration: 0.5 }}
								onClick={() => setPeek(pick)}
								className="mx-auto w-[62vw] max-w-[20rem] cursor-pointer md:mx-0 md:w-[20rem]"
								style={{ perspective: 800 }}
							>
								<img src={posterUrl(pick, "w500")} alt={pick.title} className="w-full rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/10" />
							</motion.button>
							<motion.div key={`${pick.key}-t`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
								<p className={`${DISPLAY} text-2xl text-amber-300 md:text-3xl`}>Tonight</p>
								<h1 className={`${DISPLAY} mt-1 text-4xl leading-[0.95] text-white md:text-6xl`}>{pick.title}</h1>
								<p className="mt-3 text-gray-300">
									{ep ? <EpisodeLine store={store} title={pick} /> : pick.tagline || pick.genres.join(", ")}
								</p>
								{doneBy && (
									<p className="mt-1 text-sm text-gray-400">
										{minutes} min. Start now and you are done by {doneBy}.
									</p>
								)}
								<div className="mt-5">
									<ServiceTiles title={pick} size={44} max={3} names />
								</div>
								<div className="mt-6 flex flex-wrap gap-2">
									<PlayButton title={pick} />
									<button
										type="button"
										onClick={() => (ep ? store.episodeWatched(pick.key) : store.watched(pick.key))}
										className="inline-flex h-12 items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white hover:bg-white/20 cursor-pointer"
									>
										<CheckIcon className="h-5 w-5 text-green-400" />
										{ep ? `Watched E${ep.e}` : "Watched it"}
									</button>
									{deck[0] && (
										<button
											type="button"
											onClick={() => store.move(pick.key, 1)}
											className="inline-flex h-12 items-center gap-2 rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10 cursor-pointer"
										>
											<ArrowUturnLeftIcon className="h-5 w-5" />
											Swap for {deck[0].title}
										</button>
									)}
								</div>
							</motion.div>
						</>
					) : (
						<div className="md:col-span-2">
							<p className={`${DISPLAY} text-3xl text-amber-300`}>Tonight</p>
							<h1 className={`${DISPLAY} mt-1 text-5xl text-white`}>Nothing picked yet</h1>
							<p className="mt-3 text-gray-300">Choose Tonight on any poster below.</p>
						</div>
					)}
					<div className="min-w-0">
						<p className="mb-2 text-sm font-semibold text-gray-300">If not that</p>
						<Reorder.Group
							axis="y"
							values={deck.map((t) => t.key)}
							onReorder={(keys) => pick && store.reorder([pick.key, ...keys])}
							className="flex flex-col gap-2"
						>
							{deck.map((t, i) => (
								<QItem key={t.key} store={store} k={t.key} index={i + 1} label={t.title} className="rounded-lg" gripClassName="right-2 top-2 h-7 w-7">
									<div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/40 p-2 backdrop-blur">
										<img src={posterUrl(t, "w154")} alt="" draggable={false} className="h-20 w-[3.35rem] shrink-0 rounded-md object-cover" />
										<div className="min-w-0 flex-1 pr-6">
											<button type="button" onClick={() => setPeek(t)} className="block max-w-full truncate text-left text-sm font-bold text-white hover:underline cursor-pointer">
												{t.title}
											</button>
											<p className="truncate text-xs text-gray-400">{watchLine(t).text}</p>
											<div className="mt-1.5 flex gap-1.5" data-nodrag>
												<button type="button" onClick={() => makeTonight(t)} className="h-7 rounded-md bg-amber-400 px-2 text-xs font-bold text-black hover:bg-amber-300 cursor-pointer">
													Make tonight
												</button>
												<button type="button" onClick={() => store.remove(t.key)} className="h-7 rounded-md bg-white/10 px-2 text-xs text-gray-200 hover:bg-white/20 cursor-pointer">
													Drop
												</button>
											</div>
										</div>
									</div>
								</QItem>
							))}
							{Array.from({ length: Math.max(0, store.cfg.cap - 1 - deck.length) }, (_, i) => (
								<div key={i} className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-white/10 text-xs text-gray-500">
									Open slot
								</div>
							))}
						</Reorder.Group>
						<p className="mt-2 text-xs text-gray-500">Three at most. Anything pushed out goes back to Wishlist.</p>
					</div>
				</div>
			</section>
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<KeyHint className="mb-6" />
				<BrowseGrid titles={titles} store={store} onOpen={setPeek} heading="Pick something for tonight" addLabel="Tonight" onAdd={(t) => (store.has(t.key) ? store.remove(t.key) : makeTonight(t))} />
				<div className="mt-6">
					<ResetLink store={store} />
				</div>
			</div>
			<HeroPeek title={peek} store={store} onClose={() => setPeek(null)} nextLabel="Watch tonight" onNext={(t) => (store.has(t.key) ? store.remove(t.key) : makeTonight(t))} />
			<RateDialog store={store} />
			<ToastBar store={store} />
		</div>
	)
}

// ============================================================ G. Stack

// A deck of posters. Swipe the top one right when watched, left to send it to the back.
export function Stack({ titles, store }: VariantProps) {
	const [open, setOpen] = useState<Title | null>(null)
	const mobile = useIsMobile()
	const q = store.queueTitles
	const top = q[0]
	return (
		<div className="mx-auto w-full max-w-7xl overflow-x-clip px-4 pb-32 pt-6 sm:px-6 lg:px-8">
			<div className="flex items-baseline justify-between">
				<h1 className={`${DISPLAY} text-3xl text-white md:text-4xl`}>Watch next</h1>
				<ResetLink store={store} />
			</div>
			<div className="mt-6 grid items-center gap-8 md:grid-cols-[minmax(0,26rem)_1fr]">
				<div className="relative mx-auto h-[24rem] w-full max-w-[20rem] -translate-x-3 md:h-[30rem] md:max-w-none md:translate-x-0">
					{q.length === 0 && <div className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-dashed border-white/10 text-gray-500">Your deck is empty</div>}
					{q
						.slice(0, 4)
						.reverse()
						.map((t) => {
							const depth = q.indexOf(t)
							return depth === 0 ? (
								<SwipeCard key={t.key} title={t} onRight={() => (store.nextEpisode(t) ? store.episodeWatched(t.key) : store.watched(t.key))} onLeft={() => store.move(t.key, q.length - 1)} />
							) : (
								<motion.img
									key={t.key}
									src={posterUrl(t, "w500")}
									alt=""
									layout
									animate={{ x: depth * (mobile ? 12 : 22), y: depth * 6, rotate: depth * (mobile ? 2.5 : 3.5), scale: 1 - depth * 0.06 }}
									className="absolute inset-x-0 top-0 mx-auto aspect-[2/3] h-[92%] rounded-2xl object-cover shadow-2xl shadow-black"
									style={{ zIndex: 10 - depth, filter: `brightness(${1 - depth * 0.22})`, originX: 0.5, originY: 1 }}
								/>
							)
						})}
				</div>
				{top ? (
					<div className="min-w-0">
						<p className="text-sm font-semibold text-amber-300">
							1 of {q.length}
						</p>
						<h2 className={`${DISPLAY} mt-1 text-4xl leading-[0.95] text-white md:text-6xl`}>{top.title}</h2>
						<p className="mt-2 text-gray-300">
							<EpisodeLine store={store} title={top} />
						</p>
						<p className="mt-3 line-clamp-3 max-w-xl text-sm text-gray-400">{top.synopsis}</p>
						<div className="mt-4">
							<ServiceTiles title={top} size={40} max={3} names />
						</div>
						<div className="mt-5 flex flex-wrap items-center gap-2">
							<PlayButton title={top} />
							<ItemActions store={store} title={top} size="md" top={false} />
							<button type="button" onClick={() => setOpen(top)} className="h-10 rounded-lg px-3 text-sm text-gray-300 hover:bg-white/10 cursor-pointer">
								Details
							</button>
						</div>
						<p className="mt-3 text-xs text-gray-500">Swipe the poster right when you have watched it, left to watch it later.</p>
					</div>
				) : null}
			</div>

			<section className="mt-10" aria-label="Deck order">
				<h2 className="mb-2 text-sm font-semibold text-gray-300">The order</h2>
				<Reorder.Group axis="x" values={q.map((t) => t.key)} onReorder={store.reorder} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
					{q.map((t, i) => (
						<QItem key={t.key} store={store} k={t.key} index={i} label={t.title} className="w-20 shrink-0 rounded-md md:w-24" gripClassName="right-1 top-1 h-6 w-6">
							<img src={posterUrl(t, "w185")} alt="" draggable={false} className={`aspect-[2/3] w-full rounded-md object-cover ${i === 0 ? "ring-2 ring-amber-400" : ""}`} />
							<MiniLogo title={t} className="absolute bottom-1 left-1 h-5 w-5" />
							{i > 0 && (
								<button
									type="button"
									onClick={() => store.toTop(t.key)}
									className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white hover:bg-black cursor-pointer"
								>
									Top
								</button>
							)}
						</QItem>
					))}
				</Reorder.Group>
				<KeyHint />
			</section>

			<BrowseGrid titles={titles} store={store} onOpen={setOpen} className="mt-10" />
			<HeroPeek title={open} store={store} onClose={() => setOpen(null)} />
			<RateDialog store={store} />
			<ToastBar store={store} />
		</div>
	)
}

function SwipeCard({ title: t, onRight, onLeft }: { title: Title; onRight: () => void; onLeft: () => void }) {
	const x = useMotionValue(0)
	const rotate = useTransform(x, [-200, 200], [-12, 12])
	const yes = useTransform(x, [20, 120], [0, 1])
	const no = useTransform(x, [-120, -20], [1, 0])
	return (
		<motion.div
			drag="x"
			dragSnapToOrigin
			style={{ x, rotate, zIndex: 20, originY: 1 }}
			onDragEnd={(_, info) => {
				if (info.offset.x > 110) onRight()
				else if (info.offset.x < -110) onLeft()
			}}
			initial={{ scale: 0.96, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			className="absolute inset-x-0 top-0 mx-auto aspect-[2/3] h-[92%] cursor-grab touch-pan-y active:cursor-grabbing"
		>
			<img src={posterUrl(t, "w500")} alt={t.title} draggable={false} className="h-full w-full rounded-2xl object-cover shadow-2xl shadow-black ring-1 ring-white/10" />
			<MiniLogo title={t} className="absolute left-3 top-3 h-9 w-9 rounded-lg border-2" />
			<motion.span style={{ opacity: yes }} className="absolute right-4 top-4 rounded-lg border-2 border-green-400 bg-black/60 px-3 py-1 text-lg font-bold text-green-300">
				Watched
			</motion.span>
			<motion.span style={{ opacity: no }} className="absolute left-4 top-14 rounded-lg border-2 border-gray-300 bg-black/60 px-3 py-1 text-lg font-bold text-gray-200">
				Later
			</motion.span>
		</motion.div>
	)
}
