// PROTOTYPE - throwaway. The two tops the owner kept from round 1 (#176): the start-page hero and
// Tonight. Copied from round 1's variants-bold.tsx without their "Recommended for you" grid, and given
// an empty state that offers a real title instead of a blank stage.
import { ArrowUturnLeftIcon, BookmarkIcon, CheckIcon, PlayIcon, QueueListIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, Reorder, motion } from "framer-motion"
import { useEffect, useState } from "react"
import { ItemActions, QItem, ServiceTiles, useIsMobile, watchLine } from "~/ui/prototype-rec-watch-next/kit"
import { type Title, backdropUrl, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { DISPLAY } from "./kit2"
import { type Store2, type WTitle, runtimeLabel } from "./model"

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

// With nothing in Watch next, the stage offers the best-matching suggestion on your services.
function EmptyOffer({ store, t, lead }: { store: Store2; t: WTitle | undefined; lead: string }) {
	if (!t)
		return (
			<div className="max-w-xl">
				<h1 className={`${DISPLAY} text-5xl text-white`}>Nothing queued</h1>
			</div>
		)
	return (
		<motion.div key={t.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="min-w-0 max-w-2xl">
			<p className="text-sm font-semibold text-amber-300">{lead}</p>
			<h1 className={`${DISPLAY} mt-1 text-5xl leading-[0.92] text-white md:text-7xl`}>{t.title}</h1>
			<p className="mt-3 text-base text-gray-200 md:text-lg">
				{t.match ? `${t.match}% taste match. ` : ""}
				{t.tagline || t.genres.join(", ")}
			</p>
			<div className="mt-5">
				<ServiceTiles title={t} size={44} max={3} names />
			</div>
			<div className="mt-6 flex flex-wrap gap-2">
				<button type="button" onClick={() => store.add(t.key)} className="inline-flex h-12 items-center gap-2 rounded-lg bg-amber-400 px-5 font-bold text-black hover:bg-amber-300 cursor-pointer">
					<QueueListIcon className="h-5 w-5" />
					Watch next
				</button>
				<button type="button" onClick={() => store.want(t.key)} className="inline-flex h-12 items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white backdrop-blur hover:bg-white/20 cursor-pointer">
					<BookmarkIcon className="h-5 w-5 text-amber-300" />
					Want to See
				</button>
				<button type="button" onClick={() => store.dismiss(t.key)} className="inline-flex h-12 items-center rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10 cursor-pointer">
					Not for me
				</button>
			</div>
		</motion.div>
	)
}

// ============================================================ Start page hero

export function HeroTop({ store, onPeek }: { store: Store2; onPeek: (t: Title) => void }) {
	const mobile = useIsMobile()
	const q = store.queueTitles
	const first = q[0]
	const rest = q.slice(1)
	const offer = first ? undefined : store.suggest.forYou(1)[0]
	const stage = first ?? offer
	return (
		<section className="relative isolate min-h-[34rem] overflow-hidden md:min-h-[40rem]" aria-label="Your next watch">
			<AnimatePresence mode="popLayout">
				{stage && (
					<motion.img
						key={stage.key}
						src={backdropUrl(stage, "original")}
						alt=""
						initial={{ opacity: 0, scale: 1.04 }}
						animate={{ opacity: first ? 1 : 0.55, scale: 1 }}
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
						<p className="mt-3 text-base text-gray-200 md:text-lg">{first.tagline || first.genres.join(", ")}</p>
						<div className="mt-5">
							<ServiceTiles title={first} size={44} max={3} names />
						</div>
						<div className="mt-6 flex flex-wrap items-center gap-2">
							<PlayButton title={first} />
							<button
								type="button"
								onClick={() => store.watched(first.key)}
								className="inline-flex h-12 items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white backdrop-blur hover:bg-white/20 cursor-pointer"
							>
								<CheckIcon className="h-5 w-5 text-green-400" />I watched it
							</button>
							{q.length > 1 && (
								<button type="button" onClick={() => store.move(first.key, q.length - 1)} className="inline-flex h-12 items-center gap-2 rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10 cursor-pointer">
									<ArrowUturnLeftIcon className="h-5 w-5" />
									Not tonight
								</button>
							)}
						</div>
					</motion.div>
				) : (
					<EmptyOffer store={store} t={offer} lead="Nothing in Watch next yet. Start with this?" />
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
											<button type="button" onClick={() => onPeek(t)} className="block max-w-full truncate text-left text-sm font-bold text-white hover:underline cursor-pointer">
												{t.title}
											</button>
											<p className="truncate text-xs text-gray-400">{watchLine(t).text}</p>
											<ItemActions store={store} title={t} className="mt-1.5 hidden md:flex" />
										</div>
									</div>
								</QItem>
							))}
						</Reorder.Group>
					</div>
				)}
			</div>
		</section>
	)
}

// ============================================================ Tonight

export function TonightTop({ store, onPeek }: { store: Store2; onPeek: (t: Title) => void }) {
	const q = store.queueTitles
	const pick = q[0]
	const deck = q.slice(1)
	const [now, setNow] = useState<Date | null>(null)
	useEffect(() => setNow(new Date()), [])
	const minutes = pick ? (pick.runtime ?? 110) : 0
	const doneBy = now && pick ? new Date(now.getTime() + minutes * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null
	const makeTonight = (t: Title) => store.add(t.key, "top")
	const offer = pick ? undefined : store.suggest.forYou(1)[0]
	return (
		<section className="relative isolate overflow-hidden" aria-label="Tonight">
			<div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_70%_at_30%_0%,rgba(251,191,36,.16),transparent_70%)]" />
			{(pick ?? offer) && <img src={backdropUrl((pick ?? offer)!, "w1280")} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-[0.12] blur-sm" />}
			<div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[auto_1fr_16rem] md:items-center md:py-14 lg:px-8">
				{pick || offer ? (
					<>
						<motion.button
							type="button"
							key={(pick ?? offer)!.key}
							initial={{ opacity: 0, rotateY: -12, y: 10 }}
							animate={{ opacity: 1, rotateY: 0, y: 0 }}
							transition={{ duration: 0.5 }}
							onClick={() => onPeek((pick ?? offer)!)}
							className="mx-auto w-[62vw] max-w-[20rem] cursor-pointer md:mx-0 md:w-[20rem]"
							style={{ perspective: 800 }}
						>
							<img src={posterUrl((pick ?? offer)!, "w500")} alt={(pick ?? offer)!.title} className="w-full rounded-xl shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/10" />
						</motion.button>
						{pick ? (
							<motion.div key={`${pick.key}-t`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
								<p className={`${DISPLAY} text-2xl text-amber-300 md:text-3xl`}>Tonight</p>
								<h1 className={`${DISPLAY} mt-1 text-4xl leading-[0.95] text-white md:text-6xl`}>{pick.title}</h1>
								<p className="mt-3 text-gray-300">{pick.tagline || pick.genres.join(", ")}</p>
								{doneBy && (
									<p className="mt-1 text-sm text-gray-400">
										{runtimeLabel(pick)}. Start now and you are done by {doneBy}.
									</p>
								)}
								<div className="mt-5">
									<ServiceTiles title={pick} size={44} max={3} names />
								</div>
								<div className="mt-6 flex flex-wrap gap-2">
									<PlayButton title={pick} />
									<button type="button" onClick={() => store.watched(pick.key)} className="inline-flex h-12 items-center gap-2 rounded-lg bg-white/10 px-4 font-semibold text-white hover:bg-white/20 cursor-pointer">
										<CheckIcon className="h-5 w-5 text-green-400" />
										Watched it
									</button>
									{deck[0] && (
										<button type="button" onClick={() => store.move(pick.key, 1)} className="inline-flex h-12 items-center gap-2 rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10 cursor-pointer">
											<ArrowUturnLeftIcon className="h-5 w-5" />
											Swap for {deck[0].title}
										</button>
									)}
								</div>
							</motion.div>
						) : (
							<EmptyOffer store={store} t={offer} lead="Nothing picked for tonight. How about this?" />
						)}
					</>
				) : (
					<div className="md:col-span-2">
						<h1 className={`${DISPLAY} mt-1 text-5xl text-white`}>Nothing picked yet</h1>
					</div>
				)}
				<div className="min-w-0">
					<p className="mb-2 text-sm font-semibold text-gray-300">If not that</p>
					<Reorder.Group axis="y" values={deck.map((t) => t.key)} onReorder={(keys) => pick && store.reorder([pick.key, ...keys])} className="flex flex-col gap-2">
						{deck.map((t, i) => (
							<QItem key={t.key} store={store} k={t.key} index={i + 1} label={t.title} className="rounded-lg" gripClassName="right-2 top-2 h-7 w-7">
								<div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/40 p-2 backdrop-blur">
									<img src={posterUrl(t, "w154")} alt="" draggable={false} className="h-20 w-[3.35rem] shrink-0 rounded-md object-cover" />
									<div className="min-w-0 flex-1 pr-6">
										<button type="button" onClick={() => onPeek(t)} className="block max-w-full truncate text-left text-sm font-bold text-white hover:underline cursor-pointer">
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
							<div key={i} className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-white/10 px-3 text-center text-xs text-gray-500">
								Open slot. Promote a Wishlist title below.
							</div>
						))}
					</Reorder.Group>
					<p className="mt-2 text-xs text-gray-500">Three at most. Anything pushed out goes back to Wishlist.</p>
				</div>
			</div>
		</section>
	)
}
