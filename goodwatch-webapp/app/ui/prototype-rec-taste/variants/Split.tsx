// PROTOTYPE - throwaway. Live preview (existing components): the ClickScorer layout on the left, your
// ranked picks on the right. Every score or triage answer re-ranks the list in place, with arrows for
// what moved and a line saying what your last answer did.
import { BookmarkIcon, CheckIcon, EyeSlashIcon, NoSymbolIcon } from "@heroicons/react/24/outline"
import { AnimatePresence, motion } from "framer-motion"
import { useMemo, useState } from "react"
import GenreBadge from "~/ui/badge/GenreBadge"
import Button from "~/ui/button/Button"
import { reasonText } from "../engine"
import { Kbd, MatchText, Moved, ServicesSwitch, VibeBar, href, layoutSpring, useKeys } from "../kit"
import { type PoolItem, type Signal, backdropUrl, posterUrl } from "../model"
import type { Taste } from "../useTaste"
import { scoreLabels } from "~/utils/ratings"

const verb = (s: Signal) =>
	s.kind === "score" ? `rated it ${s.score}, ${scoreLabels[s.score].toLowerCase()}` : s.kind === "seen" ? "have seen it" : s.kind === "unseen" ? "haven't seen it" : s.kind === "no" ? "aren't interested" : "want to see it"

export default function Split({ taste }: { taste: Taste }) {
	const current = taste.triage[0]?.item
	const next = taste.triage[1]?.item
	const [last, setLast] = useState<{ item: PoolItem; sig: Signal } | null>(null)
	const answer = (sig: Signal) => {
		if (!current) return
		taste.set(current.key, sig)
		setLast({ item: current, sig })
	}
	useKeys({
		...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String((i + 1) % 10), () => answer({ kind: "score", score: i + 1 })])),
		s: () => answer({ kind: "seen" }),
		n: () => answer({ kind: "unseen" }),
		x: () => answer({ kind: "no" }),
		w: () => answer({ kind: "want" }),
		u: () => {
			taste.undo()
			setLast(null)
		},
	})
	const picks = taste.picks.slice(0, 10)
	const fresh = useMemo(() => picks.filter((p, i) => taste.moved(p.item.key, i) == null).length, [taste.changeId])

	return (
		<div className="mx-auto max-w-[1500px] px-4 pb-32 pt-6 md:px-8">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-3xl font-bold text-white md:text-4xl">Your taste</h1>
					<p className="mt-1 text-gray-400">Score what you've seen. Your picks re-rank as you go.</p>
				</div>
				<p className="hidden items-center gap-2 text-sm text-gray-400 lg:flex">
					<Kbd>1</Kbd>–<Kbd>0</Kbd> score <Kbd>S</Kbd> seen <Kbd>N</Kbd> not seen <Kbd>X</Kbd> not interested <Kbd>U</Kbd> undo
				</p>
			</header>

			<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
				<section className="min-w-0">
					<AnimatePresence mode="wait">
						{current && (
							<motion.div key={current.key} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.18 }}>
								<Rater item={current} taste={taste} onAnswer={answer} />
							</motion.div>
						)}
					</AnimatePresence>
					{next && (
						<p className="mt-3 text-sm text-gray-500">
							Up next: <span className="text-gray-300">{next.title}</span>
						</p>
					)}
				</section>

				<aside className="order-first min-w-0 lg:order-none lg:sticky lg:top-20 lg:self-start">
					<div className="rounded-xl border-4 border-gray-800 bg-gray-900 p-3 lg:p-4">
						<div className="flex items-center justify-between gap-2">
							<h2 className="text-lg font-bold text-white">Your picks</h2>
							<ServicesSwitch taste={taste} />
						</div>
						<div className="mt-2 min-h-10 text-sm text-gray-400">
							<AnimatePresence mode="wait">
								<motion.p key={taste.changeId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
									{last ? (
										<>
											You {verb(last.sig)}: <span className="text-white">{last.item.title}</span>.{" "}
											{fresh ? `${fresh} new ${fresh === 1 ? "pick" : "picks"} in your top 10.` : "Your top 10 re-sorted."}
										</>
									) : (
										"Ranked by how close each title sits to your taste."
									)}
								</motion.p>
							</AnimatePresence>
						</div>
						<ol className="mt-3 flex gap-3 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
							{picks.map((p, i) => (
								<motion.li key={p.item.key} layout transition={layoutSpring} className="w-20 shrink-0 lg:w-auto">
									<a href={href(p.item)} className="flex flex-col gap-2 rounded-lg p-1 hover:bg-gray-800 lg:flex-row lg:items-center lg:gap-3">
										<span className="hidden w-5 text-right text-sm font-bold tabular-nums text-gray-500 lg:block">{i + 1}</span>
										<img src={posterUrl(p.item, "w185")} alt="" className="w-full rounded-md border-2 border-gray-800 lg:w-12" />
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-bold text-white">{p.item.title}</span>
											<MatchText match={p.match} className="lg:hidden" short />
											<MatchText match={p.match} className="hidden lg:inline" />
											<span className="hidden truncate text-xs text-gray-400 lg:block">{reasonText(p)}</span>
										</span>
										<span className="hidden lg:block">
											<Moved delta={taste.moved(p.item.key, i)} />
										</span>
									</a>
								</motion.li>
							))}
						</ol>
					</div>
				</aside>
			</div>
		</div>
	)
}

function Rater({ item, taste, onAnswer }: { item: PoolItem; taste: Taste; onAnswer: (s: Signal) => void }) {
	return (
		<div className="overflow-hidden rounded-xl border-4 border-gray-800 bg-gray-900">
			<div className="p-3 pb-0">
				<VibeBar onScore={(s) => onAnswer({ kind: "score", score: s })} />
			</div>
			<div className="relative flex">
				<img src={posterUrl(item, "w500")} alt={`Poster for ${item.title}`} className="relative z-10 h-48 sm:h-64 shrink-0 aspect-[2/3] object-cover md:h-80 lg:h-96" />
				<div className="relative min-w-0 flex-1">
					<img src={backdropUrl(item)} alt="" className="h-48 sm:h-64 w-full object-cover md:h-80 lg:h-96" />
					<div className="absolute inset-x-0 top-0 bg-linear-to-b from-black/90 via-black/60 to-transparent p-4 pb-10">
						<h2 className="text-xl font-bold text-white drop-shadow-lg md:text-3xl">
							{item.title} <span className="font-normal text-gray-300">({item.year})</span>
						</h2>
						<div className="mt-3 hidden flex-wrap gap-2 sm:flex">
							{item.genres.slice(0, 3).map((g) => (
								<GenreBadge key={g} genre={g} />
							))}
						</div>
					</div>
					<div className="absolute inset-x-0 bottom-0 hidden bg-linear-to-t from-black/90 via-black/60 to-transparent p-4 pt-12 md:block">
						<p className="text-sm text-gray-200">{item.synopsis.length > 200 ? `${item.synopsis.slice(0, 200)}…` : item.synopsis}</p>
					</div>
				</div>
			</div>
			<div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 [&>*]:min-w-0">
				<Button icon={CheckIcon} highlight="emerald" mode="dark" size="xs" onClick={() => onAnswer({ kind: "seen" })}>
					Seen, no score
				</Button>
				<Button icon={EyeSlashIcon} highlight="sky" mode="dark" size="xs" onClick={() => onAnswer({ kind: "unseen" })}>
					Not seen
				</Button>
				<Button icon={BookmarkIcon} highlight="amber" mode="dark" size="xs" onClick={() => onAnswer({ kind: "want" })}>
					Want to See
				</Button>
				<Button icon={NoSymbolIcon} highlight="stone" mode="dark" size="xs" onClick={() => onAnswer({ kind: "no" })}>
					Not interested
				</Button>
			</div>
		</div>
	)
}
