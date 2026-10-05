// PROTOTYPE - throwaway. Merged Sides variant "In a sentence" (bolder): the sidebar reads as a short portrait,
// one sentence per side, edge, mood and person, in large type; the selected one lights up. The right side
// is cinematic: the title you rated highest there as a full backdrop with its poster and your score, the
// rest of what you loved as a strip, then More of this. Phones: a dropdown at the top.
import { Link } from "@remix-run/react"
import { RatedPoster, YourScore, backdrop, href, poster } from "~/ui/prototype-rec-taste-2/kit"
import { leadOf } from "../entries"
import { EntrySelect, Empty, MoreOfThis, Swap, type VariantProps, useTaste } from "../parts"

export default function Statements({ data }: VariantProps) {
	const { groups, entry, select, services } = useTaste(data)
	if (!entry) return <Empty>Rate a few more titles to see what defines your taste.</Empty>
	const shown = [...groups.sides, ...groups.edges.slice(0, 3), ...groups.moods.slice(0, 1), ...groups.people.slice(0, 1)]
	const lead = leadOf(entry)
	const rest = entry.loved.filter((t) => t.key !== lead?.key).slice(0, 6)

	return (
		<div className="mx-auto max-w-7xl px-4 pb-32 pt-8 text-white md:px-8 md:pt-12">
			<EntrySelect groups={groups} entry={entry} select={select} className="lg:hidden" />
			<div className="mt-6 grid gap-10 lg:mt-0 lg:grid-cols-[360px_1fr] lg:gap-12">
				<aside className="hidden lg:block">
					<ul className="sticky top-6 space-y-1">
						{shown.map((e) => {
							const on = e.id === entry.id
							return (
								<li key={e.id}>
									<button
										type="button"
										onClick={() => select(e.id)}
										aria-pressed={on}
										className={`block w-full border-l-4 py-2 pl-4 text-left text-xl font-bold leading-snug transition ${on ? "border-amber-400 text-white" : "border-transparent text-gray-600 hover:text-gray-300"}`}
									>
										{e.statement}.
									</button>
								</li>
							)
						})}
					</ul>
				</aside>

				<Swap id={entry.id} className="min-w-0">
					<h2 className="mb-4 text-2xl font-bold leading-tight lg:hidden">{entry.statement}.</h2>
					{lead ? (
						<div className="relative isolate overflow-hidden rounded-xl">
							<img src={backdrop(lead)} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
							<div className="absolute inset-0 -z-10 bg-gradient-to-t from-gray-950 via-gray-950/70 to-transparent md:bg-gradient-to-r md:via-gray-950/60" />
							<div className="flex min-h-72 items-end gap-5 p-5 md:min-h-[26rem] md:gap-8 md:p-8">
								<Link to={href(lead)} className="block w-24 shrink-0 overflow-hidden rounded-lg border-4 border-gray-800 shadow-2xl md:w-44">
									<img src={poster(lead, "w342")} alt={`Poster for ${lead.title}`} className="block aspect-[2/3] w-full object-cover" />
								</Link>
								<div className="min-w-0 pb-1">
									<p className="text-sm text-gray-300">{entry.stat}</p>
									<p className="mt-2 text-2xl font-bold leading-tight md:text-4xl">{lead.title}</p>
									{lead.mine != null && (
										<p className="mt-3">
											<YourScore score={lead.mine} label="Your rating" />
										</p>
									)}
								</div>
							</div>
						</div>
					) : (
						<p className="text-2xl font-bold">{entry.statement}</p>
					)}
					{rest.length > 0 && (
						<div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6">
							{rest.map((t) => (
								<RatedPoster key={t.key} t={t} size="w185" />
							))}
						</div>
					)}
					<MoreOfThis data={data} entry={entry} services={services} n={6} cols="grid-cols-3 md:grid-cols-6" className="mt-10" />
				</Swap>
			</div>
		</div>
	)
}
