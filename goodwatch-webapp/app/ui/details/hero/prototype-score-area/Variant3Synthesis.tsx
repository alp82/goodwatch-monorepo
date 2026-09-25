// PROTOTYPE — variant 3, "Synthesis": one calm line with the GoodWatch score as a seal. The
// outside scores collapse into "from N scores" with small grayscale site marks; hover, tap, or
// Enter opens the breakdown with a bar per source on the same 0 to 100 scale.
import { ChevronDownIcon, StarIcon, TableCellsIcon } from "@heroicons/react/20/solid"
import { useEffect, useRef, useState } from "react"
import { EpisodesLink, RateTrigger, SiteMark, type VariantProps, compact, kindLabel, onVibe, scoreData, vibeVar } from "./shared"
import { scoreLabels } from "~/utils/ratings"

const display = { fontFamily: "'Bricolage Grotesque', Gabarito, sans-serif" }

export default function Variant3Synthesis({ media, hasEpisodeGrid }: VariantProps) {
	const { gw, sites, sources } = scoreData(media)
	const [open, setOpen] = useState(false)
	const hoverTimer = useRef<ReturnType<typeof setTimeout>>()
	const wrap = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		const onDown = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false)
		document.addEventListener("keydown", onKey)
		document.addEventListener("mousedown", onDown)
		return () => {
			document.removeEventListener("keydown", onKey)
			document.removeEventListener("mousedown", onDown)
		}
	}, [open])
	const hover = (next: boolean) => {
		if (!window.matchMedia("(hover: hover)").matches) return
		clearTimeout(hoverTimer.current)
		hoverTimer.current = setTimeout(() => setOpen(next), next ? 120 : 250)
	}

	return (
		<div className="relative z-30 px-4 pb-2 pt-3 md:m-3 md:rounded-[2rem] md:border md:border-white/10 md:bg-black/55 md:py-2 md:pl-2 md:pr-2 md:backdrop-blur-xl">
			<div className="flex flex-wrap items-center gap-x-5 gap-y-3">
				{/* Seal */}
				<div className="flex items-center gap-3">
					<div
						className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-lg shadow-black/40"
						style={{ background: gw.score == null ? "rgba(255,255,255,.08)" : vibeVar(gw.vibe), color: onVibe(gw.vibe) }}
					>
						<span className="absolute inset-[3px] rounded-full border border-current opacity-30" aria-hidden="true" />
						<span className="text-2xl font-extrabold tabular-nums" style={display}>
							{gw.score ?? "–"}
						</span>
					</div>
					<div className="leading-tight">
						<div className="text-lg font-bold text-white" style={display}>
							{gw.word ?? "Not scored yet"}
						</div>
						<div className="text-xs text-gray-300">GoodWatch score</div>
					</div>
				</div>

				{/* Disclosure */}
				<div ref={wrap} className="relative order-3 w-full md:order-none md:w-auto" onPointerEnter={() => hover(true)} onPointerLeave={() => hover(false)}>
					<button
						type="button"
						aria-expanded={open}
						aria-controls="proto-score-breakdown"
						onClick={() => setOpen(!open)}
						disabled={sources.length === 0}
						className="flex h-11 w-full cursor-pointer items-center gap-2.5 rounded-full border border-white/15 bg-white/5 pl-2 pr-3 text-sm text-gray-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-60 md:w-auto"
					>
						<span className="flex -space-x-1.5">
							{sites.map((s) => (
								<span key={s.key} className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-stone-800 ring-2 ring-stone-900">
									<SiteMark site={s} className={s.key === "imdb" ? "h-3.5 !px-[2px] !text-[7px]" : "h-5 w-5 rounded-full"} />
								</span>
							))}
						</span>
						<span className="whitespace-nowrap">
							{sources.length === 0 ? "No outside scores yet" : `Based on ${sources.length} ${sources.length === 1 ? "score" : "scores"}`}
						</span>
						{sources.length > 0 && <ChevronDownIcon className={`ml-auto h-4 w-4 text-gray-400 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />}
					</button>

					{open && (
						<div
							id="proto-score-breakdown"
							className="mt-2 w-full rounded-2xl border border-white/10 bg-stone-900/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl md:absolute md:left-0 md:top-full md:z-50 md:w-[22rem] lg:w-[24rem]"
						>
							<p className="mb-3 text-xs leading-snug text-gray-300">GoodWatch combines these into one score out of 100. Each bar uses that same scale.</p>
							<ul className="flex flex-col gap-2.5">
								{sources.map((s) => {
									const site = sites.find((x) => x.key === s.site)!
									return (
										<li key={s.id}>
											<a href={s.url} target="_blank" rel="noreferrer" className="group block rounded-md focus-visible:outline-2 focus-visible:outline-white">
												<div className="flex items-center gap-2 text-sm">
													<SiteMark site={site} className={site.key === "imdb" ? "h-4" : "h-4 w-4"} />
													<span className="text-gray-100 group-hover:underline">
														{s.siteName} {kindLabel(s).toLowerCase()}
													</span>
													{s.count && <span className="text-xs text-gray-400">{compact(s.count)} {s.kind === "critics" ? "reviews" : "ratings"}</span>}
													<span className="ml-auto font-semibold tabular-nums text-white">{s.value}</span>
												</div>
												<div className="relative mt-1 h-1.5 rounded-full bg-white/10">
													<div className="h-full rounded-full bg-white/70" style={{ width: `${s.pct}%` }} />
													{gw.score != null && <div className="absolute -top-1 h-3.5 w-[2px] -translate-x-1/2 rounded-full" style={{ left: `${gw.score}%`, background: vibeVar(gw.vibe) }} />}
												</div>
											</a>
										</li>
									)
								})}
							</ul>
							{gw.score != null && (
								<p className="mt-3 flex items-center gap-2 text-xs text-gray-300">
									<span className="inline-block h-3 w-[2px] rounded-full" style={{ background: vibeVar(gw.vibe) }} aria-hidden="true" />
									GoodWatch score, {gw.score}
								</p>
							)}
						</div>
					)}
				</div>

				{hasEpisodeGrid && (
					<EpisodesLink className="order-4 inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm text-gray-200 hover:bg-white/10 md:order-none">
						<TableCellsIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
						Episode ratings
					</EpisodesLink>
				)}

				<RateTrigger
					media={media}
					className="order-2 ml-auto md:order-none"
					buttonClassName="inline-flex h-11 items-center gap-2 rounded-full bg-yellow-400 px-4 text-sm font-bold text-black hover:bg-yellow-300"
				>
					{({ score }) =>
						score ? (
							<>
								<span className="flex h-7 w-7 items-center justify-center rounded-full tabular-nums" style={{ background: `var(--color-vibe-${score * 10})`, color: onVibe(score * 10) }}>
									{score}
								</span>
								{scoreLabels[score]}
							</>
						) : (
							<>
								<StarIcon className="h-4 w-4" aria-hidden="true" />
								Rate this
							</>
						)
					}
				</RateTrigger>
			</div>
		</div>
	)
}
