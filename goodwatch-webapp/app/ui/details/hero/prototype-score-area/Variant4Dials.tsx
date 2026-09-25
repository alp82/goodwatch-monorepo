// PROTOTYPE — variant 4, "Dials": one gauge per score on the same 0 to 100 scale, each arc in
// the vibe color for its value, so a row of green arcs says "everyone likes it" before reading.
// The raw site value sits inside each dial, so color never carries the meaning alone.
import { StarIcon, TableCellsIcon } from "@heroicons/react/20/solid"
import { EpisodesLink, RateTrigger, type SourceScore, type VariantProps, kindLabel, onVibe, pctVibe, scoreData, vibeVar } from "./shared"
import { scoreLabels } from "~/utils/ratings"

const display = { fontFamily: "'Bricolage Grotesque', Gabarito, sans-serif" }
const SWEEP = 270

function Dial({ pct, size, stroke, color, children, label }: { pct: number | null; size: number; stroke: number; color: string; children: React.ReactNode; label: string }) {
	const r = (size - stroke) / 2
	const c = 2 * Math.PI * r
	const arc = (SWEEP / 360) * c
	return (
		<div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
			<svg width={size} height={size} style={{ transform: `rotate(${90 + (360 - SWEEP) / 2}deg)` }} aria-hidden="true">
				<circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${arc} ${c}`} />
				{pct != null && (
					<circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(pct / 100) * arc} ${c}`} />
				)}
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
				{children}
			</div>
		</div>
	)
}

function SourceDial({ s, fallbackLabel }: { s: SourceScore | null; fallbackLabel: string }) {
	return (
		<div className="flex flex-col items-center gap-0.5">
			<Dial
				pct={s?.pct ?? null}
				size={52}
				stroke={4}
				color={s ? vibeVar(pctVibe(s.pct)) : ""}
				label={s ? `${s.siteName} ${kindLabel(s).toLowerCase()}: ${s.value}` : `${fallbackLabel}: no score`}
			>
				<span className={`text-sm font-bold tabular-nums ${s ? "text-white" : "text-gray-500"}`}>{s?.value ?? "–"}</span>
			</Dial>
			<span className="-mt-2 text-[11px] text-gray-300">{s ? kindLabel(s).toLowerCase() : fallbackLabel.split(" ").pop()}</span>
		</div>
	)
}

export default function Variant4Dials({ media, hasEpisodeGrid }: VariantProps) {
	const { gw, sites } = scoreData(media)
	return (
		<div className="relative z-30 px-4 pb-2 pt-3 md:m-3 md:rounded-xl md:border md:border-white/10 md:bg-black/60 md:px-5 md:py-4 md:backdrop-blur-md">
			<div className="flex flex-wrap items-center gap-x-6 gap-y-4">
				<div className="flex items-center gap-3">
					<Dial pct={gw.score} size={84} stroke={7} color={vibeVar(gw.vibe)} label={gw.score == null ? "GoodWatch score: not scored yet" : `GoodWatch score ${gw.score} out of 100, ${gw.word}`}>
						<span className="text-3xl font-extrabold leading-none tabular-nums text-white" style={display}>
							{gw.score ?? "–"}
						</span>
					</Dial>
					<div className="leading-tight" aria-hidden="true">
						<div className="text-lg font-bold text-white" style={display}>
							{gw.word ?? "Not scored yet"}
						</div>
						<div className="text-xs text-gray-300">GoodWatch score</div>
					</div>
				</div>

				<RateTrigger
					media={media}
					className="ml-auto lg:order-last"
					buttonClassName="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20"
				>
					{({ score }) =>
						score ? (
							<>
								<Dial pct={score * 10} size={30} stroke={3} color={`var(--color-vibe-${score * 10})`} label="">
									<span className="text-xs font-bold tabular-nums">{score}</span>
								</Dial>
								{scoreLabels[score]}
							</>
						) : (
							<>
								<StarIcon className="h-4 w-4 text-yellow-300" aria-hidden="true" />
								Rate this
							</>
						)
					}
				</RateTrigger>

				<div className="flex w-full flex-wrap items-start justify-between gap-x-4 gap-y-3 border-t border-white/10 pt-3 lg:w-auto lg:justify-start lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
					{sites.length === 0 && <p className="text-sm text-gray-400">No critic or audience scores yet.</p>}
					{sites.map((site) => (
						<a key={site.key} href={site.url} target="_blank" rel="noreferrer" className="group flex flex-col items-center rounded-lg focus-visible:outline-2 focus-visible:outline-white">
							<div className="flex gap-1.5">
								{site.key === "imdb" ? (
									<SourceDial s={site.audience} fallbackLabel="IMDb users" />
								) : (
									<>
										<SourceDial s={site.critics} fallbackLabel={`${site.name} critics`} />
										<SourceDial s={site.audience} fallbackLabel={`${site.name} audience`} />
									</>
								)}
							</div>
							<span className="mt-0.5 text-xs font-semibold text-gray-100 group-hover:underline">{site.name}</span>
						</a>
					))}
					{hasEpisodeGrid && (
						<EpisodesLink className="flex flex-col items-center gap-1 self-stretch rounded-lg px-1 text-center text-xs font-semibold text-gray-100 hover:underline">
							<span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-dashed border-white/30">
								<TableCellsIcon className="h-5 w-5 text-gray-300" aria-hidden="true" />
							</span>
							<span className="-mt-0.5 max-w-16 leading-tight">Episode ratings</span>
						</EpisodesLink>
					)}
				</div>
			</div>
		</div>
	)
}
