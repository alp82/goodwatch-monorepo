// PROTOTYPE (#153) variant D, "Scoreboard": the season scores lead. A ribbon shows every
// episode of the show in order, one thin stripe each, for the shape of the whole run.
// Below it a table compares each site's season score, and opening a season lists its
// episodes by name. Everything is read top to bottom; nothing scrolls sideways.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { Fragment, useState } from "react"
import type { GridEpisode, GridSpecial } from "~/server/episode-grid.server"
import type { GridVariantProps } from "~/ui/details/episode-grid/EpisodeGridSection"
import { PROVIDERS, cellColors, formatCount, formatScore } from "~/ui/details/episode-grid/scale"
import { ProviderMark, ScoreLegend, episodeSlots, isLowVotes, providerTitle } from "~/ui/details/episode-grid/shared"

type SeasonKey = number | "specials"

function Ribbon({ grid, open, onOpen }: GridVariantProps & { open: SeasonKey | null; onOpen: (key: SeasonKey) => void }) {
	const groups: { key: SeasonKey; label: string; episodes: (GridEpisode | GridSpecial | null)[] }[] = [
		...grid.seasons.map((s) => ({
			key: s.number as SeasonKey,
			label: String(s.number),
			episodes: episodeSlots(s.episodes, s.episodes[0].number === 0 ? 0 : 1, s.maxEpisodeNumber).map((slot) => slot.episode),
		})),
		...(grid.specials.length ? [{ key: "specials" as SeasonKey, label: "Sp", episodes: grid.specials }] : []),
	]
	const labelEvery = groups.length > 24 ? 5 : groups.length > 12 ? 2 : 1
	return (
		<div>
			<div className="flex h-14 w-full gap-[3px]" aria-label="Every episode in order, grouped by season">
				{groups.map((group) => (
					<button
						key={group.key}
						type="button"
						onClick={() => onOpen(group.key)}
						aria-label={group.key === "specials" ? "Open the specials" : `Open season ${group.key}`}
						className={`flex min-w-0 items-end gap-px rounded-[3px] focus-visible:outline-2 focus-visible:outline-white ${open === group.key ? "outline-2 outline-offset-2 outline-white/80" : ""}`}
						style={{ flexGrow: group.episodes.length, flexBasis: 0 }}
					>
						{group.episodes.map((e, i) => (
							<span
								key={i}
								className="block min-w-0 flex-1"
								style={
									e
										? { height: isLowVotes(e.votes) ? "45%" : "100%", background: cellColors(e.score).background }
										: { height: "8%", background: "rgba(255,255,255,0.12)" }
								}
							/>
						))}
					</button>
				))}
			</div>
			<div aria-hidden="true" className="mt-1 flex w-full gap-[3px] text-[10px] tabular-nums text-gray-400">
				{groups.map((group, i) => (
					<span key={group.key} className="min-w-0 overflow-visible whitespace-nowrap" style={{ flexGrow: group.episodes.length, flexBasis: 0 }}>
						{i % labelEvery === 0 || group.key === "specials" ? group.label : ""}
					</span>
				))}
			</div>
		</div>
	)
}

function EpisodeList({ season, episodes }: { season: number | null; episodes: { number: number | null; episode: GridEpisode | GridSpecial | null }[] }) {
	return (
		<ol className="max-w-2xl divide-y divide-white/[0.06]">
			{episodes.map(({ number, episode }, i) => {
				if (!episode)
					return (
						<li key={i} className="flex items-center gap-3 py-2 text-sm text-gray-500">
							<span className="w-8 text-right tabular-nums">{number}</span>
							<span>Not rated on IMDb</span>
						</li>
					)
				const colors = cellColors(episode.score)
				const low = isLowVotes(episode.votes)
				return (
					<li key={i} className="flex items-center gap-3 py-2 text-sm">
						<span className="w-8 shrink-0 text-right tabular-nums text-gray-400">{number ?? ""}</span>
						<span className="min-w-0 grow">
							<span className="block truncate font-medium text-gray-100">{episode.name || "Untitled"}</span>
							<span className="block text-xs text-gray-400">
								{formatCount(episode.votes)} votes{low ? ", few votes" : ""}
							</span>
						</span>
						<span
							className="flex h-8 w-11 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums"
							style={low ? { boxShadow: `inset 0 0 0 2px ${colors.background}`, color: "#e5e7eb" } : { background: colors.background, color: colors.color }}
							aria-label={`${formatScore(episode.score)} on IMDb`}
						>
							{formatScore(episode.score)}
						</span>
					</li>
				)
			})}
		</ol>
	)
}

export default function VariantScoreboard({ grid, title }: GridVariantProps) {
	const [open, setOpen] = useState<SeasonKey | null>(grid.seasons[0]?.number ?? null)
	const toggle = (key: SeasonKey) => setOpen((current) => (current === key ? null : key))
	const openFromRibbon = (key: SeasonKey) => {
		setOpen(key)
		document.getElementById(`episode-grid-season-${key}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
	}
	const columns = grid.providers.length + 2

	return (
		<div className="flex flex-col gap-5">
			<div className="rounded-2xl border border-white/8 bg-white/4 p-4">
				<h3 className="mb-3 text-sm font-medium text-gray-300">Every episode of {title}</h3>
				<Ribbon grid={grid} title={title} open={open} onOpen={openFromRibbon} />
				<div className="mt-4">
					<ScoreLegend compact />
				</div>
			</div>

			<table className="w-full table-fixed border-collapse text-sm">
				<caption className="sr-only">Season scores from every site. Open a season to see its episodes.</caption>
				<thead>
					<tr className="border-b border-white/10 text-[11px] text-gray-400">
						<th scope="col" className="w-[4.5rem] py-2 text-left font-medium sm:w-28">
							Season
						</th>
						{grid.providers.map((p) => (
							<th key={p} scope="col" className="py-2 font-medium">
								<span className="flex justify-center">
									<ProviderMark provider={p} label className="flex-col" />
								</span>
							</th>
						))}
						<th scope="col" className="w-6">
							<span className="sr-only">Episodes</span>
						</th>
					</tr>
				</thead>
				<tbody>
					{grid.seasons.map((season) => {
						const isOpen = open === season.number
						return (
							<Fragment key={season.number}>
								{/* The row click is a larger mouse target; the season button carries keyboard and screen readers. */}
								{/* biome-ignore lint/a11y/useKeyWithClickEvents: see above */}
								<tr
									id={`episode-grid-season-${season.number}`}
									className={`cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.04] ${isOpen ? "bg-white/[0.04]" : ""}`}
									onClick={() => toggle(season.number)}
								>
									<th scope="row" className="py-2 text-left font-semibold text-gray-100">
										<button type="button" aria-expanded={isOpen} className="text-left focus-visible:outline-2 focus-visible:outline-white" onClick={(e) => { e.stopPropagation(); toggle(season.number) }}>
											<span className="sm:hidden">S{season.number}</span>
											<span className="hidden sm:inline">Season {season.number}</span>
										</button>
									</th>
									{grid.providers.map((p) => {
										const value = season.scores[p]
										return (
											<td key={p} className="py-2 text-center tabular-nums" title={providerTitle(p, value)}>
												{!value ? (
													<span className="text-gray-600">–</span>
												) : p === "imdb" ? (
													<span className="inline-flex h-7 w-11 items-center justify-center rounded-md font-bold" style={cellColors(value.score)}>
														{formatScore(value.score)}
													</span>
												) : (
													<span className="font-medium text-gray-100">{PROVIDERS[p].format(value.score)}</span>
												)}
											</td>
										)
									})}
									<td className="py-2 text-gray-400">
										<ChevronDownIcon aria-hidden="true" className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
									</td>
								</tr>
								{isOpen && (
									<tr>
										<td colSpan={columns} className="pb-3 pl-1 sm:pl-28">
											<EpisodeList
												season={season.number}
												episodes={episodeSlots(season.episodes, season.episodes[0].number === 0 ? 0 : 1, season.maxEpisodeNumber)}
											/>
										</td>
									</tr>
								)}
							</Fragment>
						)
					})}
					{grid.specials.length > 0 && (
						<>
							{/* biome-ignore lint/a11y/useKeyWithClickEvents: the Specials button carries the keyboard */}
							<tr
								id="episode-grid-season-specials"
								className="cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.04]"
								onClick={() => toggle("specials")}
							>
								<th scope="row" className="py-2 text-left font-semibold text-gray-100">
									<button type="button" aria-expanded={open === "specials"} className="text-left focus-visible:outline-2 focus-visible:outline-white" onClick={(e) => { e.stopPropagation(); toggle("specials") }}>
										Specials
									</button>
								</th>
								<td colSpan={grid.providers.length} className="py-2 text-center text-xs text-gray-400">
									{grid.specials.length} rated, counted in no season
								</td>
								<td className="py-2 text-gray-400">
									<ChevronDownIcon aria-hidden="true" className={`h-5 w-5 transition-transform ${open === "specials" ? "rotate-180" : ""}`} />
								</td>
							</tr>
							{open === "specials" && (
								<tr>
									<td colSpan={columns} className="pb-3 pl-1 sm:pl-28">
										<EpisodeList season={null} episodes={grid.specials.map((episode) => ({ number: null, episode }))} />
									</td>
								</tr>
							)}
						</>
					)}
				</tbody>
			</table>
		</div>
	)
}
