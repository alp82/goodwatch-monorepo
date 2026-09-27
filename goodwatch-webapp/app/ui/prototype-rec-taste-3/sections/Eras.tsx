// PROTOTYPE - throwaway. Eras: one decade at a time. What you loved from it, and what you haven't seen yet.
import { useState } from "react"
import { PHRASES } from "~/ui/prototype-rec-taste/model"
import {
	Frame,
	Head,
	Pick,
	RatedPoster,
	type View3Props,
	YourScore,
	itemsOf,
	mineFirst,
} from "../kit3"
import { bestEra } from "../meta"

export default function Eras({ data }: View3Props) {
	const r = data.report
	const [dec, setDec] = useState(bestEra(data)?.decade ?? r.eras[0]?.decade)
	const era = r.eras.find((e) => e.decade === dec)
	if (!era)
		return (
			<Frame>
				<Head title="Your eras" sub="Rate a few more titles to see your decades." />
			</Frame>
		)
	const picks = mineFirst(data, era.picks).slice(0, 6)
	return (
		<Frame>
			<Head
				title="Your eras"
				sub="How you rate each decade of film and TV."
			/>
			<div className="t3-noscroll -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
				{r.eras.map((e) => {
					const on = e.decade === dec
					return (
						<button
							key={e.decade}
							type="button"
							onClick={() => setDec(e.decade)}
							aria-pressed={on}
							className={`flex shrink-0 items-center gap-2.5 rounded-full border-2 py-1 pl-4 pr-1 font-semibold transition ${on ? "border-amber-500 bg-amber-900/30 text-white" : "border-gray-800 text-gray-300 hover:border-gray-600"}`}
						>
							{e.decade}s
							<YourScore score={Math.round(e.avg)} size="sm" />
						</button>
					)
				})}
			</div>
			<div className="mt-10 grid gap-10 md:grid-cols-[1fr_2fr]">
				<div>
					<p className="text-5xl font-bold md:text-6xl">The {era.decade}s</p>
					<p className="mt-4 max-w-sm text-lg text-gray-300">
						{era.count} titles rated, {era.avg} on average against your usual{" "}
						{r.who.avg}.
						{era.trait && ` What you loved here most: ${PHRASES[era.trait] ?? era.trait}.`}
					</p>
				</div>
				<div className="grid grid-cols-3 gap-3 sm:grid-cols-6 md:grid-cols-3 lg:grid-cols-6">
					{itemsOf(data, era.top.slice(0, 6)).map((t) => (
						<RatedPoster key={t.key} t={t} size="w185" />
					))}
				</div>
			</div>
			{picks.length > 0 && (
				<>
					<h3 className="mb-4 mt-14 text-xl font-bold">
						Still to see from the {era.decade}s
					</h3>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
						{picks.map((p) => {
							const t = data.items[p.key]
							return t ? (
								<Pick key={p.key} data={data} t={t} match={p.match} />
							) : null
						})}
					</div>
				</>
			)}
		</Frame>
	)
}
