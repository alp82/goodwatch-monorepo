// PROTOTYPE - throwaway. Variant `split` (existing components): yours and new, side by side. On a desktop the
// left column is Watch next (the Wishlist's best match on your services, then the next ones) and stays put
// while the right column scrolls through new picks. On a phone the two are tabs in the bottom slab. Guests get
// the this-or-that in the left column, so every answer visibly re-sorts the picks next to it.
import { PlayIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { useIsMobile, watchLine } from "~/ui/prototype-rec-watch-next/kit"
import { backdropUrl, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { ServicesToggle } from "~/ui/prototype-rec-watch-next-7/kit7"
import { Coin, DISPLAY, Doors, Duel, EASE, Elsewhere, MemberTeaser, MoodChip, PickGrid, SectionHead, ServicePick, Slab, TasteLine, WRAP, nextPair, picksNote } from "./kit"
import { type Home, WATCH_NEXT_HREF } from "./model"

type Tab = "yours" | "new"

export function SplitVariant({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const mobile = useIsMobile()
	const [tab, setTab] = useState<Tab>("yours")
	const [n, setN] = useState(16)
	const show = (x: Tab) => !mobile || tab === x
	return (
		<div className="pb-44 md:pb-24">
			<div className={`${WRAP} pt-6 md:pt-10`}>
				<div className="grid gap-10 lg:grid-cols-[24rem_1fr] xl:grid-cols-[26rem_1fr]">
					{show("yours") && (
						<aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
							{h.guest ? <GuestColumn h={h} /> : <YoursColumn h={h} onOpen={onOpen} />}
						</aside>
					)}
					{show("new") && (
						<section className="min-w-0">
							<SectionHead title={h.guest ? "Picks" : "New to you"} note={picksNote(h)} right={<Elsewhere h={h} />} />
							<PickGrid h={h} titles={h.picks.slice(0, n)} onOpen={onOpen} className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-4" />
							{h.picks.length > n && (
								<button type="button" onClick={() => setN(n + 16)} className="mx-auto mt-6 block h-11 cursor-pointer rounded-full bg-white/10 px-6 text-sm font-semibold text-white hover:bg-white/20">
									Show more
								</button>
							)}
						</section>
					)}
				</div>
				{h.guest && <MemberTeaser h={h} className="mt-14" />}
				<Doors h={h} className="mt-14" />
			</div>
			<Slab h={h}>
				<div className="flex h-11 flex-1 items-stretch gap-1 rounded-[16px] bg-white/[0.05] p-1 ring-1 ring-white/10" role="tablist">
					{(
						[
							["yours", h.guest ? "Quick start" : "Watch next"],
							["new", h.guest ? "Picks" : "New to you"],
						] as const
					).map(([k, label]) => (
						<button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => (setTab(k), window.scrollTo({ top: 0 }))} className={`relative flex-1 cursor-pointer rounded-[12px] text-sm font-bold ${tab === k ? "text-black" : "text-gray-300"}`}>
							{tab === k && <motion.span layoutId="split-tab" className="absolute inset-0 rounded-[12px] bg-white" />}
							<span className="relative">{label}</span>
						</button>
					))}
				</div>
			</Slab>
		</div>
	)
}

function YoursColumn({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const [first, ...rest] = h.watchNext
	const moods = first ? (h.data.extra[first.key]?.m ?? []) : []
	return (
		<>
			<div className="mb-4 flex items-end justify-between gap-3">
				<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>Watch next</h2>
				{h.hasServices && <ServicesToggle c={h.c} compact />}
			</div>
			{first ? (
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.article key={first.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.28, ease: EASE }} className="relative isolate overflow-hidden rounded-2xl bg-gray-950 ring-1 ring-white/10">
						<button type="button" onClick={() => onOpen(first)} className="block w-full cursor-pointer text-left">
							<img src={backdropUrl(first, "w780")} alt="" className="aspect-[16/10] w-full object-cover object-[center_25%]" />
							<span className="absolute inset-x-0 top-0 -z-0 block aspect-[16/10] bg-gradient-to-t from-gray-950 via-gray-950/30 to-transparent" />
						</button>
						<div className="relative -mt-20 p-4 pt-0">
							<Coin t={first} className="relative mb-2" />
							<h3 className={`${DISPLAY} text-3xl leading-[0.95] text-white`}>{first.title}</h3>
							<p className="mt-1 text-sm text-gray-400">{[first.year, runtimeLabel(first), watchLine(first).text].filter(Boolean).join(", ")}</p>
							{moods.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-1.5">
									{moods.slice(0, 3).map((m) => (
										<MoodChip key={m} m={m} />
									))}
								</div>
							)}
							<div className="mt-4 flex gap-2">
								{watchLine(first).offer && (
									<a href={`#play-${first.key}`} onClick={(e) => e.preventDefault()} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 font-bold text-black hover:bg-gray-200">
										<img src={watchLine(first).offer!.logo} alt="" className="h-7 w-7 rounded-md" />
										<PlayIcon className="h-5 w-5" />
										Play
									</a>
								)}
								<button type="button" onClick={() => h.q.watched(first.key)} className="inline-flex h-11 cursor-pointer items-center whitespace-nowrap rounded-lg bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20">
									I watched it
								</button>
								<button type="button" onClick={() => h.pass(first.key)} className="inline-flex h-11 cursor-pointer items-center whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-gray-300 hover:bg-white/10">
									Not tonight
								</button>
							</div>
						</div>
					</motion.article>
				</AnimatePresence>
			) : (
				<p className="rounded-2xl bg-white/5 p-5 text-gray-300">Your Wishlist is empty. Tap Want to See on anything to the right, and it lands here.</p>
			)}
			{rest.length > 0 && (
				<ol className="mt-4 flex flex-col gap-1">
					<AnimatePresence initial={false}>
						{rest.slice(0, 5).map((t) => (
							<motion.li key={t.key} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
								<button type="button" onClick={() => onOpen(t)} className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-1.5 text-left hover:bg-white/5">
									<img src={posterUrl(t, "w92")} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
									<span className="min-w-0 flex-1">
										<span className="block truncate font-semibold text-white">{t.title}</span>
										<span className="block truncate text-xs text-gray-400">{watchLine(t).text}</span>
									</span>
									{t.match != null && <span className="shrink-0 text-sm font-bold tabular-nums text-amber-400">{t.match}</span>}
								</button>
							</motion.li>
						))}
					</AnimatePresence>
				</ol>
			)}
			<Link to={WATCH_NEXT_HREF} className="mt-3 inline-block text-sm font-semibold text-amber-400 hover:text-amber-300">
				Your whole Wishlist ({h.q.count}), moods and sorts
			</Link>
			<TasteLine h={h} className="mt-6" />
		</>
	)
}

function GuestColumn({ h }: { h: Home }) {
	const more = nextPair(h) >= 0
	return (
		<>
			<h1 className={`${DISPLAY} text-4xl leading-[0.95] text-white md:text-5xl`}>{h.hasTaste ? "Getting warmer." : "Start with two quick things."}</h1>
			<p className="mt-2 text-gray-300">Each answer re-sorts the picks {h.hasTaste ? "" : "next to this"} right away.</p>
			<div id="services" className="mt-6">
				<p className="mb-2 text-sm font-semibold text-gray-300">Where do you watch?</p>
				<ServicePick h={h} />
			</div>
			<div className="mt-7">
				<p className="mb-2 text-sm font-semibold text-gray-300">Which one, tonight?</p>
				{more ? (
					<Duel h={h} />
				) : (
					<p className="text-sm text-gray-300">
						That's all six.{" "}
						<button type="button" onClick={h.resetGuest} className="cursor-pointer font-semibold text-amber-400">
							Start over
						</button>
					</p>
				)}
			</div>
			<TasteLine h={h} className="mt-6" />
		</>
	)
}

