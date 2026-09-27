// PROTOTYPE - throwaway. Variant `guided` (existing components): the page asks, then answers. Guests go
// through a first run: services, up to six this-or-thats, then their first picks. Members get "tonight in two
// taps": what kind of night (round 7's mood grid, counted over their Wishlist), then Wishlist or something new,
// then three options side by side. Every step can be skipped.
import { ArrowUturnLeftIcon, CheckIcon, SparklesIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { ServiceTiles, watchLine } from "~/ui/prototype-rec-watch-next/kit"
import { backdropUrl, posterUrl } from "~/ui/prototype-rec-watch-next/model"
import { type WTitle, onMine, runtimeLabel } from "~/ui/prototype-rec-watch-next-2/model"
import { grid } from "~/ui/prototype-rec-watch-next-7/variants"
import { moodWords } from "~/ui/prototype-rec-watch-next-7/view"
import { Coin, DISPLAY, Doors, Duel, EASE, Elsewhere, MemberTeaser, PickGrid, SectionHead, ServicePick, Slab, TasteLine, Triage, WRAP, nextPair, picksNote, whyLine } from "./kit"
import type { Home } from "./model"

const SWAP = { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -40 }, transition: { duration: 0.26, ease: EASE } } as const

function StepBar({ steps, at, onStep }: { steps: string[]; at: number; onStep: (i: number) => void }) {
	return (
		<ol className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
			{steps.map((s, i) => (
				<li key={s}>
					<button type="button" disabled={i > at} onClick={() => onStep(i)} className={`flex cursor-pointer items-center gap-2 disabled:cursor-default ${i === at ? "text-white" : i < at ? "text-gray-300 hover:text-white" : "text-gray-600"}`}>
						<span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${i === at ? "bg-amber-400 text-black" : i < at ? "bg-white/15" : "ring-1 ring-white/15"}`}>{i + 1}</span>
						{s}
					</button>
				</li>
			))}
		</ol>
	)
}

export function GuidedVariant({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	return (
		<div className="pb-44 md:pb-24">
			{h.guest ? <GuestRun h={h} onOpen={onOpen} /> : <Tonight h={h} onOpen={onOpen} />}
			<div className={WRAP}>
				<Doors h={h} className="mt-14" />
			</div>
			<Slab h={h} />
		</div>
	)
}

// ------------------------------------------------------------------ guests

function GuestRun({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const [step, setStep] = useState(0)
	const answered = h.answers.filter((a) => a.side !== "skip").length
	const at = step === 1 && nextPair(h) < 0 ? 2 : step
	const [n, setN] = useState(12)
	return (
		<>
			<section className="relative isolate overflow-hidden">
				<Backdrop t={at === 2 ? h.picks[0] : h.T(h.data.pairs[Math.max(0, nextPair(h))]?.a ?? "")} dim={at !== 2} />
				<div className={`${WRAP} min-h-[34rem] pb-10 pt-8 md:min-h-[38rem] md:pt-12`}>
					<StepBar steps={["Your services", "This or that", "Your picks"]} at={at} onStep={setStep} />
					<AnimatePresence mode="wait" initial={false}>
						{at === 0 && (
							<motion.div key="s0" {...SWAP} className="mt-10 max-w-3xl">
								<h1 className={`${DISPLAY} text-5xl leading-[0.92] text-white md:text-7xl`}>Where do you watch?</h1>
								<p className="mt-3 text-lg text-gray-300">Pick every service you have. Your picks stay on them, with a one-tap way out.</p>
								<ServicePick h={h} size="lg" className="mt-7" />
								<div className="mt-8 flex gap-2">
									<button type="button" onClick={() => setStep(1)} className="h-12 cursor-pointer rounded-lg bg-white px-6 font-bold text-black hover:bg-gray-200">
										{h.mine.length ? "Continue" : "Continue without"}
									</button>
								</div>
							</motion.div>
						)}
						{at === 1 && (
							<motion.div key="s1" {...SWAP} className="mt-8 grid gap-8 md:grid-cols-[1fr_30rem] md:items-center">
								<div className="max-w-md">
									<h1 className={`${DISPLAY} text-5xl leading-[0.92] text-white md:text-6xl`}>Which one, tonight?</h1>
									<p className="mt-3 text-lg text-gray-300">No need to have seen them. Go with your gut; three answers are enough, six are better.</p>
									{answered >= 3 && (
										<button type="button" onClick={() => setStep(2)} className="mt-6 inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-amber-400 px-6 font-bold text-black hover:bg-amber-300">
											<SparklesIcon className="h-5 w-5" />
											Show my picks
										</button>
									)}
								</div>
								<Duel h={h} size="lg" />
							</motion.div>
						)}
						{at === 2 && (
							<motion.div key="s2" {...SWAP} className="mt-8">
								<h1 className={`${DISPLAY} text-5xl leading-[0.92] text-white md:text-7xl`}>Here's tonight.</h1>
								<TasteLine h={h} className="mt-3 text-base" />
								<div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
									{h.picks.slice(0, 3).map((t, i) => (
										<Option key={t.key} h={h} t={t} onOpen={onOpen} className={i === 2 ? "hidden md:block" : ""} />
									))}
								</div>
								<button type="button" onClick={() => setStep(1)} className="mt-6 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white">
									<ArrowUturnLeftIcon className="h-4 w-4" />
									Change my answers
								</button>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</section>
			{at === 2 && (
				<div className={`${WRAP} pt-10`}>
					<SectionHead title="More for you" note={picksNote(h)} right={<Elsewhere h={h} />} />
					<PickGrid h={h} titles={h.picks.slice(3, 3 + n)} onOpen={onOpen} />
					{h.picks.length > 3 + n && (
						<button type="button" onClick={() => setN(n + 12)} className="mx-auto mt-6 block h-11 cursor-pointer rounded-full bg-white/10 px-6 text-sm font-semibold text-white hover:bg-white/20">
							Show more
						</button>
					)}
					<MemberTeaser h={h} className="mt-12" />
				</div>
			)}
		</>
	)
}

// ------------------------------------------------------------------ members

function Tonight({ h, onOpen }: { h: Home; onOpen: (t: WTitle) => void }) {
	const [step, setStep] = useState(0)
	const [from, setFrom] = useState<"wish" | "new">("wish")
	const moods = h.c.sel.moods
	const inMood = (t: WTitle) => !moods.length || moods.some((m) => h.data.extra[t.key]?.m.includes(m))
	const fromWish = h.watchNext.filter((t) => inMood(t) && (h.c.sel.everywhere || onMine(t)))
	const fromNew = h.picks.filter(inMood)
	const options = (from === "wish" ? fromWish : fromNew).slice(0, 3)
	const art = step === 2 ? options[0] : (fromWish[0] ?? h.picks[0])
	return (
		<section className="relative isolate overflow-hidden">
			<Backdrop t={art} dim={step !== 2} />
			<div className={`${WRAP} min-h-[34rem] pb-10 pt-8 md:min-h-[38rem] md:pt-12`}>
				<StepBar steps={["Kind of night", "Where from", "Three options"]} at={step} onStep={setStep} />
				<AnimatePresence mode="wait" initial={false}>
					{step === 0 && (
						<motion.div key="m0" {...SWAP} className="mt-8">
							<div className="flex flex-wrap items-end justify-between gap-4">
								<h1 className={`${DISPLAY} text-5xl leading-[0.92] text-white md:text-7xl`}>What kind of night?</h1>
								<div className="flex gap-2">
									<button type="button" onClick={() => (h.c.setSel({ ...h.c.sel, moods: [] }), setStep(1))} className="h-12 cursor-pointer rounded-lg px-4 font-semibold text-gray-300 hover:bg-white/10">
										Any mood
									</button>
									<button type="button" onClick={() => setStep(1)} className="h-12 cursor-pointer rounded-lg bg-white px-6 font-bold text-black hover:bg-gray-200">
										{moods.length ? `Continue with ${moodWords(moods)}` : "Continue"}
									</button>
								</div>
							</div>
							<div className="mt-6 overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10 backdrop-blur-md">
								<grid.Panel c={h.c} pinned={false} />
							</div>
						</motion.div>
					)}
					{step === 1 && (
						<motion.div key="m1" {...SWAP} className="mt-8">
							<h1 className={`${DISPLAY} text-5xl leading-[0.92] text-white md:text-7xl`}>{moods.length ? `${moodWords(moods)}. From where?` : "From where?"}</h1>
							<div className="mt-8 grid gap-4 md:grid-cols-2">
								<Choice
									title="From my Wishlist"
									line={fromWish.length ? `${fromWish.length} fit${h.c.sel.everywhere ? "" : " on your services"}, best match first.` : "Nothing on your Wishlist fits. Try something new."}
									titles={fromWish}
									onClick={() => (setFrom("wish"), setStep(2))}
									disabled={!fromWish.length}
								/>
								<Choice title="Something new" line="Not seen yet, on your services, closest to your taste." titles={fromNew} onClick={() => (setFrom("new"), setStep(2))} />
							</div>
						</motion.div>
					)}
					{step === 2 && (
						<motion.div key="m2" {...SWAP} className="mt-8">
							<h1 className={`${DISPLAY} text-5xl leading-[0.92] text-white md:text-7xl`}>Three for tonight.</h1>
							<p className="mt-2 text-gray-300">{from === "wish" ? "From your Wishlist" : "New to you"}{moods.length ? `, ${moodWords(moods).toLowerCase()}` : ""}.</p>
							<div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
								{options.map((t, i) => (
									<Option key={t.key} h={h} t={t} onOpen={onOpen} wish={from === "wish"} className={i === 2 ? "hidden md:block" : ""} />
								))}
							</div>
							<button type="button" onClick={() => setStep(0)} className="mt-6 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white">
								<ArrowUturnLeftIcon className="h-4 w-4" />
								Start over
							</button>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</section>
	)
}

function Choice({ title, line, titles, onClick, disabled = false }: { title: string; line: string; titles: WTitle[]; onClick: () => void; disabled?: boolean }) {
	return (
		<button type="button" onClick={onClick} disabled={disabled} className="group relative isolate flex min-h-[13rem] cursor-pointer items-end overflow-hidden rounded-2xl bg-gray-950/80 p-6 text-left ring-1 ring-white/10 transition-shadow hover:ring-amber-400/60 disabled:cursor-not-allowed disabled:opacity-50">
			<span className="absolute -right-6 top-5 -z-10 flex -space-x-10 transition-transform duration-500 group-hover:-translate-x-3">
				{titles.slice(0, 3).map((t, i) => (
					<img key={t.key} src={posterUrl(t, "w342")} alt="" className="h-44 w-30 rounded-lg object-cover shadow-2xl shadow-black ring-1 ring-white/10" style={{ transform: `rotate(${(i - 1) * 6}deg)` }} />
				))}
			</span>
			<span className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/80 to-transparent" />
			<span className="max-w-[60%]">
				<span className={`${DISPLAY} block text-3xl text-white`}>{title}</span>
				<span className="mt-1 block text-sm text-gray-300">{line}</span>
			</span>
		</button>
	)
}

function Option({ h, t, onOpen, wish = false, className = "" }: { h: Home; t: WTitle; onOpen: (t: WTitle) => void; wish?: boolean; className?: string }) {
	const w = watchLine(t)
	return (
		<motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className={`min-w-0 ${className}`}>
			<button type="button" onClick={() => onOpen(t)} className="relative block w-full cursor-pointer">
				<img src={posterUrl(t, "w500")} alt="" className="aspect-[2/3] w-full rounded-xl object-cover shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/10" />
				<Coin t={t} className="absolute left-2 top-2" />
			</button>
			<h3 className="mt-3 truncate text-lg font-bold text-white">{t.title}</h3>
			<p className="truncate text-sm text-gray-400">{[runtimeLabel(t), w.text].join(", ")}</p>
			{whyLine(h, t) && <p className="mt-1 line-clamp-2 text-sm text-gray-300">{whyLine(h, t)}.</p>}
			{wish ? (
				<div className="mt-3 flex flex-wrap gap-2">
					<ServiceTiles title={t} size={32} max={2} />
					<button type="button" onClick={() => h.q.watched(t.key)} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20">
						<CheckIcon className="h-4 w-4 text-green-400" />I watched it
					</button>
				</div>
			) : (
				<Triage h={h} t={t} className="mt-3" />
			)}
		</motion.article>
	)
}

function Backdrop({ t, dim }: { t?: WTitle; dim: boolean }) {
	return (
		<>
			<AnimatePresence mode="popLayout" initial={false}>
				{t && <motion.img key={t.key} src={backdropUrl(t, "original")} alt="" initial={{ opacity: 0 }} animate={{ opacity: dim ? 0.3 : 0.55 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: EASE }} className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_20%]" />}
			</AnimatePresence>
			<div className="absolute inset-0 -z-10 bg-gradient-to-b from-gray-900/60 via-gray-900/85 to-gray-900" />
		</>
	)
}
