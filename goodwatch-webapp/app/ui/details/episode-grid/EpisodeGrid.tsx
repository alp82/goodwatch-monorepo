// The episode ratings grid (#153). One component, two orientations:
//
// - rows: seasons as rows, episodes as columns. Reads left to right like every other
//   episode grid. Used only when the longest season fits the grid's box at full cell size.
// - columns: seasons as columns, episodes as rows. On a phone most shows have far fewer
//   seasons than episodes per season, so the grid fits the width and grows downwards,
//   which is the direction a phone scrolls anyway.
//
// Both are rendered and a container query on the grid's own box picks one. The query's
// width is the rows table's width, worked out from the show's episode count, so the server
// render matches the client and nothing jumps on hydration. A grid wider than its box
// scrolls sideways inside the box, never the page.
//
// Episodes are solid vibe tiles with the score in white. Each season label carries the
// IMDb season score; hovering, focusing or tapping it opens every site's season score.
// Titles and votes open the same way on an episode, and the key sits behind the info button.
import { InformationCircleIcon } from "@heroicons/react/24/outline"
import type { EpisodeGrid as EpisodeGridData, GridEpisode, GridSeason, GridSpecial } from "~/server/episode-grid.server"
import {
	EPISODE_GRID_ANCHOR,
	formatScore,
	imdbVibe,
	isLowVotes,
	vibeTileColor,
	vibeWash,
} from "~/ui/details/episode-grid/scale"
import {
	EpisodeTip,
	FloatLayer,
	LegendContent,
	SeasonTip,
	episodeLabel,
	episodeSlots,
	seasonLabel,
	useFloat,
} from "~/ui/details/episode-grid/shared"

type Episode = GridEpisode | GridSpecial
type Orientation = "wide" | "narrow"

const SURFACE = "bg-[#141923]"
// Keep these in step with the rows table's classes: the season label column (min-w-[4.25rem]),
// the tile width (w-10) and the cell spacing (border-spacing-[3px]).
const ROWS_LABEL_REM = 4.25
const ROWS_CELL_REM = 2.5
const CELL_SPACING_REM = 3 / 16

/** The width the rows table needs to show `columns` episode columns without scrolling. */
const rowsWidthRem = (columns: number) => ROWS_LABEL_REM + columns * ROWS_CELL_REM + (columns + 2) * CELL_SPACING_REM

/**
 * Shows the rows table only when its box is wide enough for every episode column, and the
 * columns table otherwise. Container query conditions cannot read custom properties, so
 * the width goes into the rule itself.
 */
const layoutRule = (columns: number) =>
	`#${EPISODE_GRID_ANCHOR} [data-grid-layout="rows"]{display:none}` +
	`@container episode-grid (min-width: ${rowsWidthRem(columns)}rem){` +
	`#${EPISODE_GRID_ANCHOR} [data-grid-layout="rows"]{display:block}` +
	`#${EPISODE_GRID_ANCHOR} [data-grid-layout="columns"]{display:none}}`
const CELL_SIZE: Record<Orientation, string> = {
	wide: "h-8 w-10 text-[12.5px]",
	narrow: "h-7 w-full min-w-[2.125rem] text-xs",
}

/**
 * The paint of an episode tile. Well-voted episodes are solid vibe tiles; episodes with few
 * votes are a faint wash of their vibe with a dashed vibe border. The number is white on both.
 */
const tilePaint = (episode: Pick<Episode, "score" | "votes">) => {
	const vibe = imdbVibe(episode.score)
	return isLowVotes(episode.votes)
		? { className: "border border-dashed", style: { borderColor: `var(--color-vibe-${vibe})`, background: vibeWash(vibe) } }
		: { className: "", style: { background: vibeTileColor(vibe) } }
}

// The site bar above the sticky title header.
const SITE_BAR_HEIGHT = 64

export default function EpisodeGrid({ grid, headerHeight }: { grid: EpisodeGridData; headerHeight?: number }) {
	const float = useFloat()

	const first = grid.hasEpisodeZero ? 0 : 1
	const columns = grid.maxEpisodeNumber - first + 1
	const episodeNumbers = Array.from({ length: columns }, (_, i) => first + i)
	const hasSpecials = grid.specials.length > 0

	// ---- cells ---------------------------------------------------------------------------

	const cell = (season: number | null, episode: Episode, o: Orientation, id: string) => {
		const { className, style } = tilePaint(episode)
		return (
			<button
				key={id}
				type="button"
				aria-label={episodeLabel(season, episode)}
				{...float.trigger(`ep-${id}`, () => <EpisodeTip season={season} episode={episode} />)}
				className={`relative block shrink-0 rounded-[4px] font-semibold tabular-nums text-white outline-offset-1 transition-[filter] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-white ${CELL_SIZE[o]} ${className} ${
					float.isOpen(`ep-${id}`) ? "outline-2 outline-white" : ""
				}`}
				style={style}
			>
				{formatScore(episode.score)}
			</button>
		)
	}

	const gap = (number: number, o: Orientation) => (
		<span className={`block rounded-[4px] bg-white/[0.05] ${CELL_SIZE[o]}`}>
			<span className="sr-only">Episode {number} not rated</span>
		</span>
	)

	// ---- season labels -------------------------------------------------------------------

	const seasonHeader = (season: GridSeason, o: Orientation) => (
		<button
			type="button"
			aria-label={seasonLabel(season, grid.providers)}
			{...float.trigger(`season-${season.number}`, () => <SeasonTip season={season} providers={grid.providers} />)}
			className={`flex ${o === "wide" ? "flex-row items-baseline gap-1.5" : "flex-col items-center gap-0.5"} rounded px-1 py-0.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white ${
				float.isOpen(`season-${season.number}`) ? "bg-white/10" : ""
			}`}
		>
			<span className="text-sm font-semibold text-white">S{season.number}</span>
			{season.scores.imdb ? (
				<span className="text-xs font-semibold tabular-nums text-white">{formatScore(season.scores.imdb.score)}</span>
			) : null}
		</button>
	)

	const specialsLabel = (text: string) => (
		<abbr title="Specials, not counted in any season" className="no-underline">
			{text}
		</abbr>
	)

	// ---- wide: seasons as rows -----------------------------------------------------------

	const wide = (
		<table className="border-separate border-spacing-[3px]">
			<caption className="sr-only">IMDb rating of every episode, one row per season</caption>
			<thead>
				<tr className="text-[11px] text-gray-500">
					<th scope="col" className={`sticky left-0 z-10 ${SURFACE} min-w-[4.25rem] text-left font-normal`}>
						<span className="sr-only">Season</span>
					</th>
					{episodeNumbers.map((number) => (
						<th key={number} scope="col" className="font-normal tabular-nums">
							<span className="sr-only">Episode </span>
							{number}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{grid.seasons.map((season) => {
					const slots = episodeSlots(season.episodes, first, season.maxEpisodeNumber)
					return (
						<tr key={season.number}>
							<th scope="row" className={`sticky left-0 z-10 ${SURFACE} pr-1 text-left font-normal`}>
								{seasonHeader(season, "wide")}
							</th>
							{slots.map(({ number, episode }) => (
								<td key={number} className="p-0">
									{episode ? cell(season.number, episode, "wide", `${season.number}-${number}`) : number >= 1 ? gap(number, "wide") : null}
								</td>
							))}
							{episodeNumbers.slice(slots.length).map((number) => (
								<td key={`pad-${number}`} />
							))}
						</tr>
					)
				})}
				{hasSpecials && (
					<tr>
						<th scope="row" className={`sticky left-0 z-10 ${SURFACE} pt-2 pr-1 text-left align-top text-sm font-semibold text-gray-400`}>
							{specialsLabel("Specials")}
						</th>
						<td colSpan={columns} className="pt-2">
							<div className="flex flex-wrap gap-[3px]">{grid.specials.map((special, i) => cell(null, special, "wide", `sp-${i}`))}</div>
						</td>
					</tr>
				)}
			</tbody>
		</table>
	)

	// ---- narrow: seasons as columns ------------------------------------------------------

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
							{specialsLabel("Sp")}
						</th>
					)}
				</tr>
			</thead>
			<tbody>
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

	const sample = tilePaint({ score: 8.2, votes: 1 })
	const lowVoteSample = (
		<span
			className={`inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-[3px] text-[10px] font-semibold text-white ${sample.className}`}
			style={sample.style}
		>
			8.2
		</span>
	)

	return (
		<section
			id={EPISODE_GRID_ANCHOR}
			aria-labelledby="episode-grid-title"
			// Scroll clear of the site bar and the sticky title header, which grows on phones and
			// with the discovery bar; the classes cover the server render before it is measured.
			className="scroll-mt-60 sm:scroll-mt-64 md:scroll-mt-72"
			style={headerHeight ? { scrollMarginTop: SITE_BAR_HEIGHT + headerHeight + 16 } : undefined}
		>
			<div className="flex items-center justify-between gap-4">
				<h2 id="episode-grid-title" tabIndex={-1} className="text-2xl font-bold focus:outline-none">
					Episode ratings
				</h2>
				<button
					type="button"
					aria-label="How to read the episode grid"
					{...float.trigger("legend", () => (
						<LegendContent lowVoteSample={lowVoteSample}>
							{hasSpecials && <p className="text-gray-400">Specials count toward no season.</p>}
							<p className="text-gray-400">Season scores: IMDb episodes, vote-weighted. Open a season for every site.</p>
						</LegendContent>
					))}
					className="rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
				>
					<InformationCircleIcon className="h-5 w-5" />
				</button>
			</div>
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed rule built from a number */}
			<style dangerouslySetInnerHTML={{ __html: layoutRule(columns) }} />
			<div className={`@container/episode-grid mt-4 rounded-2xl border border-white/[0.06] ${SURFACE} p-2 sm:p-3`}>
				<div data-grid-layout="rows" className="overflow-x-auto overscroll-x-contain">
					{wide}
				</div>
				<div data-grid-layout="columns" className="overflow-x-auto overscroll-x-contain">
					{narrow}
				</div>
			</div>
			<FloatLayer state={float.state} topInset={SITE_BAR_HEIGHT + (headerHeight ?? 0)} />
		</section>
	)
}
