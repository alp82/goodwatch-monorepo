// PROTOTYPE (start page lab): recs b · "Tap three": tap three titles you love, picks appear inline right after.
import { useState } from "react"
import { useLab, type LabCard } from "../../lab/types"
import { PicksReveal, SectionHead, Slots, TapPoster, joinNames, usePicks } from "./shared"

const NEED = 3
const PAGE = 12

export function TapThree() {
	const { data } = useLab()
	const pool = data.guest.quizPool
	const [page, setPage] = useState(0)
	const [picked, setPicked] = useState<LabCard[]>([])
	const [done, setDone] = useState<LabCard[] | null>(null)
	const picks = usePicks(done)
	const pages = Math.max(1, Math.ceil(pool.length / PAGE))
	const shown = pool.slice(page * PAGE, page * PAGE + PAGE)

	const tap = (c: LabCard) => {
		if (done) return
		const on = picked.some((p) => p.key === c.key)
		const next = on ? picked.filter((p) => p.key !== c.key) : [...picked, c]
		setPicked(next)
		// A beat to see the third ring land, then the picks.
		if (next.length >= NEED) setTimeout(() => setDone(next), 450)
	}
	const again = () => {
		setDone(null)
		setPicked([])
		setPage((p) => (p + 1) % pages)
	}

	return (
		<section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
			{done ? (
				<>
					<SectionHead kicker="Your picks" title="Picked for you" />
					<PicksReveal because={done} picks={picks} onAgain={again} />
				</>
			) : (
				<>
					<div className="mb-4 flex items-end justify-between gap-4">
						<SectionHead kicker="Try it" title="Tap three you love">
							<p className="mt-1 text-sm text-gray-300" aria-live="polite">
								{picked.length === 0
									? "Picks for your taste, right here."
									: `${joinNames(picked)}${picked.length < NEED ? ` · ${NEED - picked.length} more` : ""}`}
							</p>
						</SectionHead>
						<div className="mb-4 shrink-0">
							<Slots picked={picked} need={NEED} />
						</div>
					</div>
					<ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3 lg:grid-cols-12">
						{shown.map((c) => {
							const n = picked.findIndex((p) => p.key === c.key) + 1
							return (
								<li key={c.key}>
									<TapPoster card={c} n={n} onTap={() => tap(c)} disabled={picked.length >= NEED} />
								</li>
							)
						})}
					</ul>
					{pages > 1 && (
						<button
							type="button"
							onClick={() => setPage((p) => (p + 1) % pages)}
							className="mt-3 text-sm font-semibold text-gray-400 hover:text-white"
						>
							Show other titles
						</button>
					)}
				</>
			)}
		</section>
	)
}
