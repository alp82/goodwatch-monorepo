// PROTOTYPE (start page lab): recs a · "Score first": the best rated popular titles, ranked by the GoodWatch score.
import { Link } from "@remix-run/react"
import { useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { useLab } from "../../lab/types"
import { CardRow, score, scoreRanked } from "./shared"

export function ScoreFirst() {
	const { data } = useLab()
	const [tab, setTab] = useState<"popular" | "all">("popular")
	const cards =
		tab === "popular"
			? scoreRanked(data, 10)
			: [...data.guest.topRated].sort((a, b) => score(b) - score(a)).slice(0, 10)
	const top = cards[0]
	return (
		<section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
			<div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="min-w-0">
					<h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">The best rated right now</h2>
					<div className="mt-3 flex items-center gap-3">
						{top && <ScoreRing media={{ details: top }} size={44} label={false} />}
						<p className="max-w-md text-sm text-gray-300">
							The GoodWatch score is one number from IMDb, Rotten Tomatoes and Metacritic.
						</p>
					</div>
				</div>
				<div className="flex shrink-0 rounded-full bg-gray-800 p-1 text-sm font-semibold" role="tablist">
					{(
						[
							["popular", "Popular now"],
							["all", "All time"],
						] as const
					).map(([k, label]) => (
						<button
							key={k}
							type="button"
							role="tab"
							aria-selected={tab === k}
							onClick={() => setTab(k)}
							className={`rounded-full px-4 py-1.5 transition-colors ${tab === k ? "bg-amber-400 text-gray-950" : "text-gray-300 hover:text-white"}`}
						>
							{label}
						</button>
					))}
				</div>
			</div>
			<CardRow cards={cards} ranked />
			<p className="mt-4 text-sm text-gray-400">
				Picks for your own taste come after a few ratings.{" "}
				<Link to="/sign-up" className="font-semibold text-amber-400 underline-offset-4 hover:underline">
					Sign up free
				</Link>
			</p>
		</section>
	)
}
