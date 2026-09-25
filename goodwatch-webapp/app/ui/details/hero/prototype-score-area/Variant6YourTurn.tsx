// PROTOTYPE — variant 6, "Your turn": the viewer's own score is the main event. A ten-step
// scale sits in the bar, always ready, with the GoodWatch score pinned on the same scale so
// rating feels like answering "do you agree?". The outside scores shrink to one quiet line.
import { TableCellsIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { useUserScore } from "~/hooks/useUserDataAccessors"
import type { Score } from "~/server/scores.server"
import ScoreAction from "~/ui/user/actions/ScoreAction"
import { scoreLabels } from "~/utils/ratings"
import { EpisodesLink, type VariantProps, kindLabel, onVibe, scoreData, vibeVar } from "./shared"

const display = { fontFamily: "'Bricolage Grotesque', Gabarito, sans-serif" }

export default function Variant6YourTurn({ media, hasEpisodeGrid }: VariantProps) {
	const { gw, sites } = scoreData(media)
	const current = useUserScore(media.mediaType, media.details.tmdb_id)?.score ?? null
	const [hover, setHover] = useState<number | null>(null)
	const shown = hover ?? current
	const diff = current != null && gw.score != null ? current * 10 - gw.score : null

	return (
		<div className="relative z-30 px-4 pb-2 pt-3 md:m-3 md:rounded-2xl md:border md:border-white/10 md:bg-black/60 md:p-4 md:backdrop-blur-md">
			<div className="grid gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,15rem)_1fr]">
				{/* GoodWatch + sources */}
				<div className="min-w-0">
					<div className="flex items-baseline gap-2">
						<span className="text-4xl font-extrabold leading-none tabular-nums text-white" style={display}>
							{gw.score ?? "–"}
						</span>
						<span className="text-lg font-bold text-white" style={display}>
							{gw.word ?? "Not scored yet"}
						</span>
					</div>
					<div className="mt-1 flex items-center gap-1.5 text-xs text-gray-300">
						<span className="h-2 w-2 rounded-full" style={{ background: vibeVar(gw.vibe) }} aria-hidden="true" />
						GoodWatch score
					</div>
					<p className="mt-2.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-300">
						{sites.length === 0 && <span>No critic or audience scores yet.</span>}
						{sites.map((site) => (
							<a key={site.key} href={site.url} target="_blank" rel="noreferrer" className="whitespace-nowrap hover:text-white hover:underline">
								{site.name}{" "}
								{[site.critics, site.audience]
									.filter((s) => s != null)
									.map((s) => (
										<span key={s.id} className="font-semibold tabular-nums text-gray-100" title={`${kindLabel(s)}`}>
											{s.value}
											{site.critics && site.audience && s.kind === "critics" ? <span className="font-normal text-gray-500"> / </span> : " "}
										</span>
									))}
							</a>
						))}
					</p>
					{hasEpisodeGrid && (
						<EpisodesLink className="mt-2 inline-flex items-center gap-1.5 rounded text-xs font-semibold text-gray-100 underline decoration-white/30 underline-offset-4 hover:decoration-white">
							<TableCellsIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
							Episode ratings
						</EpisodesLink>
					)}
				</div>

				{/* Your score */}
				<div className="min-w-0 rounded-xl bg-white/[.04] p-3 ring-1 ring-white/10 md:bg-transparent md:p-0 md:ring-0 lg:border-l lg:border-white/10 lg:pl-6">
					<div className="flex items-baseline justify-between gap-3">
						<h3 className="text-sm font-semibold text-white" aria-live="polite">
							{shown ? (
								<>
									<span className="mr-1.5 text-xl font-extrabold tabular-nums" style={display}>
										{shown}
									</span>
									{scoreLabels[shown]}
									{hover == null && current != null && <span className="ml-1.5 font-normal text-gray-300">is your score</span>}
								</>
							) : (
								<span className="text-base">What would you give it?</span>
							)}
						</h3>
						{current != null && hover == null ? (
							<span className="text-xs text-gray-300">
								{diff == null ? "" : Math.abs(diff) <= 5 ? "Right with GoodWatch" : diff > 0 ? `${diff} above GoodWatch` : `${-diff} below GoodWatch`}
								<ScoreAction media={media} score={null}>
									<button type="button" className="ml-2 cursor-pointer text-gray-400 underline underline-offset-2 hover:text-white">
										Clear
									</button>
								</ScoreAction>
							</span>
						) : (
							<span className="hidden text-xs text-gray-400 sm:inline">Tap a number</span>
						)}
					</div>

					<div className="relative mt-7">
						{/* GoodWatch pin on the same 1 to 10 scale */}
						{gw.score != null && (
							<div className="pointer-events-none absolute -top-6 z-10 flex -translate-x-1/2 flex-col items-center" style={{ left: `${(gw.score / 10 - 0.5) * 10}%` }} aria-hidden="true">
								<span className="whitespace-nowrap rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold leading-3 text-white ring-1" style={{ ["--tw-ring-color" as string]: vibeVar(gw.vibe) }}>
									GoodWatch {gw.score}
								</span>
								<span className="h-12 w-[2px] rounded-full" style={{ background: vibeVar(gw.vibe) }} />
							</div>
						)}
						<div className="flex h-14 items-end gap-1" onPointerLeave={() => setHover(null)} role="group" aria-label={`Your score for ${media.details.title}`}>
							{Array.from({ length: 10 }, (_, i) => (i + 1) as Score).map((n) => {
								const lit = shown != null && n <= shown
								return (
									<ScoreAction key={n} media={media} score={n}>
										<button
											type="button"
											aria-label={`${n}, ${scoreLabels[n]}`}
											aria-pressed={current === n}
											onPointerEnter={() => setHover(n)}
											onFocus={() => setHover(n)}
											onBlur={() => setHover(null)}
											className="group flex h-full min-w-0 flex-1 cursor-pointer items-end rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
										>
											<span
												className="flex w-full items-end justify-center rounded-md pb-1 text-xs font-bold tabular-nums transition-[height,background-color] duration-150 motion-reduce:transition-none"
												style={{
													height: `${40 + n * 6}%`,
													background: lit ? `var(--color-vibe-${shown! * 10})` : `color-mix(in srgb, var(--color-vibe-${n * 10}) 28%, rgba(255,255,255,.06))`,
													color: lit ? onVibe(shown! * 10) : "rgba(255,255,255,.85)",
												}}
											>
												{n}
											</span>
										</button>
									</ScoreAction>
								)
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
