// PROTOTYPE (start page lab): recs d · "Bolder: this or that": four quick pairs ("which one tonight?"), one tap each, then picks.
import { AnimatePresence, motion } from "framer-motion"
import { Fragment, useState } from "react"
import { tmdbImage } from "../../lab/kit"
import { useLab, type LabCard } from "../../lab/types"
import { PicksReveal, SectionHead, usePicks } from "./shared"

const ROUNDS = 4

/** Pairs that pull apart: a title from the pool's first half against one from its second. */
function pairsFrom(pool: LabCard[], round: number): [LabCard, LabCard][] {
	const half = Math.floor(pool.length / 2)
	const out: [LabCard, LabCard][] = []
	for (let i = 0; i < ROUNDS; i++) {
		const a = pool[(round * ROUNDS + i) % Math.max(1, half)]
		const b = pool[half + ((round * ROUNDS + i * 3) % Math.max(1, pool.length - half))]
		if (a && b && a.key !== b.key) out.push([a, b])
	}
	return out
}

export function ThisOrThat() {
	const { data } = useLab()
	const [round, setRound] = useState(0)
	const pairs = pairsFrom(data.guest.quizPool, round)
	const [chosen, setChosen] = useState<LabCard[]>([])
	const [skipped, setSkipped] = useState(0)
	const step = chosen.length + skipped
	const finished = pairs.length > 0 && step >= pairs.length
	const picks = usePicks(finished && chosen.length ? chosen : null)
	const pair = pairs[step]

	const again = () => {
		setChosen([])
		setSkipped(0)
		setRound((r) => r + 1)
	}

	if (finished && chosen.length) {
		return (
			<section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
				<SectionHead kicker="Your picks" title="Then you'll like these" />
				<PicksReveal because={chosen} picks={picks} onAgain={again} againLabel="Play again" />
			</section>
		)
	}

	return (
		<section className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6">
			<div className="text-xs font-extrabold uppercase tracking-[0.18em] text-amber-400">
				{finished ? "No picks yet" : `${Math.min(step + 1, ROUNDS)} of ${pairs.length || ROUNDS}`}
			</div>
			<h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-4xl">Which one tonight?</h2>
			<div className="mx-auto mt-3 flex w-24 gap-1.5" aria-hidden>
				{Array.from({ length: pairs.length || ROUNDS }, (_, i) => (
					<span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < step ? "bg-amber-400" : "bg-white/15"}`} />
				))}
			</div>
			{finished ? (
				<button type="button" onClick={again} className="mt-6 rounded-full bg-amber-400 px-5 py-2 font-bold text-gray-950">
					Try other pairs
				</button>
			) : (
				pair && (
					<div className="relative mt-6">
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.div
								key={`${round}-${step}`}
								initial={{ opacity: 0, x: 40 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -40 }}
								transition={{ duration: 0.22, ease: "easeOut" }}
								className="flex items-center justify-center gap-3 sm:gap-6"
							>
								{pair.map((c, i) => (
									<Fragment key={c.key}>
										{i === 1 && (
											<span className="shrink-0 text-sm font-extrabold uppercase text-gray-500">
												or
											</span>
										)}
										<button
											type="button"
											onClick={() => setChosen((x) => [...x, c])}
											className="group w-[42%] max-w-[15rem] text-left transition-transform duration-150 active:scale-95"
										>
											<span className="block aspect-[2/3] overflow-hidden rounded-xl bg-gray-800 ring-amber-400 transition group-hover:ring-4">
												<img src={tmdbImage(c.poster_path, "w342")} alt="" className="h-full w-full object-cover" />
											</span>
											<span className="mt-2 block truncate text-sm font-semibold">{c.title}</span>
											<span className="block text-xs text-gray-400">{c.release_year}</span>
										</button>
									</Fragment>
								))}
							</motion.div>
						</AnimatePresence>
						<button
							type="button"
							onClick={() => setSkipped((s) => s + 1)}
							className="mt-4 text-sm font-semibold text-gray-400 hover:text-white"
						>
							Seen neither
						</button>
					</div>
				)
			)}
		</section>
	)
}
