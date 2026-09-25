// The episode ratings grid (#153). One component, two orientations picked by the width of
// its own box (a container query, so it follows the column it sits in, not the window):
//
// - wide (42rem and up): seasons as rows, episodes as columns. Reads left to right like
//   every other episode grid, and a long season fits across a desktop column.
// - narrow: seasons as columns, episodes as rows. On a phone most shows have far fewer
//   seasons than episodes per season, so the grid fits the width and grows downwards,
//   which is the direction a phone scrolls anyway.
//
// Both are rendered and CSS hides one, so the server render matches the client and
// nothing jumps on hydration. A grid wider than its box scrolls sideways inside the box,
// never the page.
//
// The default view is the episode scores and one IMDb season score. Titles, votes, every
// site's season score and the key sit behind hover, focus or tap.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { InformationCircleIcon } from "@heroicons/react/24/outline"
import { type CSSProperties, type ReactNode, useCallback, useEffect, useState } from "react"
import type { EpisodeGrid as EpisodeGridData, GridEpisode, GridSeason, GridSpecial } from "~/server/episode-grid.server"
import type { GridDesign } from "~/ui/details/episode-grid/prototype/designs"
import {
	PROVIDERS,
	type ProviderKey,
	formatScore,
	imdbVibe,
	isLowVotes,
	vibeInkClass,
	vibeTextColor,
	vibeTint,
} from "~/ui/details/episode-grid/scale"
import {
	EpisodeTip,
	FloatLayer,
	ImdbAttribution,
	LegendContent,
	ProviderLogo,
	SeasonScoreList,
	SeasonTip,
	episodeLabel,
	episodeSlots,
	seasonLabel,
	useFloat,
} from "~/ui/details/episode-grid/shared"

type Episode = GridEpisode | GridSpecial
type Orientation = "wide" | "narrow"

const SURFACE = "bg-[#141923]"
const NUMBERS_KEY = "episode-grid-numbers"

/** A yes/no choice remembered on this device. Renders `false` on the server. */
function useRememberedFlag(key: string) {
	const [value, setValue] = useState(false)
	useEffect(() => {
		try {
			setValue(localStorage.getItem(key) === "1")
		} catch {}
	}, [key])
	const set = useCallback(
		(next: boolean) => {
			setValue(next)
			try {
				localStorage.setItem(key, next ? "1" : "0")
			} catch {}
		},
		[key],
	)
	return [value, set] as const
}

function Toggle({ pressed, onChange, children }: { pressed: boolean; onChange: (next: boolean) => void; children: ReactNode }) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			onClick={() => onChange(!pressed)}
			className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-white ${
				pressed ? "border-white/70 bg-white text-gray-900" : "border-white/15 text-gray-300 hover:border-white/40 hover:text-white"
			}`}
		>
			{children}
		</button>
	)
}

export default function EpisodeGrid({ grid, design }: { grid: EpisodeGridData; design: GridDesign }) {
	const float = useFloat()
	const [showSites, setShowSites] = useState(false)
	const [numbersOn, setNumbersOn] = useRememberedFlag(NUMBERS_KEY)
	const [expanded, setExpanded] = useState<number | null>(null)

	const showNumbers = design.cell !== "mosaic" || numbersOn
	const first = grid.hasEpisodeZero ? 0 : 1
	const columns = grid.maxEpisodeNumber - first + 1
	const extraSites: ProviderKey[] = design.season === "sites-switch" && showSites ? grid.providers.filter((p) => p !== "imdb") : []
	const hasImdbColumn = design.season === "sites-switch"
	const expandedSeason = design.season === "expand" ? (grid.seasons.find((s) => s.number === expanded) ?? null) : null

	// ---- cells ---------------------------------------------------------------------------

	const cellSize = (o: Orientation) =>
		showNumbers
			? o === "wide"
				? "h-8 w-10 text-[12.5px]"
				: "h-7 w-full min-w-[2.125rem] text-xs"
			: o === "wide"
				? "h-6 w-6"
				: "h-5 w-full min-w-5"

	const paint = (episode: Episode): { className: string; style?: CSSProperties; mark?: ReactNode } => {
		const vibe = imdbVibe(episode.score)
		const low = isLowVotes(episode.votes)
		const solid = { className: `bg-vibe-${vibe} ${vibeInkClass(vibe)} font-semibold` }
		switch (design.cell) {
			case "filled":
				return low
					? { className: "border border-dashed font-semibold", style: { borderColor: `var(--color-vibe-${vibe})`, color: vibeTextColor(vibe) } }
					: solid
			case "ink":
				return {
					className: `bg-white/[0.045] font-semibold ${low ? "opacity-55" : ""}`,
					style: { color: vibeTextColor(vibe) },
					mark: low ? <span aria-hidden="true" className="absolute top-[3px] right-[3px] h-1 w-1 rounded-full bg-gray-300" /> : null,
				}
			case "mosaic":
				if (showNumbers) return low ? { className: "border border-dashed font-semibold", style: { borderColor: `var(--color-vibe-${vibe})`, color: vibeTextColor(vibe) } } : solid
				return low
					? { className: "flex items-center justify-center bg-white/[0.045]", mark: <span aria-hidden="true" className={`h-2 w-2 rounded-[2px] bg-vibe-${vibe}`} /> }
					: { className: `bg-vibe-${vibe}` }
			case "tint":
				return {
					className: "font-medium text-gray-50",
					style: { background: vibeTint(vibe, low ? 16 : 55) },
					mark: low ? (
						<span aria-hidden="true" className="absolute top-0 right-0 h-0 w-0 border-t-[7px] border-l-[7px] border-l-transparent" style={{ borderTopColor: vibeTextColor(vibe) }} />
					) : null,
				}
		}
	}

	const cell = (season: number | null, episode: Episode, o: Orientation, id: string) => {
		const { className, style, mark } = paint(episode)
		return (
			<button
				key={id}
				type="button"
				aria-label={episodeLabel(season, episode)}
				{...float.trigger(`ep-${id}`, () => <EpisodeTip season={season} episode={episode} />)}
				className={`relative block shrink-0 rounded-[4px] tabular-nums outline-offset-1 transition-[filter] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-white ${cellSize(o)} ${className} ${
					float.isOpen(`ep-${id}`) ? "outline-2 outline-white" : ""
				}`}
				style={style}
			>
				{showNumbers ? formatScore(episode.score) : null}
				{mark}
			</button>
		)
	}

	const gap = (number: number, o: Orientation) => (
		<span className={`block rounded-[4px] bg-white/[0.05] ${cellSize(o)}`}>
			<span className="sr-only">Episode {number} not rated</span>
		</span>
	)

	// ---- season labels -------------------------------------------------------------------

	const imdbSeasonText = (season: GridSeason, className = "") =>
		season.scores.imdb ? (
			<span className={`text-xs font-semibold tabular-nums ${className}`} style={{ color: vibeTextColor(imdbVibe(season.scores.imdb.score)) }}>
				{formatScore(season.scores.imdb.score)}
			</span>
		) : null

	const seasonChip = (season: GridSeason) => {
		const imdb = season.scores.imdb
		const vibe = imdb ? imdbVibe(imdb.score) : null
		return (
			<button
				type="button"
				aria-label={seasonLabel(season, grid.providers)}
				{...float.trigger(`season-${season.number}`, () => <SeasonTip season={season} providers={grid.providers} />)}
				className={`rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-white ${
					vibe === null ? "bg-white/10 text-gray-300" : `bg-vibe-${vibe} ${vibeInkClass(vibe)}`
				} ${float.isOpen(`season-${season.number}`) ? "outline-2 outline-white" : ""}`}
			>
				{imdb ? formatScore(imdb.score) : "–"}
			</button>
		)
	}

	const seasonHeader = (season: GridSeason, o: Orientation) => {
		const name = <span className="text-sm font-semibold text-gray-200">S{season.number}</span>
		const stack = o === "wide" ? "flex-row items-baseline gap-1.5" : "flex-col items-center gap-0.5"
		switch (design.season) {
			case "label-popover":
				return (
					<button
						type="button"
						aria-label={seasonLabel(season, grid.providers)}
						{...float.trigger(`season-${season.number}`, () => <SeasonTip season={season} providers={grid.providers} />)}
						className={`flex ${stack} rounded px-1 py-0.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white ${
							float.isOpen(`season-${season.number}`) ? "bg-white/10" : ""
						}`}
					>
						{name}
						{imdbSeasonText(season)}
					</button>
				)
			case "sites-switch":
				return name
			case "expand": {
				const open = expanded === season.number
				return (
					<button
						type="button"
						aria-expanded={open}
						aria-label={`Season ${season.number}: ${open ? "hide" : "show"} every site's season score`}
						onClick={() => setExpanded(open ? null : season.number)}
						className={`flex ${o === "wide" ? "flex-row" : "flex-col"} items-center gap-0.5 rounded px-1 py-0.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white ${open ? "bg-white/10" : ""}`}
					>
						{name}
						<ChevronDownIcon aria-hidden="true" className={`h-3.5 w-3.5 text-gray-500 transition-transform ${open ? "rotate-180 text-gray-200" : ""}`} />
					</button>
				)
			}
			case "chip-popover":
				return (
					<span className={`flex ${stack}`}>
						{name}
						{seasonChip(season)}
					</span>
				)
		}
	}

	const siteValue = (season: GridSeason, p: ProviderKey) => {
		const value = season.scores[p]
		return value ? <span className="text-xs font-medium tabular-nums text-gray-200">{PROVIDERS[p].format(value.score)}</span> : <span className="text-xs text-gray-600">–</span>
	}

	const siteHeader = (p: ProviderKey) => {
		const meta = PROVIDERS[p]
		const suffix = meta.site === "rotten" || meta.site === "metacritic" ? meta.short : null
		return (
			<span className="flex flex-col items-center gap-0.5" title={meta.name}>
				<ProviderLogo provider={p} />
				<span className="text-[10px] leading-none text-gray-500">{suffix ?? " "}</span>
				<span className="sr-only">{meta.name}</span>
			</span>
		)
	}

	const expandedPanel = (season: GridSeason, o: Orientation) =>
		o === "wide" ? (
			<div className="sticky left-0 w-fit rounded-lg bg-white/[0.04] px-3 py-2">
				<SeasonScoreList season={season} providers={grid.providers} inline />
			</div>
		) : (
			<div className="sticky left-0 w-fit max-w-[min(22rem,calc(100vw-4rem))] rounded-lg bg-white/[0.04] px-3 py-2">
				<p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Season {season.number} by site</p>
				<SeasonScoreList season={season} providers={grid.providers} />
			</div>
		)

	// ---- wide: seasons as rows -----------------------------------------------------------

	const wideColumnCount = 1 + (hasImdbColumn ? 1 : 0) + columns + extraSites.length
	const wide = (
		<table className="border-separate border-spacing-[3px]">
			<caption className="sr-only">IMDb rating of every episode, one row per season</caption>
			<thead>
				<tr className="text-[11px] text-gray-500">
					<th scope="col" className={`sticky left-0 z-10 ${SURFACE} min-w-[4.25rem] text-left font-normal`}>
						<span className="sr-only">Season</span>
					</th>
					{hasImdbColumn && (
						<th scope="col" className={`sticky left-[4.25rem] z-10 ${SURFACE} pr-2 font-normal`}>
							<ProviderLogo provider="imdb" />
							<span className="sr-only">Season average</span>
						</th>
					)}
					{Array.from({ length: columns }, (_, i) => (
						<th key={i} scope="col" className="font-normal tabular-nums">
							<span className="sr-only">Episode </span>
							{first + i}
						</th>
					))}
					{extraSites.map((p) => (
						<th key={p} scope="col" className="px-1 font-normal">
							{siteHeader(p)}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{grid.seasons.map((season) => {
					const slots = episodeSlots(season.episodes, first, season.maxEpisodeNumber)
					return [
						<tr key={season.number}>
							<th scope="row" className={`sticky left-0 z-10 ${SURFACE} pr-1 text-left font-normal`}>
								{seasonHeader(season, "wide")}
							</th>
							{hasImdbColumn && (
								<td className={`sticky left-[4.25rem] z-10 ${SURFACE} pr-2 text-center`}>
									{season.scores.imdb ? imdbSeasonText(season, "text-[13px]") : <span className="text-gray-600">–</span>}
								</td>
							)}
							{slots.map(({ number, episode }) => (
								<td key={number} className="p-0">
									{episode ? cell(season.number, episode, "wide", `${season.number}-${number}`) : number >= 1 ? gap(number, "wide") : null}
								</td>
							))}
							{Array.from({ length: columns - slots.length }, (_, i) => (
								<td key={`pad-${i}`} />
							))}
							{extraSites.map((p) => (
								<td key={p} className="px-1 text-center">
									{siteValue(season, p)}
								</td>
							))}
						</tr>,
						expandedSeason?.number === season.number && (
							<tr key={`${season.number}-sites`}>
								<td colSpan={wideColumnCount} className="pb-2">
									{expandedPanel(season, "wide")}
								</td>
							</tr>
						),
					]
				})}
				{grid.specials.length > 0 && (
					<tr>
						<th scope="row" className={`sticky left-0 z-10 ${SURFACE} pt-2 pr-1 text-left align-top text-sm font-semibold text-gray-400`}>
							<abbr title="Specials, not counted in any season" className="no-underline">
								Specials
							</abbr>
						</th>
						<td colSpan={wideColumnCount - 1} className="pt-2">
							<div className="flex flex-wrap gap-[3px]">{grid.specials.map((special, i) => cell(null, special, "wide", `sp-${i}`))}</div>
						</td>
					</tr>
				)}
			</tbody>
		</table>
	)

	// ---- narrow: seasons as columns ------------------------------------------------------

	const hasSpecials = grid.specials.length > 0
	const narrowColumnCount = 1 + grid.seasons.length + (hasSpecials ? 1 : 0)
	const rows = Math.max(columns, grid.specials.length)
	const byNumber = grid.seasons.map((s) => new Map(s.episodes.map((e) => [e.number, e])))
	const narrow = (
		<table className="w-full border-separate border-spacing-[3px]">
			<caption className="sr-only">IMDb rating of every episode, one column per season</caption>
			<thead>
				<tr>
					<th scope="col" className={`sticky left-0 z-10 ${SURFACE} w-7`}>
						<span className="sr-only">Episode</span>
					</th>
					{grid.seasons.map((season) => (
						<th key={season.number} scope="col" className="pb-1 font-normal">
							<span className="flex justify-center">{seasonHeader(season, "narrow")}</span>
						</th>
					))}
					{hasSpecials && (
						<th scope="col" className="pb-1 align-top text-sm font-semibold text-gray-400">
							<abbr title="Specials, not counted in any season" className="no-underline">
								Sp
							</abbr>
						</th>
					)}
				</tr>
			</thead>
			<tbody>
				{expandedSeason && (
					<tr>
						<td colSpan={narrowColumnCount} className="pb-2">
							{expandedPanel(expandedSeason, "narrow")}
						</td>
					</tr>
				)}
				{hasImdbColumn &&
					(["imdb", ...extraSites] as ProviderKey[]).map((p, i, all) => (
						<tr key={p}>
							<th scope="row" className={`sticky left-0 z-10 ${SURFACE} pr-1 text-left font-normal`}>
								<span className="sr-only">{PROVIDERS[p].name}</span>
								{p === "imdb" ? (
									<ProviderLogo provider="imdb" />
								) : (
									<span className="block origin-left scale-90">{siteHeader(p)}</span>
								)}
							</th>
							{grid.seasons.map((season) => (
								<td key={season.number} className={`text-center ${i === all.length - 1 ? "pb-2" : ""}`}>
									{p === "imdb" ? (season.scores.imdb ? imdbSeasonText(season, "text-[13px]") : <span className="text-gray-600">–</span>) : siteValue(season, p)}
								</td>
							))}
							{hasSpecials && <td />}
						</tr>
					))}
				{Array.from({ length: rows }, (_, i) => {
					const number = first + i
					return (
						<tr key={number}>
							<th scope="row" className={`sticky left-0 z-10 ${SURFACE} pr-1 text-right text-[11px] font-normal tabular-nums text-gray-500`}>
								{number <= grid.maxEpisodeNumber ? (
									<>
										<span className="sr-only">Episode </span>
										{number}
									</>
								) : null}
							</th>
							{grid.seasons.map((season, si) => {
								const episode = byNumber[si].get(number)
								return (
									<td key={season.number} className="p-0">
										{episode
											? cell(season.number, episode, "narrow", `${season.number}-${number}`)
											: number >= 1 && number <= season.maxEpisodeNumber
												? gap(number, "narrow")
												: null}
									</td>
								)
							})}
							{hasSpecials && <td className="p-0">{grid.specials[i] && cell(null, grid.specials[i], "narrow", `sp-${i}`)}</td>}
						</tr>
					)
				})}
			</tbody>
		</table>
	)

	// ---- frame ---------------------------------------------------------------------------

	const lowVoteSample = (
		<span className={`relative inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-[3px] text-[10px] ${paint({ name: "", score: 8.2, votes: 1 }).className}`} style={paint({ name: "", score: 8.2, votes: 1 }).style}>
			{showNumbers ? "8.2" : null}
			{paint({ name: "", score: 8.2, votes: 1 }).mark}
		</span>
	)

	return (
		<section aria-labelledby="episode-grid-title">
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<h2 id="episode-grid-title" className="text-2xl font-bold">
					Episode ratings
				</h2>
				<div className="flex items-center gap-2">
					{design.season === "sites-switch" && (
						<Toggle pressed={showSites} onChange={setShowSites}>
							Scores by site
						</Toggle>
					)}
					{design.cell === "mosaic" && (
						<Toggle pressed={numbersOn} onChange={setNumbersOn}>
							Numbers
						</Toggle>
					)}
					<button
						type="button"
						aria-label="How to read the episode grid"
						{...float.trigger("legend", () => (
							<LegendContent lowVoteSample={lowVoteSample}>
								{hasSpecials && <p className="text-gray-400">Specials count toward no season.</p>}
								<p className="text-gray-400">Season scores: IMDb episodes, vote-weighted. {design.season === "sites-switch" ? "Switch on 'Scores by site' for the rest." : "Open a season for every site."}</p>
							</LegendContent>
						))}
						className="rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
					>
						<InformationCircleIcon className="h-5 w-5" />
					</button>
				</div>
			</div>
			<div className={`@container mt-4 rounded-2xl border border-white/[0.06] ${SURFACE} p-2 sm:p-3`}>
				<div className="hidden overflow-x-auto overscroll-x-contain @2xl:block">{wide}</div>
				<div className="overflow-x-auto overscroll-x-contain @2xl:hidden">{narrow}</div>
			</div>
			<div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<p className="text-xs text-gray-500">Hover or tap {design.season === "sites-switch" ? "an episode" : "an episode or season"} for details.</p>
				<ImdbAttribution />
			</div>
			<FloatLayer state={float.state} />
		</section>
	)
}
