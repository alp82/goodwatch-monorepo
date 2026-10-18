// The episode ratings grid (#153). One component, two orientations:
//
// - rows: seasons as rows, episodes as columns. Reads left to right like every other
//   episode grid. Used only when the longest season fits the grid's box at full cell size.
// - columns: seasons as columns, episodes as rows. On a phone most shows have far fewer
//   seasons than episodes per season, so the grid fits the width and grows downwards,
//   which is the direction a phone scrolls anyway.
//
// Both are rendered and a container query on the grid's own box picks one. The query's
// width is the rows table's width, worked out from the show's columns, so the server
// render matches the client and nothing jumps on hydration. A grid wider than its box
// scrolls sideways inside the box, never the page.
//
// Episodes are solid vibe tiles with the score in white. Each season label carries the
// IMDb season score; hovering, focusing or tapping it opens every site's season score.
// Titles and votes open the same way on an episode, and the key sits behind the info button.
//
// A long show renders thousands of cells, twice, in the page's HTML (see window.ts), so a cell's markup is kept
// short: its look is in short classes that the grid's own style rule defines once. A run of episode numbers that no
// season has is one narrow gap column (layout.ts).
import { InformationCircleIcon } from "@heroicons/react/24/outline"
import type { ReactNode } from "react"
import type {
	EpisodeGrid as EpisodeGridData,
	GridEpisode,
	GridSeason,
	GridSpecial,
} from "~/server/episode-grid.server"
import { HEADER_HEIGHT, stickyHeadersBottom } from "~/ui/details/header-height"
import { type GridColumn, gridLayout } from "~/ui/details/episode-grid/layout"
import {
	EPISODE_GRID_ANCHOR,
	formatCount,
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
	seasonLabel,
	useFloat,
} from "~/ui/details/episode-grid/shared"

type Episode = GridEpisode | GridSpecial
type Orientation = "wide" | "narrow"

const SURFACE = "bg-[#141923]"
// Keep these in step with the rows table's cells: the season label column (min-w-[4.25rem]),
// the tile width (.eg-w), the gap column width (.eg-rw) and the cell spacing (border-spacing-[3px]).
const ROWS_LABEL_REM = 4.25
const ROWS_CELL_REM = 2.5
const ROWS_RUN_REM = 1
const CELL_SPACING_REM = 3 / 16

/** The width the rows table needs to show every column without scrolling. */
const rowsWidthRem = (columns: GridColumn[]) =>
	ROWS_LABEL_REM +
	columns.reduce(
		(width, column) =>
			width + (column.kind === "gap" ? ROWS_RUN_REM : ROWS_CELL_REM),
		0,
	) +
	(columns.length + 2) * CELL_SPACING_REM

const A = `#${EPISODE_GRID_ANCHOR}`
const VIBES = Array.from({ length: 11 }, (_, i) => i * 10)

/**
 * The grid's own style: the cells' look, once for all of them, and the choice of table. Container query conditions
 * cannot read custom properties, so the rows table's width goes into the rule itself.
 */
const gridStyle = (columns: GridColumn[]) =>
	[
		`${A} .eg-t{position:relative;display:block;flex-shrink:0;border-radius:4px;font-weight:600;font-variant-numeric:tabular-nums;color:#fff;outline-offset:1px;transition:filter .15s cubic-bezier(.4,0,.2,1)}`,
		`@media (hover:hover){${A} .eg-t:hover{filter:brightness(1.25)}}`,
		`${A} .eg-t:focus-visible{outline:2px solid #fff}`,
		`${A} .eg-w{height:2rem;width:2.5rem;font-size:12.5px}`,
		`${A} .eg-n{height:1.75rem;width:100%;min-width:2.125rem;font-size:.75rem;line-height:1rem}`,
		`${A} .eg-g{display:block;border-radius:4px;background:rgb(255 255 255/.05)}`,
		`${A} .eg-rw{height:2rem;width:1rem}`,
		`${A} .eg-rn{height:.75rem;width:100%}`,
		`${A} .eg-u{background:rgb(255 255 255/.06)}`,
		...VIBES.map((v) => `${A} .eg-v${v}{background:${vibeTileColor(v)}}`),
		...VIBES.map(
			(v) =>
				`${A} .eg-l${v}{border:1px dashed var(--color-vibe-${v});background:${vibeWash(v)}}`,
		),
		`${A} .eg-r{position:sticky;left:0;z-index:10;background:#141923;padding-right:.25rem;text-align:right;font-size:11px;font-weight:400;font-variant-numeric:tabular-nums;color:var(--color-gray-500,oklch(55.1% .027 264.364))}`,
		`${A} [data-grid-layout="rows"]{display:none}`,
		`@container episode-grid (min-width: ${rowsWidthRem(columns)}rem){`,
		`${A} [data-grid-layout="rows"]{display:block}`,
		`${A} [data-grid-layout="columns"]{display:none}}`,
	].join("")

const TILE: Record<Orientation, string> = {
	wide: "eg-t eg-w",
	narrow: "eg-t eg-n",
}
const GAP: Record<Orientation, string> = {
	wide: "eg-g eg-w",
	narrow: "eg-g eg-n",
}
const RUN: Record<Orientation, string> = {
	wide: "eg-g eg-rw",
	narrow: "eg-g eg-rn",
}

/**
 * The paint class of an episode tile. Well-voted episodes are solid vibe tiles; episodes with few
 * votes are a faint wash of their vibe with a dashed vibe border. The number is white on both.
 */
const tileClass = (episode: Pick<Episode, "score" | "votes" | "unrated">) => {
	if (episode.unrated) return "eg-u"
	const vibe = imdbVibe(episode.score)
	return isLowVotes(episode.votes) ? `eg-l${vibe}` : `eg-v${vibe}`
}

/** The few-votes look for the key, which sits outside the grid's style. */
const lowVoteStyle = (score: number) => {
	const vibe = imdbVibe(score)
	return {
		border: `1px dashed var(--color-vibe-${vibe})`,
		background: vibeWash(vibe),
	}
}

/** The words for a gap column: "Episodes 12 to 10,450". */
const runWords = (column: Extract<GridColumn, { kind: "gap" }>) =>
	`Episodes ${formatCount(column.from)} to ${formatCount(column.to)}`

// The site bar above the sticky title header.
const SITE_BAR_HEIGHT = 64
const headersBottom = () => stickyHeadersBottom(SITE_BAR_HEIGHT)

export default function EpisodeGrid({
	grid,
	notice,
}: {
	grid: EpisodeGridData
	/** A line under the heading: for a part of the grid, what it shows and the way to the rest. */
	notice?: ReactNode
}) {
	const float = useFloat()

	const columns = gridLayout(grid)
	const hasSpecials = grid.specials.length > 0

	// ---- cells ---------------------------------------------------------------------------

	const cell = (
		season: number | null,
		episode: Episode,
		o: Orientation,
		id: string,
	) => (
		<button
			key={id}
			type="button"
			aria-label={episodeLabel(season, episode)}
			{...float.trigger(`ep-${id}`, () => (
				<EpisodeTip season={season} episode={episode} />
			))}
			className={`${TILE[o]} ${tileClass(episode)}${
				float.isOpen(`ep-${id}`) ? " outline-2 outline-white" : ""
			}`}
		>
			{episode.unrated ? "—" : formatScore(episode.score)}
		</button>
	)

	const gap = (number: number, o: Orientation) => (
		<span className={GAP[o]}>
			<span className="sr-only">Episode {number} not rated</span>
		</span>
	)

	const run = (
		column: Extract<GridColumn, { kind: "gap" }>,
		o: Orientation,
	) => (
		<span className={RUN[o]} title={`${runWords(column)}: no ratings`}>
			<span className="sr-only">{runWords(column)}: no ratings</span>
		</span>
	)

	/** A season's cell in a column: its tile, a gap inside the season, or nothing past its end. */
	const seasonCell = (
		season: GridSeason,
		at: Map<number, GridEpisode>,
		column: GridColumn,
		o: Orientation,
	) => {
		if (column.kind === "gap")
			return column.from <= season.maxEpisodeNumber ? run(column, o) : null
		const episode = at.get(column.number)
		if (episode)
			return cell(
				season.number,
				episode,
				o,
				`${season.number}-${column.number}`,
			)
		return column.number >= 1 && column.number <= season.maxEpisodeNumber
			? gap(column.number, o)
			: null
	}

	const byNumber = grid.seasons.map(
		(s) => new Map(s.episodes.map((e) => [e.number, e])),
	)
	const columnKey = (column: GridColumn) =>
		column.kind === "gap" ? `run-${column.from}` : column.number

	// ---- season labels -------------------------------------------------------------------

	const seasonHeader = (season: GridSeason, o: Orientation) => (
		<button
			type="button"
			aria-label={seasonLabel(season, grid.providers)}
			{...float.trigger(`season-${season.number}`, () => (
				<SeasonTip season={season} providers={grid.providers} />
			))}
			className={`flex ${o === "wide" ? "flex-row items-baseline gap-1.5" : "flex-col items-center gap-0.5"} rounded px-1 py-0.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white ${
				float.isOpen(`season-${season.number}`) ? "bg-white/10" : ""
			}`}
		>
			<span className="text-sm font-semibold text-white">
				{season.number < 0 ? "More" : `S${season.number}`}
			</span>
			{season.scores.imdb ? (
				<span className="text-xs font-semibold tabular-nums text-white">
					{formatScore(season.scores.imdb.score)}
				</span>
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
			<caption className="sr-only">
				IMDb rating of every episode, one row per season
			</caption>
			<thead>
				<tr className="text-[11px] text-gray-500">
					<th
						scope="col"
						className={`sticky left-0 z-10 ${SURFACE} min-w-[4.25rem] text-left font-normal`}
					>
						<span className="sr-only">Season</span>
					</th>
					{columns.map((column) =>
						column.kind === "gap" ? (
							<th
								key={columnKey(column)}
								scope="col"
								title={runWords(column)}
								className="font-normal"
							>
								<span aria-hidden="true">⋯</span>
								<span className="sr-only">{runWords(column)}</span>
							</th>
						) : (
							<th
								key={columnKey(column)}
								scope="col"
								className="font-normal tabular-nums"
							>
								<span className="sr-only">Episode </span>
								{column.number}
							</th>
						),
					)}
				</tr>
			</thead>
			<tbody>
				{grid.seasons.map((season, si) => (
					<tr key={season.number}>
						<th
							scope="row"
							className={`sticky left-0 z-10 ${SURFACE} pr-1 text-left font-normal`}
						>
							{seasonHeader(season, "wide")}
						</th>
						{columns.map((column) => (
							<td key={columnKey(column)} className="p-0">
								{seasonCell(season, byNumber[si], column, "wide")}
							</td>
						))}
					</tr>
				))}
				{hasSpecials && (
					<tr>
						<th
							scope="row"
							className={`sticky left-0 z-10 ${SURFACE} pt-2 pr-1 text-left align-top text-sm font-semibold text-gray-400`}
						>
							{specialsLabel("Specials")}
						</th>
						<td colSpan={columns.length} className="pt-2">
							<div className="flex flex-wrap gap-[3px]">
								{grid.specials.map((special, i) =>
									cell(null, special, "wide", `sp-${i}`),
								)}
							</div>
						</td>
					</tr>
				)}
			</tbody>
		</table>
	)

	// ---- narrow: seasons as columns ------------------------------------------------------

	const rows = Math.max(columns.length, grid.specials.length)
	const narrow = (
		<table className="w-full border-separate border-spacing-[3px]">
			<caption className="sr-only">
				IMDb rating of every episode, one column per season
			</caption>
			<thead>
				<tr>
					<th scope="col" className={`sticky left-0 z-10 ${SURFACE} w-7`}>
						<span className="sr-only">Episode</span>
					</th>
					{grid.seasons.map((season) => (
						<th key={season.number} scope="col" className="pb-1 font-normal">
							<span className="flex justify-center">
								{seasonHeader(season, "narrow")}
							</span>
						</th>
					))}
					{hasSpecials && (
						<th
							scope="col"
							className="pb-1 align-top text-sm font-semibold text-gray-400"
						>
							{specialsLabel("Sp")}
						</th>
					)}
				</tr>
			</thead>
			<tbody>
				{Array.from({ length: rows }, (_, i) => {
					const column: GridColumn | undefined = columns[i]
					return (
						<tr key={column ? columnKey(column) : `sp-row-${i}`}>
							<th scope="row" className="eg-r">
								{column?.kind === "gap" ? (
									<span title={runWords(column)}>
										<span aria-hidden="true">⋯</span>
										<span className="sr-only">{runWords(column)}</span>
									</span>
								) : column ? (
									<>
										<span className="sr-only">Episode </span>
										{column.number}
									</>
								) : null}
							</th>
							{grid.seasons.map((season, si) => (
								<td key={season.number} className="p-0">
									{column && seasonCell(season, byNumber[si], column, "narrow")}
								</td>
							))}
							{hasSpecials && (
								<td className="p-0">
									{grid.specials[i] &&
										cell(null, grid.specials[i], "narrow", `sp-${i}`)}
								</td>
							)}
						</tr>
					)
				})}
			</tbody>
		</table>
	)

	// ---- frame ---------------------------------------------------------------------------

	const lowVoteSample = (
		<span
			className="inline-flex h-5 w-7 shrink-0 items-center justify-center rounded-[3px] text-[10px] font-semibold text-white"
			style={lowVoteStyle(8.2)}
		>
			8.2
		</span>
	)

	return (
		<section
			id={EPISODE_GRID_ANCHOR}
			aria-labelledby="episode-grid-title"
			// Scroll clear of the site bar and the sticky title header, which grows on phones and
			// with the discovery bar.
			style={{
				scrollMarginTop: `calc(${HEADER_HEIGHT} + ${SITE_BAR_HEIGHT + 16}px)`,
			}}
		>
			<div className="flex items-center justify-between gap-4">
				<h2
					id="episode-grid-title"
					tabIndex={-1}
					className="text-2xl font-bold focus:outline-none"
				>
					Episode ratings
				</h2>
				<button
					type="button"
					aria-label="How to read the episode grid"
					{...float.trigger("legend", () => (
						<LegendContent lowVoteSample={lowVoteSample}>
							{hasSpecials && (
								<p className="text-gray-400">
									Specials count toward no season.
								</p>
							)}
							<p className="text-gray-400">
								Season scores: IMDb episodes, vote-weighted. Open a season for
								every site.
							</p>
						</LegendContent>
					))}
					className="rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
				>
					<InformationCircleIcon className="h-5 w-5" />
				</button>
			</div>
			{grid.note && <p className="mt-2 text-sm text-gray-400">{grid.note}</p>}
			{notice}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: fixed rules built from numbers */}
			<style dangerouslySetInnerHTML={{ __html: gridStyle(columns) }} />
			<div
				className={`@container/episode-grid mt-4 rounded-2xl border border-white/[0.06] ${SURFACE} p-2 sm:p-3`}
			>
				<div
					data-grid-layout="rows"
					className="overflow-x-auto overscroll-x-contain"
				>
					{wide}
				</div>
				<div
					data-grid-layout="columns"
					className="overflow-x-auto overscroll-x-contain"
				>
					{narrow}
				</div>
			</div>
			<FloatLayer state={float.state} topInset={headersBottom} />
		</section>
	)
}
