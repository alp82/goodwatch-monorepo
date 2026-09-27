// PROTOTYPE - throwaway. Variant `hero` (existing components): Watch next leads. Members land on the settled
// start hero (Wishlist top on their services, Best match, Then column, docked moods), then picks they haven't
// seen, then the doors. Guests land on a hero that asks for services and a few this-or-thats; once three are
// answered, the hero turns into their first pick and the grid below has sorted itself to their taste.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { ServiceTiles } from "~/ui/prototype-rec-watch-next/kit"
import { backdropUrl } from "~/ui/prototype-rec-watch-next/model"
import type { WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { DISPLAY, Doors, Duel, EASE, Elsewhere, MemberTeaser, PickGrid, SectionHead, ServicePick, Slab, SlabGuest, SlabWatchNext, TasteLine, Triage, WRAP, WatchNextHero, nextPair, picksNote, whyLine } from "./kit"
import type { Home } from "./model"

export function HeroVariant({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const [n, setN] = useState(12)
	return (
		<div className="pb-44 md:pb-24">
			{h.guest ? <GuestHero h={h} onOpen={onOpen} /> : <WatchNextHero h={h} onOpen={onOpen} />}
			<div className={`${WRAP} pt-10`}>
				<SectionHead title={h.guest ? (h.hasTaste ? "Picked for you" : "Start here") : "New to you"} note={picksNote(h)} right={<Elsewhere h={h} />} />
				<PickGrid h={h} titles={h.picks.slice(h.guest && h.hasTaste ? 1 : 0, n)} onOpen={onOpen} />
				{h.picks.length > n && (
					<button type="button" onClick={() => setN(n + 12)} className="mx-auto mt-6 block h-11 cursor-pointer rounded-full bg-white/10 px-6 text-sm font-semibold text-white hover:bg-white/20">
						Show more
					</button>
				)}
				<TasteLine h={h} className="mt-8" />
				{h.guest && <MemberTeaser h={h} className="mt-12" />}
				<Doors h={h} className="mt-12" />
			</div>
			<Slab h={h}>{h.guest ? <SlabGuest h={h} /> : <SlabWatchNext h={h} />}</Slab>
		</div>
	)
}

// Before three answers: services and the duel. After: the best pick so far, with the duel still beside it.
function GuestHero({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const ready = h.answers.filter((a) => a.side !== "skip").length >= 3 || h.loved.length >= 3
	const top = ready ? h.picks[0] : undefined
	const pair = h.data.pairs[nextPair(h)]
	const art = top ?? (pair ? h.T(pair.a) : h.picks[0])
	return (
		<section className="relative isolate overflow-hidden" aria-label="Tonight's pick">
			<AnimatePresence mode="popLayout" initial={false}>
				{art && (
					<motion.img key={art.key} src={backdropUrl(art, "original")} alt="" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: top ? 1 : 0.35, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: EASE }} className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]" />
				)}
			</AnimatePresence>
			<div className="absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/80 to-gray-900/30 md:bg-gradient-to-r md:from-gray-900 md:via-gray-900/80 md:to-gray-900/10" />
			<div className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-gray-900 to-transparent" />
			<div className={`${WRAP} grid min-h-[36rem] items-center gap-8 pb-10 pt-10 md:min-h-[40rem] md:grid-cols-[1fr_24rem] md:gap-12 lg:grid-cols-[1fr_28rem]`}>
				<AnimatePresence mode="wait" initial={false}>
					{top ? (
						<motion.div key={top.key} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3, ease: EASE }} className="min-w-0">
							<p className="text-sm font-semibold text-amber-300">Your first pick{h.hasServices ? ", on your services" : ""}</p>
							<button type="button" onClick={() => onOpen(top)} className="block cursor-pointer text-left">
								<h1 className={`${DISPLAY} mt-1 leading-[0.9] text-white ${top.title.length > 22 ? "text-4xl md:text-6xl" : "text-5xl md:text-7xl lg:text-[6.5rem]"}`}>{top.title}</h1>
							</button>
							<p className="mt-3 text-base text-gray-200 md:text-lg">{whyLine(h, top) ?? top.tagline}.</p>
							<p className="mt-1 text-sm text-gray-400">{[top.year, runtimeLabel(top), top.match ? `${top.match}% taste match` : null].filter(Boolean).join(", ")}</p>
							<div className="mt-5">
								<ServiceTiles title={top} size={44} max={3} names />
							</div>
							<Triage h={h} t={top} tone="hero" className="mt-6" />
						</motion.div>
					) : (
						<motion.div key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-w-0 max-w-xl">
							<h1 className={`${DISPLAY} text-5xl leading-[0.92] text-white md:text-7xl`}>Tonight's pick, in a minute.</h1>
							<p className="mt-4 text-lg text-gray-200">Tell us where you watch and choose between a few pairs. No account, no rating lists.</p>
							<div id="services" className="mt-7">
								<p className="mb-2 text-sm font-semibold text-gray-300">Where do you watch?</p>
								<ServicePick h={h} />
							</div>
						</motion.div>
					)}
				</AnimatePresence>
				<div className="min-w-0">
					{pair ? (
						<div className="rounded-2xl bg-black/50 p-4 ring-1 ring-white/10 backdrop-blur-md">
							<p className="mb-3 font-semibold text-white">{ready ? "Sharpen it" : "Which one, tonight?"}</p>
							<Duel h={h} />
						</div>
					) : (
						<div className="rounded-2xl bg-black/50 p-5 ring-1 ring-white/10 backdrop-blur-md">
							<p className="font-semibold text-white">That's all six.</p>
							<p className="mt-1 text-sm text-gray-300">Your picks below are sorted to these answers.</p>
							<button type="button" onClick={h.resetGuest} className="mt-3 cursor-pointer text-sm font-semibold text-amber-400">
								Start over
							</button>
						</div>
					)}
					{top && (
						<div id="services" className="mt-5">
							<p className="mb-2 text-sm font-semibold text-gray-300">Your services</p>
							<ServicePick h={h} />
						</div>
					)}
				</div>
			</div>
		</section>
	)
}
