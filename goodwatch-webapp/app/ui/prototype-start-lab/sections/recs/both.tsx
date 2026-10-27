// PROTOTYPE (start page lab): recs c · "Both": a compact score row first, then a one-line tap-three strip under it.
import { useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { useLab, type LabCard } from "../../lab/types"
import { CardRow, PicksReveal, Slots, TapPoster, scoreRanked, usePicks } from "./shared"

const NEED = 3

export function Both() {
	const { data } = useLab()
	const best = scoreRanked(data, 8)
	const pool = data.guest.quizPool
	const [picked, setPicked] = useState<LabCard[]>([])
	const [done, setDone] = useState<LabCard[] | null>(null)
	const picks = usePicks(done, 10)

	const tap = (c: LabCard) => {
		const next = picked.some((p) => p.key === c.key) ? picked.filter((p) => p.key !== c.key) : [...picked, c]
		setPicked(next)
		if (next.length >= NEED) setTimeout(() => setDone(next), 400)
	}

	return (
		<section className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
			<div>
				<div className="mb-3 flex items-center gap-3">
					{best[0] && <ScoreRing media={{ details: best[0] }} size={36} label={false} />}
					<div className="min-w-0">
						<h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Best rated right now</h2>
						<p className="text-xs text-gray-400 sm:text-sm">One score from IMDb, Rotten Tomatoes and Metacritic.</p>
					</div>
				</div>
				<CardRow cards={best} size="sm" />
			</div>

			<div className="rounded-2xl bg-gray-900 p-4 sm:p-5">
				{done ? (
					<PicksReveal
						because={done}
						picks={picks}
						size="sm"
						onAgain={() => {
							setDone(null)
							setPicked([])
						}}
					/>
				) : (
					<>
						<div className="mb-3 flex items-center justify-between gap-3">
							<div className="min-w-0">
								<h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Now for your taste</h2>
								<p className="text-xs text-gray-400 sm:text-sm">Tap three you love.</p>
							</div>
							<Slots picked={picked} need={NEED} />
						</div>
						<ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 pt-1 [scrollbar-width:none] sm:-mx-5 sm:px-5">
							{pool.map((c) => (
								<li key={c.key} className="w-[4.5rem] shrink-0 sm:w-20">
									<TapPoster
										card={c}
										n={picked.findIndex((p) => p.key === c.key) + 1}
										onTap={() => tap(c)}
										disabled={picked.length >= NEED}
									/>
								</li>
							))}
						</ul>
					</>
				)}
			</div>
		</section>
	)
}
