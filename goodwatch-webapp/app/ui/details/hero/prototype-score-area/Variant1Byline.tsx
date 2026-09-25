// PROTOTYPE — variant 1, "Byline": an editorial hero number with the outside scores set as a
// quiet critics-versus-audiences table, like the credits under a review.
import { StarIcon as StarOutline } from "@heroicons/react/24/outline"
import { TableCellsIcon } from "@heroicons/react/20/solid"
import { EpisodesLink, RateTrigger, type VariantProps, kindLabel, scoreData, vibeVar } from "./shared"
import { scoreLabels } from "~/utils/ratings"

const serif = { fontFamily: "'Instrument Serif', Georgia, serif" }

export default function Variant1Byline({ media, hasEpisodeGrid }: VariantProps) {
	const { gw, sites, sources } = scoreData(media)
	return (
		<div className="relative z-30 px-4 pb-2 pt-3 md:m-3 md:rounded-xl md:border md:border-white/10 md:bg-black/60 md:px-6 md:py-5 md:backdrop-blur-md">
			<div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
				{/* Hero number */}
				<div className="flex items-end gap-4">
					<div className="shrink-0">
						<div className="text-[4.5rem] leading-[0.8] tabular-nums text-white md:text-[5.5rem]" style={serif}>
							{gw.score ?? "–"}
						</div>
						<div className="mt-2 h-[3px] w-full rounded-full bg-white/15" aria-hidden="true">
							{gw.score != null && <div className="h-full rounded-full" style={{ width: `${gw.score}%`, background: vibeVar(gw.vibe) }} />}
						</div>
					</div>
					<div className="pb-0.5">
						<div className="text-3xl italic leading-none text-white md:text-4xl" style={serif}>
							{gw.word ?? "Not scored yet"}
						</div>
						<p className="mt-1.5 max-w-[15rem] text-xs leading-snug text-gray-300">
							{gw.score == null
								? "We need a few more critic and audience scores."
								: `GoodWatch score out of 100, blended from ${sources.length === 1 ? "one outside score" : `${sources.length} critic and audience scores`}`}
						</p>
					</div>
				</div>

				{/* Rate */}
				<div className="flex flex-col items-end justify-center gap-2 lg:col-start-3 lg:row-start-1">
					<RateTrigger
						media={media}
						buttonClassName="group inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full border border-white/35 px-4 text-white hover:border-white hover:bg-white/5"
					>
						{({ score }) =>
							score ? (
								<>
									<span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(--color-vibe-${score * 10})` }} aria-hidden="true" />
									<span className="text-xl italic" style={serif}>
										You: {score}, {scoreLabels[score]}
									</span>
								</>
							) : (
								<>
									<StarOutline className="h-5 w-5" aria-hidden="true" />
									<span className="text-xl italic" style={serif}>
										Rate it
									</span>
								</>
							)
						}
					</RateTrigger>
					{hasEpisodeGrid && (
						<EpisodesLink className="hidden items-center gap-1.5 text-sm text-gray-200 underline decoration-white/30 underline-offset-4 hover:decoration-white lg:inline-flex">
							<TableCellsIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
							Episode ratings
						</EpisodesLink>
					)}
				</div>

				{/* Sources as a small table */}
				<div className="col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:border-l lg:border-white/15 lg:pl-6">
					{sites.length === 0 ? (
						<p className="text-sm text-gray-400">No critic or audience scores yet.</p>
					) : (
						<table className="w-full max-w-md text-sm tabular-nums">
							<caption className="sr-only">Scores on other sites</caption>
							<thead>
								<tr className="text-xs text-gray-400">
									<th className="pb-1 text-left font-normal">
										<span className="sr-only">Site</span>
									</th>
									<th className="pb-1 text-right font-normal">Critics</th>
									<th className="pb-1 pl-4 text-right font-normal">Audiences</th>
								</tr>
							</thead>
							<tbody>
								{sites.map((site) => (
									<tr key={site.key} className="border-t border-white/10">
										<th scope="row" className="py-1 text-left font-normal">
											{site.url ? (
												<a href={site.url} target="_blank" rel="noreferrer" className="text-gray-200 underline decoration-white/20 underline-offset-4 hover:text-white hover:decoration-white">
													{site.name}
												</a>
											) : (
												<span className="text-gray-200">{site.name}</span>
											)}
										</th>
										{[site.critics, site.audience].map((s, i) => (
											<td key={i} className={`py-1 text-right text-base ${i ? "pl-4" : ""} ${s ? "text-white" : "text-gray-500"}`} style={serif}>
												{s ? <span title={`${site.name} ${kindLabel(s).toLowerCase()}`}>{s.value}</span> : <span aria-label="no score">–</span>}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					)}
					{hasEpisodeGrid && (
						<EpisodesLink className="mt-3 inline-flex items-center gap-1.5 text-sm text-gray-200 underline decoration-white/30 underline-offset-4 hover:decoration-white lg:hidden">
							<TableCellsIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
							Episode ratings
						</EpisodesLink>
					)}
				</div>
			</div>
		</div>
	)
}
