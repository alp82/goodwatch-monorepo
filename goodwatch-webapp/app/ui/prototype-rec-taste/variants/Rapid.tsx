// PROTOTYPE - throwaway. Rapid fire (bolder): one title at a time, full-bleed backdrop, huge type,
// three keys (S / N / X). A slate keeps count and pace; the picks strip along the bottom re-sorts live.
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { reasonText } from "../engine"
import { MatchText, Moved, ServicesSwitch, href, layoutSpring, useKeys } from "../kit"
import { type Signal, backdropUrl, posterUrl } from "../model"
import type { Taste } from "../useTaste"

const FONT = "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&display=swap"
const display = { fontFamily: "'Big Shoulders Display', 'Gabarito', sans-serif" }

const ACTIONS: { k: string; label: string; signal: Signal; tone: string }[] = [
	{ k: "S", label: "Seen it", signal: { kind: "seen" }, tone: "hover:border-emerald-400 hover:text-emerald-200" },
	{ k: "N", label: "Not seen", signal: { kind: "unseen" }, tone: "hover:border-sky-400 hover:text-sky-200" },
	{ k: "X", label: "Not interested", signal: { kind: "no" }, tone: "hover:border-stone-300 hover:text-stone-200" },
]

export default function Rapid({ taste }: { taste: Taste }) {
	const current = taste.triage[0]
	const next = taste.triage[1]
	const [flash, setFlash] = useState<string | null>(null)
	const started = useRef<number | null>(null)
	const [now, setNow] = useState(0)
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000)
		return () => clearInterval(id)
	}, [])

	const answer = (a: (typeof ACTIONS)[number]) => {
		if (!current) return
		started.current ??= Date.now()
		taste.set(current.item.key, a.signal)
		setFlash(a.k)
		setTimeout(() => setFlash(null), 220)
	}
	useKeys({
		s: () => answer(ACTIONS[0]),
		n: () => answer(ACTIONS[1]),
		x: () => answer(ACTIONS[2]),
		u: () => taste.undo(),
	})

	const answers = taste.counts.session
	const minutes = started.current && now ? Math.max((now - started.current) / 60000, 0.25) : 0
	const pace = minutes ? Math.round(answers / minutes) : 0

	return (
		<div className="relative -mt-px overflow-hidden bg-black pb-44 lg:pb-0">
			<link rel="stylesheet" href={FONT} />
			{next && <link rel="preload" as="image" href={backdropUrl(next.item)} />}

			{/* Backdrop: full-bleed on desktop, top half on mobile. */}
			<div className="absolute inset-x-0 top-0 h-[46vh] lg:h-full">
				<AnimatePresence initial={false}>
					{current && (
						<motion.img
							key={current.item.key}
							src={backdropUrl(current.item)}
							alt=""
							className="absolute inset-0 h-full w-full object-cover"
							initial={{ opacity: 0, scale: 1.04 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.45, ease: "easeOut" }}
						/>
					)}
				</AnimatePresence>
				<div className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-black/10 lg:bg-linear-to-r lg:from-black lg:via-black/70 lg:to-black/5" />
				<div className="absolute inset-x-0 bottom-0 hidden h-72 bg-linear-to-t from-black to-transparent lg:block" />
			</div>

			<div className="relative mx-auto flex min-h-[calc(100vh-64px)] max-w-[1500px] flex-col px-4 pt-[30vh] lg:px-10 lg:pt-10">
				<div className="flex items-start justify-between gap-4">
					<Slate answers={answers} pace={pace} rated={taste.counts.rated} />
					<div className="hidden lg:block">
						<ServicesSwitch taste={taste} />
					</div>
				</div>

				<div className="mt-4 flex-1 lg:mt-16">
					<AnimatePresence mode="wait" initial={false}>
						{current ? (
							<motion.div
								key={current.item.key}
								initial={{ opacity: 0, y: 14 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -10, transition: { duration: 0.12 } }}
								transition={{ duration: 0.25 }}
								className="flex items-end gap-6"
							>
								<img src={posterUrl(current.item)} alt="" className="hidden w-40 shrink-0 rounded-md border-4 border-gray-800 shadow-2xl shadow-black lg:block xl:w-48" />
								<div className="min-w-0 max-w-4xl">
									<h1 className="text-[15vw] font-black uppercase leading-[0.85] tracking-tight text-white drop-shadow-2xl lg:text-[7.5rem]" style={display}>
										{current.item.title}
									</h1>
									<p className="mt-3 text-base text-gray-300 lg:text-lg">
										{current.item.year}, {current.item.genres.slice(0, 3).join(", ").toLowerCase()}
										{current.item.type === "show" ? ", series" : ""}
									</p>
									<p className="mt-1 max-w-xl text-base text-white/90 lg:text-lg">
										<MatchText match={current.match} className="mr-2 text-base" />
										{reasonText(current)}
									</p>
								</div>
							</motion.div>
						) : (
							<p className="text-2xl text-gray-300">That's the whole reel. Your picks are clean.</p>
						)}
					</AnimatePresence>

					{/* Actions: in the page on desktop, a sticky bar above the site nav on mobile. */}
					<div className="fixed inset-x-0 bottom-[72px] z-30 border-t border-white/10 bg-black/85 px-3 py-2 backdrop-blur lg:static lg:mt-10 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
						<div className="mx-auto grid max-w-md grid-cols-3 gap-2 lg:mx-0 lg:max-w-3xl lg:gap-3">
							{ACTIONS.map((a) => (
								<button
									key={a.k}
									type="button"
									onClick={() => answer(a)}
									className={`flex min-h-12 items-center justify-center gap-3 rounded-lg border-2 px-2 text-sm font-semibold text-white transition leading-tight lg:min-h-16 lg:justify-start lg:whitespace-nowrap lg:px-5 lg:text-lg ${
										flash === a.k ? "border-white bg-white/20" : "border-white/25 bg-black/40"
									} ${a.tone}`}
								>
									<span className="hidden h-8 w-8 items-center justify-center rounded border border-white/40 text-base font-bold lg:flex" style={display}>
										{a.k}
									</span>
									{a.label}
								</button>
							))}
						</div>
					</div>
				</div>

				<PicksReel taste={taste} />
			</div>
		</div>
	)
}

/** A film slate: scene and take numbers stand in for answers and ratings, pace is the timecode. */
function Slate({ answers, pace, rated }: { answers: number; pace: number; rated: number }) {
	const cells = [
		{ label: "Answers", value: String(answers).padStart(2, "0") },
		{ label: "Per min", value: pace ? String(pace) : "--" },
		{ label: "Rated", value: String(rated) },
	]
	return (
		<div className="flex overflow-hidden rounded-md border-2 border-white/30 bg-black/60 backdrop-blur">
			{cells.map((c, i) => (
				<div key={c.label} className={`px-3 py-1.5 lg:px-4 lg:py-2 ${i ? "border-l-2 border-white/30" : ""}`}>
					<div className="text-[10px] text-gray-400 lg:text-xs">{c.label}</div>
					<div className="text-2xl font-black tabular-nums leading-none text-white lg:text-3xl" style={display}>
						{c.value}
					</div>
				</div>
			))}
		</div>
	)
}

function PicksReel({ taste }: { taste: Taste }) {
	return (
		<section className="mt-8 pb-6 lg:mt-10 lg:pb-20">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-xl font-bold uppercase tracking-wide text-white" style={display}>
					Your picks, re-cut after every answer
				</h2>
				<div className="shrink-0 lg:hidden">
					<ServicesSwitch taste={taste} />
				</div>
			</div>
			<div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
				{taste.picks.slice(0, 12).map((p, i) => (
					<motion.a key={p.item.key} layout transition={layoutSpring} href={href(p.item)} className="group w-24 shrink-0 lg:w-28">
						<div className="relative">
							<img src={posterUrl(p.item, "w185")} alt={p.item.title} className="aspect-[2/3] w-full rounded border-2 border-white/10 object-cover group-hover:border-white/40" />
							<span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-xs font-bold text-white" style={display}>
								{i + 1}
							</span>
							<span className="absolute bottom-1 right-1">
								<Moved delta={taste.moved(p.item.key, i)} />
							</span>
						</div>
						<div className="mt-1 truncate text-xs font-semibold text-gray-300">{p.item.title}</div>
					</motion.a>
				))}
			</div>
		</section>
	)
}
