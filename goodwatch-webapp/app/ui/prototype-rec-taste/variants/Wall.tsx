// PROTOTYPE - throwaway. Triage wall (existing components): your next 24 picks as a poster grid.
// Answer seen / not seen / not interested on the highlighted card with S, N, X, or on any card by hover
// or tap. Seen and not-interested cards leave, new picks slide in; not-seen cards stay as confirmed.
import { CheckIcon, EyeSlashIcon, NoSymbolIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { Kbd, Moved, PosterCard, ServicesSwitch, VibeBar, layoutSpring, useKeys } from "../kit"
import type { Signal } from "../model"
import type { Taste } from "../useTaste"

export default function Wall({ taste }: { taste: Taste }) {
	const wall = taste.picks.slice(0, 24)
	const [lastSeen, setLastSeen] = useState<string | null>(null)
	const answer = (key: string, sig: Signal) => {
		taste.set(key, sig)
		setLastSeen(sig.kind === "seen" ? key : null)
	}
	const first = wall.find((p) => !taste.signals[p.item.key])?.item.key
	useKeys({
		s: () => first && answer(first, { kind: "seen" }),
		n: () => first && answer(first, { kind: "unseen" }),
		x: () => first && answer(first, { kind: "no" }),
		w: () => first && answer(first, { kind: "want" }),
		u: () => taste.undo(),
	})
	const confirmed = wall.filter((p) => taste.signals[p.item.key]?.kind === "unseen").length
	const seenItem = lastSeen ? taste.item(lastSeen) : null

	return (
		<div className="mx-auto max-w-[1500px] px-4 pb-32 pt-6 md:px-8">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold text-white md:text-5xl">Your taste</h1>
					<p className="mt-2 text-gray-400">
						{taste.counts.rated} ratings{taste.counts.session ? `, ${taste.counts.session} answers this visit` : ""}.
					</p>
				</div>
				<div className="flex items-center gap-3">
					<ServicesSwitch taste={taste} />
					<button type="button" onClick={taste.undo} disabled={!taste.history.length} className="text-sm font-semibold text-gray-300 underline-offset-4 hover:underline disabled:opacity-30">
						Undo
					</button>
				</div>
			</header>

			<div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-y border-gray-800 py-3 text-sm text-gray-400">
				<span>
					Your next {wall.length} picks. Tell us which ones you've seen and they make room for new ones.
					{confirmed ? <strong className="ml-1 text-sky-300">{confirmed} confirmed not seen yet.</strong> : null}
				</span>
				<span className="hidden items-center gap-2 md:flex">
					<Kbd>S</Kbd> seen it <Kbd>N</Kbd> not seen <Kbd>X</Kbd> not interested <Kbd>W</Kbd> Want to See <Kbd>U</Kbd> undo
				</span>
			</div>

			<motion.div layout className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
				<AnimatePresence mode="popLayout">
					{wall.map((p, i) => {
						const kept = taste.signals[p.item.key]?.kind === "unseen"
						const isFirst = p.item.key === first
						return (
							<motion.div
								key={p.item.key}
								layout
								initial={{ opacity: 0, scale: 0.9 }}
								animate={{ opacity: 1, scale: 1 }}
								exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.18 } }}
								transition={layoutSpring}
								className={`group/card relative rounded-xl ${isFirst ? "ring-2 ring-amber-500/80 ring-offset-2 ring-offset-gray-950" : ""}`}
							>
								<PosterCard item={p.item} services={taste.services} match={p.match}>
									<div className="absolute bottom-2 right-2">
										<Moved delta={taste.moved(p.item.key, i)} />
									</div>
								</PosterCard>
								{kept ? (
									<div className="mt-2 flex items-center justify-between gap-1 rounded-lg border-2 border-sky-700/60 bg-sky-950/60 px-2 py-1.5 text-xs font-semibold text-sky-200">
										Not seen yet
										<button type="button" className="text-sky-100 underline-offset-2 hover:underline" onClick={() => answer(p.item.key, { kind: "want" })}>
											Want to See
										</button>
									</div>
								) : (
									<div className="mt-2 grid grid-cols-3 gap-1 md:absolute md:inset-x-2 md:bottom-14 md:mt-0 md:opacity-0 md:transition md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100">
										<TriageButton label="Seen it" short="Seen" icon={CheckIcon} tone="emerald" onClick={() => answer(p.item.key, { kind: "seen" })} />
										<TriageButton label="Not seen" short="Unseen" icon={EyeSlashIcon} tone="sky" onClick={() => answer(p.item.key, { kind: "unseen" })} />
										<TriageButton label="Not interested" short="Pass" icon={NoSymbolIcon} tone="stone" onClick={() => answer(p.item.key, { kind: "no" })} />
									</div>
								)}
							</motion.div>
						)
					})}
				</AnimatePresence>
			</motion.div>

			<AnimatePresence>
				{seenItem && (
					<motion.div
						initial={{ y: 40, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 40, opacity: 0 }}
						className="fixed inset-x-4 bottom-16 z-40 mx-auto max-w-lg rounded-xl border-2 border-gray-700 bg-gray-900/95 p-3 shadow-2xl backdrop-blur"
					>
						<div className="mb-2 flex items-center justify-between gap-2 text-sm">
							<span className="text-gray-200">
								Seen <strong className="text-white">{seenItem.title}</strong>. How was it?
							</span>
							<button type="button" className="text-gray-400 hover:text-white" onClick={() => setLastSeen(null)}>
								Later
							</button>
						</div>
						<VibeBar
							compact
							onScore={(s) => {
								taste.set(seenItem.key, { kind: "score", score: s })
								setLastSeen(null)
							}}
						/>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}

function TriageButton({ label, short, icon: Icon, tone, onClick }: { label: string; short: string; icon: typeof CheckIcon; tone: string; onClick: () => void }) {
	const tones: Record<string, string> = {
		emerald: "bg-emerald-800/90 hover:bg-emerald-700 border-emerald-200/20",
		sky: "bg-sky-800/90 hover:bg-sky-700 border-sky-200/20",
		stone: "bg-stone-800/90 hover:bg-stone-700 border-stone-200/20",
	}
	return (
		<button type="button" onClick={onClick} title={label} aria-label={label} className={`flex flex-col items-center gap-0.5 rounded-lg border-2 px-1 py-1.5 text-[11px] font-semibold leading-tight text-white shadow-md ${tones[tone]}`}>
			<Icon className="h-4 w-4" />
			<span className="truncate max-w-full"><span className="md:hidden">{short}</span><span className="hidden md:inline">{label}</span></span>
		</button>
	)
}


