// PROTOTYPE — variant 2, "Consensus strip": a dot plot that puts every outside score on one
// 0 to 100 axis, with the GoodWatch score as the line they gather around. It answers
// "do critics and audiences agree?" at a glance.
import { StarIcon, TableCellsIcon } from "@heroicons/react/20/solid"
import { EpisodesLink, RateTrigger, type VariantProps, agreement, kindLabel, scoreData, vibeVar } from "./shared"
import { scoreLabels } from "~/utils/ratings"

const display = { fontFamily: "'Bricolage Grotesque', Gabarito, sans-serif" }

export default function Variant2Consensus({ media, hasEpisodeGrid }: VariantProps) {
	const { gw, sources } = scoreData(media)
	const agree = agreement(sources)
	const all = [...sources.map((s) => s.pct), ...(gw.score != null ? [gw.score] : [])]
	const lo = all.length ? Math.max(0, Math.min(60, Math.floor((Math.min(...all) - 5) / 10) * 10)) : 0
	const x = (pct: number) => `${((pct - lo) / (100 - lo)) * 100}%`

	return (
		<div className="relative z-30 px-4 pb-2 pt-3 md:m-3 md:rounded-xl md:border md:border-white/10 md:bg-black/65 md:p-5 md:backdrop-blur-md">
			<div className="grid grid-cols-[1fr_auto] items-start gap-x-6 gap-y-4 lg:grid-cols-[13rem_1fr_auto]">
				<div className="flex items-start gap-3">
					<div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-black/40 ring-2" style={{ ["--tw-ring-color" as string]: vibeVar(gw.vibe) }}>
						<span className="text-3xl font-extrabold leading-none tabular-nums text-white" style={display}>
							{gw.score ?? "–"}
						</span>
					</div>
					<div className="min-w-0">
						<div className="text-lg font-bold leading-tight text-white" style={display}>
							{gw.word ?? "Not scored yet"}
						</div>
						<div className="text-xs text-gray-300">GoodWatch score</div>
						<div className="mt-1.5 text-sm font-semibold text-gray-100">{agree.headline}</div>
						{agree.detail && <div className="text-xs leading-snug text-gray-300">{agree.detail}</div>}
					</div>
				</div>

				<div className="flex flex-col items-end gap-2 lg:col-start-3">
					<RateTrigger
						media={media}
						buttonClassName="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-3.5 text-sm font-bold text-black hover:bg-gray-200"
					>
						{({ score }) =>
							score ? (
								<>
									<span className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-white tabular-nums" style={{ background: `var(--color-vibe-${score * 10})` }}>
										{score}
									</span>
									You: {scoreLabels[score]}
								</>
							) : (
								<>
									<StarIcon className="h-4 w-4" aria-hidden="true" />
									Rate this
								</>
							)
						}
					</RateTrigger>
					{hasEpisodeGrid && (
						<EpisodesLink className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1 text-xs font-semibold text-gray-200 underline decoration-white/30 underline-offset-4 hover:text-white">
							<TableCellsIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
							Episode ratings
						</EpisodesLink>
					)}
				</div>

				{/* Dot plot */}
				<figure className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
					{sources.length === 0 ? (
						<p className="text-sm text-gray-400">No critic or audience scores yet.</p>
					) : (
						<>
							{gw.score != null && (
								<div className="grid grid-cols-[8.5rem_1fr_2.75rem] gap-2 text-[11px] sm:grid-cols-[10.5rem_1fr_2.75rem]" aria-hidden="true">
									<span />
									<span className="relative h-4">
										<span className="absolute -translate-x-1/2 whitespace-nowrap font-semibold text-gray-100" style={{ left: x(gw.score) }}>
											GoodWatch {gw.score}
										</span>
									</span>
								</div>
							)}
							<ul className="relative">
								{sources.map((s) => (
									<li key={s.id} className="grid grid-cols-[8.5rem_1fr_2.75rem] items-center gap-2 py-[3px] sm:grid-cols-[10.5rem_1fr_2.75rem]">
										<a
											href={s.url}
											target="_blank"
											rel="noreferrer"
											className="truncate text-xs text-gray-300 hover:text-white hover:underline"
										>
											{s.siteName} <span className="text-gray-400">{kindLabel(s).toLowerCase()}</span>
										</a>
										<div className="relative h-3">
											<div className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
											{gw.score != null && <div className="absolute -top-[3px] -bottom-[3px] w-[2px] -translate-x-1/2 rounded-full" style={{ left: x(gw.score), background: vibeVar(gw.vibe) }} />}
											<span
												title={`${s.siteName} ${kindLabel(s).toLowerCase()}: ${s.value}`}
												className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${s.kind === "critics" ? "bg-white" : "border-2 border-white bg-black"}`}
												style={{ left: x(s.pct) }}
											/>
										</div>
										<span className="text-right text-sm font-semibold tabular-nums text-white">{s.value}</span>
									</li>
								))}
							</ul>
							<figcaption className="mt-1 grid grid-cols-[8.5rem_1fr_2.75rem] gap-2 text-[11px] text-gray-400 sm:grid-cols-[10.5rem_1fr_2.75rem]">
								<span className="flex items-center gap-2">
									<span className="inline-flex items-center gap-1">
										<span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />
										critics
									</span>
									<span className="inline-flex items-center gap-1">
										<span className="h-2 w-2 rounded-full border border-white" aria-hidden="true" />
										audiences
									</span>
								</span>
								<span className="relative tabular-nums">
									<span className="absolute left-0">{lo}</span>
									<span className="absolute right-0">100</span>
								</span>
							</figcaption>
						</>
					)}
				</figure>
			</div>
		</div>
	)
}
