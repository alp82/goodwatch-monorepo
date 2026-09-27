// PROTOTYPE - throwaway. Taste dials (existing components): "more of this, less of that" controls
// for mood, story, world, humor, and genres, next to a poster grid that re-sorts on every change.
import { AdjustmentsHorizontalIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useState } from "react"
import { label, phrase, reasonText } from "../engine"
import { Moved, PosterCard, ServicesSwitch, layoutSpring } from "../kit"
import { DIAL_GROUPS } from "../model"
import type { Taste } from "../useTaste"

const STEPS = [-2, -1, 0, 1, 2]
const STEP_WORDS: Record<number, string> = { [-2]: "much less", [-1]: "less", 0: "as is", 1: "more", 2: "much more" }

// "More tension, less romance, crime a little more" from the current dials.
function summary(taste: Taste) {
	const parts: string[] = []
	for (const [key, step] of Object.entries(taste.dials)) {
		if (!step) continue
		const p = phrase(key)
		parts.push(step === 2 ? `much more ${p}` : step === 1 ? `a little more ${p}` : step === -1 ? `a little less ${p}` : `much less ${p}`)
	}
	for (const [g, step] of Object.entries(taste.genreDials)) if (step) parts.push(`${step > 0 ? "more" : "less"} ${g}`)
	if (!parts.length) return "Picks follow your ratings as they are. Turn a dial to steer them."
	const text = parts.join(", ")
	return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`
}

export default function Tuner({ taste }: { taste: Taste }) {
	const [open, setOpen] = useState(false)
	const weights = new Map(taste.profile.attrs.map((a) => [a.key, a.weight]))
	const max = Math.max(...taste.profile.attrs.map((a) => Math.abs(a.weight)), 0.01)
	const active = Object.values(taste.dials).some(Boolean) || Object.values(taste.genreDials).some(Boolean)
	const reset = () => {
		for (const [k, v] of Object.entries(taste.dials)) if (v) taste.dial(k, 0)
		for (const [g, v] of Object.entries(taste.genreDials)) if (v) taste.genreDial(g, 0)
	}
	const genres = taste.profile.genres.slice(0, 10)

	const rail = (
		<div className="flex flex-col gap-6">
			{DIAL_GROUPS.map((group) => (
				<section key={group.name}>
					<h3 className="mb-2 text-sm font-bold text-gray-300">{group.name}</h3>
					<ul className="flex flex-col gap-2.5">
						{group.keys.map((key) => {
							const w = weights.get(key) ?? 0
							const step = taste.dials[key] ?? 0
							return (
								<li key={key}>
									<div className="flex items-center justify-between gap-2 text-sm">
										<span className="font-semibold text-white">{label(key)}</span>
										<span className="text-xs text-gray-400">{step ? STEP_WORDS[step] : w > 0.25 ? "you like it" : w < -0.25 ? "you avoid it" : "neutral"}</span>
									</div>
									{/* How present this is in the person's taste now: centered bar, right = likes, left = avoids. */}
									<div className="relative mt-1 h-1 rounded-full bg-gray-800">
										<div className="absolute top-0 h-1 rounded-full bg-amber-500/80" style={w >= 0 ? { left: "50%", width: `${(w / max) * 50}%` } : { right: "50%", width: `${(-w / max) * 50}%` }} />
										<div className="absolute left-1/2 top-[-2px] h-2 w-px bg-gray-500" />
									</div>
									<div className="mt-1.5 grid grid-cols-5 gap-0.5 overflow-hidden rounded-lg border-2 border-gray-800" role="group" aria-label={`${label(key)}: less to more`}>
										{STEPS.map((s) => (
											<button
												key={s}
												type="button"
												aria-pressed={step === s}
												aria-label={`${label(key)} ${STEP_WORDS[s]}`}
												onClick={() => taste.dial(key, s)}
												className={`h-6 text-[11px] font-bold transition ${step === s ? (s < 0 ? "bg-rose-800 text-white" : s > 0 ? "bg-emerald-700 text-white" : "bg-gray-600 text-white") : "bg-gray-900 text-gray-500 hover:bg-gray-800 hover:text-gray-200"}`}
											>
												{s === -2 ? "−−" : s === -1 ? "−" : s === 0 ? "·" : s === 1 ? "+" : "++"}
											</button>
										))}
									</div>
								</li>
							)
						})}
					</ul>
				</section>
			))}
			<section>
				<h3 className="mb-2 text-sm font-bold text-gray-300">Genres you rate</h3>
				<div className="flex flex-wrap gap-1.5">
					{genres.map((g) => {
						const step = taste.genreDials[g.name] ?? 0
						const next = step === 0 ? 1 : step === 1 ? -1 : 0
						return (
							<button
								key={g.name}
								type="button"
								onClick={() => taste.genreDial(g.name, next)}
								title={`Average ${g.avg.toFixed(1)} over ${g.count} ratings. Tap: more, less, as is.`}
								className={`rounded-lg border-2 px-2.5 py-1 text-xs font-semibold transition ${step > 0 ? "border-emerald-500/70 bg-emerald-900/50 text-emerald-100" : step < 0 ? "border-rose-500/60 bg-rose-950/60 text-rose-200 line-through" : "border-white/15 bg-gray-900/80 text-white"}`}
							>
								{step > 0 ? "+ " : step < 0 ? "− " : ""}
								{g.name} <span className="text-gray-400">{g.avg.toFixed(1)}</span>
							</button>
						)
					})}
				</div>
			</section>
		</div>
	)

	return (
		<div className="mx-auto max-w-[1500px] px-4 pb-36 pt-6 md:px-8">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold text-white md:text-5xl">Your taste, your dials</h1>
					<p className="mt-2 max-w-2xl text-gray-400">{taste.engine.profile(taste.signals).sentence.loves} Turn anything up or down and watch the picks move.</p>
				</div>
				<div className="flex items-center gap-3">
					<ServicesSwitch taste={taste} />
					<button type="button" onClick={reset} disabled={!active} className="text-sm font-semibold text-gray-300 underline-offset-4 hover:underline disabled:opacity-30">
						Reset dials
					</button>
				</div>
			</header>

			{/* Mobile: dials fold into a sheet above the grid. */}
			<div className="mt-5 lg:hidden">
				<button
					type="button"
					onClick={() => setOpen((o) => !o)}
					aria-expanded={open}
					className="flex w-full items-center justify-between rounded-xl border-2 border-gray-800 bg-gray-900 px-4 py-3 text-left font-semibold text-white"
				>
					<span className="flex items-center gap-2">
						<AdjustmentsHorizontalIcon className="h-5 w-5 text-amber-400" />
						Adjust your dials
					</span>
					<ChevronDownIcon className={`h-5 w-5 transition ${open ? "rotate-180" : ""}`} />
				</button>
				{open && (
					<div className="mt-2 rounded-xl border-2 border-gray-800 bg-gray-900/70 p-4 pt-0">
						{/* Keep the top picks in view while dialing on a phone. */}
						<div className="sticky top-16 z-10 -mx-4 mb-3 border-b border-gray-800 bg-gray-950/95 px-4 py-2 backdrop-blur">
							<motion.div layout className="grid grid-cols-6 gap-1.5">
								{taste.picks.slice(0, 6).map((p) => (
									<motion.img key={p.item.key} layout transition={layoutSpring} src={p.item.poster} alt={p.item.title} className="aspect-[2/3] w-full rounded object-cover" />
								))}
							</motion.div>
						</div>
						{rail}
					</div>
				)}
			</div>

			<div className="mt-6 flex gap-8">
				<aside className="hidden w-72 shrink-0 lg:block">
					<div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto pr-2">{rail}</div>
				</aside>
				<main className="min-w-0 flex-1">
					<p className="mb-4 rounded-lg border-l-4 border-amber-500 bg-gray-900/70 px-4 py-2.5 text-sm text-gray-200">{summary(taste)}</p>
					<motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 md:grid-cols-4">
						{taste.picks.slice(0, 18).map((p, i) => (
							<motion.div key={p.item.key} layout transition={layoutSpring} className="flex flex-col">
								<PosterCard item={p.item} services={taste.services} match={p.match}>
									<div className="absolute bottom-2 right-2">
										<Moved delta={taste.moved(p.item.key, i)} />
									</div>
								</PosterCard>
								<div className="mt-1.5 px-1">
									<p className="line-clamp-2 text-xs leading-snug text-gray-400">{reasonText(p)}</p>
								</div>
							</motion.div>
						))}
					</motion.div>
				</main>
			</div>
		</div>
	)
}
