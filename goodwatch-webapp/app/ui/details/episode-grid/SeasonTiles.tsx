// An open season's episodes as readable tiles, over its rows, for a show whose overview squares are too small to read:
// each tile its IMDb vibe colour with the score inside, the watched ones with a white foot, Next ringed white and the
// selected one blue. A long season shows its first lines and a tile that says how many more, which shows them all.
import { useState } from "react"
import { episodeCode } from "~/domain/episode-label"
import type { PageEpisode } from "~/domain/tracking/show-page"
import type { Season } from "~/ui/tracking/store"
import { useWidth } from "./SeasonOverview"
import type { GridModel } from "./grid-model"
import { FOCUS } from "./presentation"
import { formatScore, imdbVibe, vibeTileColor } from "./scale"

const GAP = 3
const LINES = 6

function Tile({
	e,
	model,
	width,
	selected,
	onPress,
}: {
	e: PageEpisode
	model: GridModel
	width: number
	selected: boolean
	onPress: () => void
}) {
	const aired = model.aired(e)
	const watched = model.tracked && model.view.watched.has(e.id)
	const isNext = model.nextId === e.id
	return (
		<button
			type="button"
			title={`${episodeCode(e)} · ${e.name ?? "Untitled"}`}
			aria-pressed={selected}
			onClick={onPress}
			className={`relative flex h-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-[11.5px] font-semibold tabular-nums text-white hover:brightness-125 ${aired ? "" : "border border-dashed border-white/25"} ${FOCUS}`}
			style={{
				width,
				background:
					e.rating !== null && aired
						? vibeTileColor(imdbVibe(e.rating))
						: aired
							? "rgb(255 255 255 / 0.08)"
							: undefined,
				boxShadow: selected
					? "0 0 0 2px #38bdf8"
					: isNext
						? "0 0 0 2px #fff"
						: undefined,
			}}
		>
			{width >= 26
				? e.rating !== null
					? formatScore(e.rating)
					: aired
						? "–"
						: null
				: null}
			{watched && (
				<span
					aria-hidden
					className="absolute inset-x-[3px] bottom-[2px] h-[3px] rounded-full bg-white"
				/>
			)}
		</button>
	)
}

export default function SeasonTiles({
	season,
	model,
	selected,
	onPress,
}: {
	season: Season
	model: GridModel
	selected: number | null
	onPress: (e: PageEpisode) => void
}) {
	const { ref, width } = useWidth()
	const [all, setAll] = useState(false)
	const perLine = Math.max(1, Math.floor((width + GAP) / (34 + GAP)))
	const w = Math.min(40, Math.floor((width - GAP * (perLine - 1)) / perLine))
	const cap = perLine * LINES
	const long = !all && season.episodes.length > cap
	const shown = long ? season.episodes.slice(0, cap - 1) : season.episodes
	return (
		<div ref={ref} className="px-3 pb-3 pt-2" data-season-tiles={season.number}>
			{width > 0 && (
				<div className="flex flex-wrap" style={{ gap: GAP }}>
					{shown.map((e) => (
						<Tile
							key={e.id}
							e={e}
							model={model}
							width={w}
							selected={selected === e.id}
							onPress={() => onPress(e)}
						/>
					))}
					{long && (
						<button
							type="button"
							onClick={() => setAll(true)}
							aria-label={`Show all ${season.episodes.length} episodes`}
							className={`grid h-[30px] cursor-pointer place-items-center rounded-[4px] bg-white/[0.06] text-[11px] font-semibold tabular-nums text-gray-300 hover:bg-white/[0.12] ${FOCUS}`}
							style={{ width: w }}
						>
							+{season.episodes.length - shown.length}
						</button>
					)}
				</div>
			)}
		</div>
	)
}
