// PROTOTYPE - throwaway. Variant `picks` (existing components), grown from Taste round 1's `hub`: picks first.
// Members get Watch next as one slim shelf (the best match as a wide card, the next ones as posters), then a
// large grid of picks with their "why" lines. Guests start by tapping three titles they love on a poster wall;
// the grid under it sorts itself after every tap.
import { PlayIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { useIsMobile, watchLine } from "~/ui/prototype-rec-watch-next/kit"
import { backdropUrl, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import type { WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { ServicesToggle } from "~/ui/prototype-rec-watch-next-7/kit7"
import { Coin, DISPLAY, Doors, EASE, Elsewhere, FavWall, MemberTeaser, PickGrid, SectionHead, ServicePick, Slab, SlabGuest, SlabWatchNext, TasteLine, WRAP, picksNote } from "./kit"
import { type Home, WATCH_NEXT_HREF } from "./model"

export function PicksVariant({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const [n, setN] = useState(8)
	return (
		<div className="pb-44 md:pb-24">
			<div className={`${WRAP} pt-6 md:pt-10`}>
				{h.guest ? <GuestWall h={h} /> : <Shelf h={h} onOpen={onOpen} />}
				<section className="mt-12">
					<SectionHead title={h.guest ? (h.hasTaste ? "Picked for you" : "Popular right now") : "Picked for you tonight"} note={picksNote(h)} right={<Elsewhere h={h} />} />
					<PickGrid h={h} titles={h.picks.slice(0, n)} onOpen={onOpen} className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4" />
					{h.picks.length > n && (
						<button type="button" onClick={() => setN(n + 8)} className="mx-auto mt-6 block h-11 cursor-pointer rounded-full bg-white/10 px-6 text-sm font-semibold text-white hover:bg-white/20">
							Show more
						</button>
					)}
				</section>
				<TasteLine h={h} className="mt-8" />
				{h.guest && <MemberTeaser h={h} className="mt-12" />}
				<Doors h={h} className="mt-12" />
			</div>
			<Slab h={h}>{h.guest ? <SlabGuest h={h} /> : <SlabWatchNext h={h} />}</Slab>
		</div>
	)
}

function Shelf({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const mobile = useIsMobile()
	const [first, ...rest] = h.watchNext
	return (
		<section aria-label="Watch next">
			<div className="mb-3 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className={`${DISPLAY} text-3xl text-white md:text-4xl`}>Watch next</h1>
					<p className="text-sm text-gray-400">Your Wishlist, best match first{h.c.sel.everywhere ? "" : ", on your services"}.</p>
				</div>
				<div className="flex items-center gap-3">
					{!mobile && h.hasServices && <ServicesToggle c={h.c} />}
					<Link to={WATCH_NEXT_HREF} className="text-sm font-semibold text-amber-400 hover:text-amber-300">
						All {h.q.count}
					</Link>
				</div>
			</div>
			{first ? (
				<div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
					<AnimatePresence mode="popLayout" initial={false}>
						<motion.article key={first.key} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.28, ease: EASE }} className="relative isolate w-[19rem] shrink-0 snap-start overflow-hidden rounded-xl bg-gray-950 ring-1 ring-amber-500/40 md:w-[28rem]">
							<button type="button" onClick={() => onOpen(first)} className="absolute inset-0 -z-10 cursor-pointer" aria-label={`${first.title} details`}>
								<img src={backdropUrl(first, "w780")} alt="" className="h-full w-full object-cover object-[center_25%]" />
								<span className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />
							</button>
							<div className="pointer-events-none flex aspect-[2/3] flex-col justify-end p-4 sm:aspect-auto sm:h-full sm:min-h-[16rem] md:min-h-[18rem]">
								<Coin t={first} className="relative mb-2" />
								<h2 className={`${DISPLAY} text-3xl leading-[0.95] text-white md:text-4xl`}>{first.title}</h2>
								<p className="mt-1 text-sm text-gray-300">{watchLine(first).text}</p>
								<div className="pointer-events-auto mt-3 flex gap-2">
									{watchLine(first).offer && (
										<a href={`#play-${first.key}`} onClick={(e) => e.preventDefault()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-white pl-1.5 pr-4 text-sm font-bold text-black hover:bg-gray-200">
											<img src={watchLine(first).offer!.logo} alt="" className="h-7 w-7 rounded-md" />
											<PlayIcon className="h-4 w-4" />
											Play
										</a>
									)}
									<button type="button" onClick={() => h.pass(first.key)} className="inline-flex h-10 cursor-pointer items-center rounded-lg bg-black/40 px-3 text-sm font-semibold text-gray-200 backdrop-blur hover:bg-black/60">
										Not tonight
									</button>
								</div>
							</div>
						</motion.article>
					</AnimatePresence>
					{rest.slice(0, 10).map((t) => (
						<button key={t.key} type="button" onClick={() => onOpen(t)} className="w-28 shrink-0 cursor-pointer snap-start text-left md:w-[11.5rem]">
							<img src={posterUrl(t, "w342")} alt="" className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-white/10 hover:ring-white/40" />
							<span className="mt-1 block truncate text-xs text-gray-400">{watchLine(t).text}</span>
						</button>
					))}
				</div>
			) : (
				<p className="rounded-xl bg-white/5 p-5 text-gray-300">Nothing on your Wishlist yet. Tap Want to See on a pick below and it shows up here.</p>
			)}
		</section>
	)
}

function GuestWall({ h }: { h: Home }) {
	const mobile = useIsMobile()
	const n = h.loved.length
	return (
		<section aria-label="Tap three you love">
			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className={`${DISPLAY} text-4xl leading-[0.95] text-white md:text-5xl`}>{n >= 3 ? "Nice. Keep going if you like." : "Tap three you love."}</h1>
					<p className="mt-1 text-gray-300">{n ? `${n} picked. The grid below re-sorts after every tap.` : "Films or shows. The picks below sort themselves to your taste as you tap."}</p>
				</div>
			</div>
			<FavWall h={h} limit={mobile ? 12 : 18} className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:gap-3 lg:grid-cols-9" />
			<div id="services" className="mt-6">
				<p className="mb-2 text-sm font-semibold text-gray-300">Where do you watch?</p>
				<ServicePick h={h} />
			</div>
		</section>
	)
}
