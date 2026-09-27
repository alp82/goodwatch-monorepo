// PROTOTYPE - throwaway. Variant `tonight` (bolder): one title, the whole screen. The page makes the decision:
// the best match from your Wishlist on your services, then the best new pick; "Not tonight" brings the next.
// Everything else waits below the fold. Guests get the this-or-that as a full-screen split, two backdrops
// facing each other, and after three answers the screen turns into their pick for tonight.
import { ArrowUturnLeftIcon, CheckIcon, PlayIcon, SparklesIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { ServiceTiles, watchLine } from "~/ui/prototype-rec-watch-next/kit"
import { backdropUrl, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, onMine, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { Coin, DISPLAY, Doors, EASE, MemberTeaser, MoodChip, PickGrid, SectionHead, ServicePick, Slab, SlabGuest, SlabWatchNext, Steps, Triage, WRAP, nextPair, picksNote, whyLine } from "./kit"
import type { Home } from "./model"

const SCREEN = "min-h-[36rem] h-[calc(100svh-4rem)] max-h-[60rem]"

export function TonightVariant({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const answered = h.answers.filter((a) => a.side !== "skip").length
	const [reveal, setReveal] = useState(false)
	const duel = h.guest && !reveal && nextPair(h) >= 0
	return (
		<div className="pb-44 md:pb-24">
			{duel ? <SplitDuel h={h} canReveal={answered >= 3} onReveal={() => setReveal(true)} /> : <OnePick h={h} onOpen={onOpen} onBack={h.guest ? () => setReveal(false) : undefined} />}
			<div className={`${WRAP} pt-12`}>
				{(!h.guest || !duel) && (
					<>
						<SectionHead title="Or choose yourself" note={picksNote(h)} />
						<PickGrid h={h} titles={h.picks.slice(0, 6)} onOpen={onOpen} />
					</>
				)}
				{h.guest && <MemberTeaser h={h} className="mt-12" />}
				<Doors h={h} compact className="mt-12" />
			</div>
			<Slab h={h}>{h.guest ? <SlabGuest h={h} /> : <SlabWatchNext h={h} />}</Slab>
		</div>
	)
}

// ------------------------------------------------------------------ one pick

function OnePick({ h, onOpen, onBack }: { h: Home; onOpen: (t: WTitle) => void; onBack?: () => void }) {
	const [skip, setSkip] = useState<string[]>([])
	const wish = h.watchNext.filter((t) => h.c.sel.everywhere || onMine(t))
	const deck = [...wish.map((t) => ({ t, wish: true })), ...h.picks.map((t) => ({ t, wish: false }))].filter((x) => !skip.includes(x.t.key))
	const cur = deck[0]
	const then = deck.slice(1, 4)
	if (!cur) return <section className={`${SCREEN} grid place-items-center text-gray-300`}>Nothing left for tonight.</section>
	const t = cur.t
	const w = watchLine(t)
	const moods = h.data.extra[t.key]?.m ?? []
	const next = () => setSkip((s) => [...s, t.key])
	return (
		<section className={`relative isolate overflow-hidden ${SCREEN}`} aria-label="Tonight">
			<AnimatePresence mode="popLayout" initial={false}>
				<motion.img key={t.key} src={backdropUrl(t, "original")} alt="" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1, ease: EASE }} className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]" />
			</AnimatePresence>
			<div className="absolute inset-0 -z-10 bg-gradient-to-t from-gray-900 via-gray-900/55 to-gray-900/10" />
			<div className="absolute inset-0 -z-10 bg-gradient-to-r from-gray-900/85 via-gray-900/20 to-transparent" />
			<div className={`${WRAP} flex h-full flex-col justify-end pb-10 md:pb-14`}>
				<div className="flex items-end justify-between gap-10">
					<AnimatePresence mode="wait" initial={false}>
						<motion.div key={t.key} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.35, ease: EASE }} className="min-w-0 max-w-4xl">
							<p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
								<span className="text-amber-300">Tonight</span>
								<span className="text-gray-300">{cur.wish ? "from your Wishlist" : "new to you"}</span>
								{moods.slice(0, 2).map((m) => (
									<MoodChip key={m} m={m} on={h.c.sel.moods.includes(m)} />
								))}
							</p>
							<button type="button" onClick={() => onOpen(t)} className="block cursor-pointer text-left">
								<h1 className={`${DISPLAY} mt-2 text-balance leading-[0.84] text-white [text-shadow:0_4px_40px_rgba(0,0,0,.5)] ${t.title.length > 20 ? "text-5xl md:text-8xl" : "text-6xl md:text-[9rem]"}`}>{t.title}</h1>
							</button>
							<p className="mt-4 max-w-2xl text-lg text-gray-100 md:text-xl">{whyLine(h, t) ? `${whyLine(h, t)}.` : t.tagline}</p>
							<div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-300">
								<Coin t={t} className="relative" />
								<span>{[t.year, runtimeLabel(t)].filter(Boolean).join(", ")}</span>
								<ServiceTiles title={t} size={32} max={2} />
							</div>
							<div className="mt-6 flex flex-wrap items-center gap-2">
								{w.offer && (
									<a href={`#play-${t.key}`} onClick={(e) => e.preventDefault()} className="inline-flex h-14 items-center gap-3 rounded-xl bg-white pl-2 pr-6 text-lg font-bold text-black shadow-2xl shadow-black/50 hover:bg-gray-200">
										<img src={w.offer.logo} alt="" className="h-10 w-10 rounded-lg" />
										<PlayIcon className="h-6 w-6" />
										{w.owned ? `Play on ${w.offer.name}` : `Open ${w.offer.name}`}
									</a>
								)}
								<button type="button" onClick={next} data-next className="inline-flex h-14 cursor-pointer items-center rounded-xl bg-white/10 px-5 text-base font-semibold text-white backdrop-blur hover:bg-white/20">
									Not tonight
								</button>
								{cur.wish ? (
									<button type="button" onClick={() => h.q.watched(t.key)} className="inline-flex h-14 cursor-pointer items-center gap-2 rounded-xl px-4 font-semibold text-gray-200 hover:bg-white/10">
										<CheckIcon className="h-5 w-5 text-green-400" />I watched it
									</button>
								) : (
									<Triage h={h} t={t} tone="hero" />
								)}
							</div>
							{onBack && (
								<button type="button" onClick={onBack} className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white">
									<ArrowUturnLeftIcon className="h-4 w-4" />
									Answer more this-or-thats
								</button>
							)}
						</motion.div>
					</AnimatePresence>
					{then.length > 0 && (
						<div className="hidden shrink-0 lg:block">
							<p className="mb-2 text-sm font-semibold text-gray-300">If not, then</p>
							<div className="flex gap-2">
								{then.map((x) => (
									<button key={x.t.key} type="button" onClick={() => setSkip((s) => [...s, ...deck.slice(0, deck.indexOf(x)).map((d) => d.t.key)])} className="w-24 cursor-pointer" aria-label={`Show ${x.t.title}`}>
										<img src={posterUrl(x.t, "w185")} alt="" className="aspect-[2/3] w-full rounded-lg object-cover opacity-80 ring-1 ring-white/15 transition-opacity hover:opacity-100" />
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</section>
	)
}

// ------------------------------------------------------------------ guests: split this-or-that

function SplitDuel({ h, canReveal, onReveal }: { h: Home; canReveal: boolean; onReveal: () => void }) {
	const i = nextPair(h)
	const p = h.data.pairs[i]
	const [hot, setHot] = useState<"a" | "b" | null>(null)
	if (!p) return null
	const half = (k: string, s: "a" | "b", label: string) => {
		const t = h.T(k)
		if (!t) return null
		return (
			<motion.button
				type="button"
				data-duel={s}
				onClick={() => (setHot(null), h.pickSide(i, s))}
				onPointerEnter={() => setHot(s)}
				onPointerLeave={() => setHot(null)}
				animate={{ flexGrow: hot === s ? 1.25 : hot ? 0.8 : 1 }}
				transition={{ duration: 0.4, ease: EASE }}
				className="group relative isolate flex min-h-0 min-w-0 flex-1 basis-0 cursor-pointer flex-col justify-end overflow-hidden p-5 pb-8 text-left md:justify-center md:p-12"
			>
				<motion.img key={t.key} src={backdropUrl(t, "w1280")} alt="" initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: EASE }} className="absolute inset-0 -z-10 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105" />
				<span className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/40 to-black/20 transition-colors group-hover:via-black/20" />
				<span className={`${DISPLAY} block text-4xl leading-[0.9] text-white md:text-7xl`}>{label}</span>
				<span className="mt-2 flex items-center gap-3">
					<img src={posterUrl(t, "w92")} alt="" className="h-14 w-10 rounded object-cover ring-1 ring-white/20 md:h-20 md:w-14" />
					<span className="min-w-0 text-sm text-gray-200 md:text-base">
						<span className="block truncate font-bold text-white">{t.title}</span>
						{t.year}
					</span>
				</span>
			</motion.button>
		)
	}
	return (
		<section className={`relative ${SCREEN}`} aria-label="This or that">
			<AnimatePresence mode="wait" initial={false}>
				<motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="flex h-full flex-col md:flex-row">
					{half(p.a, "a", p.left)}
					{half(p.b, "b", p.right)}
				</motion.div>
			</AnimatePresence>
			<div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent pb-16 pt-5">
				<div className={`${WRAP} pointer-events-auto flex flex-wrap items-center justify-between gap-3`}>
					<div>
						<h1 className={`${DISPLAY} text-3xl text-white md:text-4xl`}>Which one, tonight?</h1>
						<Steps n={h.data.pairs.length} at={h.answers.length} className="mt-2" />
					</div>
					<div className="flex items-center gap-2">
						<button type="button" onClick={() => h.pickSide(i, "skip")} className="h-10 cursor-pointer rounded-full bg-black/40 px-4 text-sm font-semibold text-gray-200 backdrop-blur hover:bg-black/60">
							Skip
						</button>
						{canReveal && (
							<button type="button" onClick={onReveal} data-reveal className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-amber-400 px-4 text-sm font-bold text-black hover:bg-amber-300">
								<SparklesIcon className="h-4 w-4" />
								Show tonight's pick
							</button>
						)}
					</div>
				</div>
			</div>
			<span className={`${DISPLAY} pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gray-900 text-xl text-white ring-4 ring-gray-900/40 md:h-20 md:w-20 md:text-2xl`}>or</span>
			<div id="services" className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent pt-10 pb-4 max-md:hidden">
				<div className={`${WRAP} flex flex-wrap items-center gap-3`}>
					<span className="text-sm font-semibold text-gray-300">Where do you watch?</span>
					<ServicePick h={h} />
				</div>
			</div>
		</section>
	)
}
