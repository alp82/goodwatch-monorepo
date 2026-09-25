// PROTOTYPE — variant 5, "Glass card": the scores leave the toolbar and become a frosted card
// that floats on the backdrop, lit from behind by the vibe color. The picture stays visible
// beside it on desktop; on phones the card rides up over the bottom of the banner.
import { NewspaperIcon, StarIcon, TableCellsIcon, UserGroupIcon } from "@heroicons/react/20/solid"
import { EpisodesLink, RateTrigger, SiteMark, type SourceScore, type VariantProps, kindLabel, onVibe, scoreData, vibeVar } from "./shared"
import { scoreLabels } from "~/utils/ratings"

const display = { fontFamily: "'Bricolage Grotesque', Gabarito, sans-serif" }

function Value({ s, kind, big }: { s: SourceScore | null; kind: "critics" | "audience"; big?: boolean }) {
	const Icon = kind === "critics" ? NewspaperIcon : UserGroupIcon
	return (
		<span className={`flex items-center gap-1 tabular-nums ${s ? "text-white" : "text-gray-500"}`} title={s ? `${s.siteName} ${kindLabel(s).toLowerCase()}: ${s.value}` : `No ${kind} score`}>
			<Icon className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
			<span className="sr-only">{kind === "critics" ? "Critics" : "Audience"}</span>
			<span className={big ? "text-base font-bold" : "text-sm font-semibold"}>{s?.value ?? "–"}</span>
		</span>
	)
}

export default function Variant5Glass({ media, hasEpisodeGrid }: VariantProps) {
	const { gw, sites } = scoreData(media)
	return (
		<div className="relative z-30 -mt-14 px-3 md:m-4 md:mt-4 md:w-[21rem] md:self-start md:px-0">
			<div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/[.07] p-5 shadow-2xl shadow-black/50 backdrop-blur-2xl backdrop-saturate-150">
				{/* the vibe glow */}
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full opacity-55 blur-3xl"
					style={{ background: vibeVar(gw.vibe) }}
				/>
				<div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

				<div className="relative flex items-end gap-3">
					<span className="text-[4rem] font-extrabold leading-[0.85] tracking-tight tabular-nums text-white [text-shadow:0_2px_20px_rgba(0,0,0,.35)]" style={display}>
						{gw.score ?? "–"}
					</span>
					<div className="pb-1 leading-tight">
						<div className="text-xl font-bold text-white" style={display}>
							{gw.word ?? "Not scored yet"}
						</div>
						<div className="text-xs text-gray-200">GoodWatch score of 100</div>
					</div>
				</div>

				<ul className="relative mt-4 grid grid-cols-3 gap-1.5">
					{sites.length === 0 && <li className="col-span-3 text-sm text-gray-300">No critic or audience scores yet.</li>}
					{sites.map((site) => (
						<li key={site.key}>
							<a
								href={site.url}
								target="_blank"
								rel="noreferrer"
								className="flex h-full flex-col gap-1.5 rounded-xl bg-black/35 px-2.5 py-2 ring-1 ring-white/10 hover:bg-black/50 focus-visible:outline-2 focus-visible:outline-white"
							>
								<SiteMark site={site} className={site.key === "imdb" ? "h-4 self-start" : "h-4 w-4"} />
								{site.key === "imdb" ? <Value s={site.audience} kind="audience" big /> : (
									<>
										<Value s={site.critics} kind="critics" big />
										<Value s={site.audience} kind="audience" />
									</>
								)}
								<span className="mt-auto text-[11px] leading-tight text-gray-300">{site.name}</span>
							</a>
						</li>
					))}
				</ul>
				{sites.some((s) => s.critics) && (
					<p className="relative mt-2 flex items-center gap-3 text-[11px] text-gray-300">
						<span className="inline-flex items-center gap-1"><NewspaperIcon className="h-3 w-3" aria-hidden="true" />critics</span>
						<span className="inline-flex items-center gap-1"><UserGroupIcon className="h-3 w-3" aria-hidden="true" />audiences</span>
					</p>
				)}

				<div className="relative mt-4 flex items-center gap-2">
					<RateTrigger
						media={media}
						align="left"
						className="flex-1"
						buttonClassName="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-black hover:bg-gray-100"
					>
						{({ score }) =>
							score ? (
								<>
									<span className="flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums" style={{ background: `var(--color-vibe-${score * 10})`, color: onVibe(score * 10) }}>
										{score}
									</span>
									You said {scoreLabels[score].toLowerCase()}
								</>
							) : (
								<>
									<StarIcon className="h-4 w-4 text-yellow-500" aria-hidden="true" />
									Rate this
								</>
							)
						}
					</RateTrigger>
					{hasEpisodeGrid && (
						<EpisodesLink className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl bg-black/30 px-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-black/45">
							<TableCellsIcon className="h-4 w-4 text-gray-300" aria-hidden="true" />
							Episode ratings
						</EpisodesLink>
					)}
				</div>
			</div>
		</div>
	)
}
