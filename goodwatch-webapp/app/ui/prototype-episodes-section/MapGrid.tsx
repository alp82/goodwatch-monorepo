// PROTOTYPE - throwaway (episodes section, round 2). One grid that is both the ratings overview and the
// navigator: today's IMDb tiles, with the member's watched marks laid on top, and every tile and season label
// pressable. It always fits its box: tiles shrink to the width (up to 40 px) and keep their score while there is
// room for it, so a season never scrolls sideways. "auto" picks seasons as rows when tiles stay readable that
// way, and seasons as columns otherwise (a phone). The specials are not in the grid; a variant shows them itself.
import { CheckIcon } from "@heroicons/react/24/solid"
import {
	type KeyboardEvent,
	type ReactNode,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { displaySeason, episodeLabel } from "~/domain/tracking/machine"
import type { PageEpisode } from "~/domain/tracking/show-page"
import {
	formatScore,
	imdbVibe,
	vibeTileColor,
} from "~/ui/details/episode-grid/scale"
import { type Model, ScoreTile } from "~/ui/tracking/EpisodeList"
import { FOCUS, type Season, seasonShort } from "~/ui/tracking/store"

export type Lens = "rating" | "standouts"
export type Orientation = "rows" | "columns" | "auto"

export interface MapGridProps {
	model: Model
	/** Regular seasons only; pass `model.seasons.filter(s => s.number !== 0)` or a subset. */
	seasons: Season[]
	orientation?: Orientation
	/** "standouts" fades episodes within 0.4 of their season's average, so the ones that stick out pop. */
	lens?: Lens
	selectedSeason?: number | null
	selectedEpisode?: number | null
	/** Episode ids in a range selection (drawn with a sky outline). */
	marked?: Set<number>
	onSeason?: (season: Season) => void
	onEpisode?: (episode: PageEpisode, event: { shift: boolean }) => void
	/** Rows orientation only: content inserted under a season's row, spanning the grid (an inline panel). */
	afterRow?: (season: Season) => ReactNode
	/** Largest tile width in px. */
	maxCell?: number
	/** Show the season score column at the row's end (rows) or under the label (columns). */
	seasonScores?: boolean
	/**
	 * Rows only: a season too long for readable tiles wraps onto more lines instead of shrinking, at a round number
	 * of tiles per line (12, 10, 8, 6 or 5), so every tile keeps its score.
	 */
	wrap?: boolean
	/** Rows only: seasons drawn as a thin colour strip (fit to the width, no scores), for example the closed ones. */
	compactRow?: (season: Season) => boolean
}

const LABEL_W = 44
const SCORE_W = 36
const GAP = 3
const MIN_READABLE = 21
/** Narrowest tile a wrapped season uses: room for the score at the small size. */
const MIN_WRAP = 28

export const seasonAverage = (season: Season): number | null => {
	const rated = season.episodes.filter((e) => e.rating !== null)
	if (!rated.length) return null
	return rated.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.length
}

function useWidth() {
	const ref = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(0)
	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new ResizeObserver(() => setWidth(el.clientWidth))
		observer.observe(el)
		setWidth(el.clientWidth)
		return () => observer.disconnect()
	}, [])
	return { ref, width }
}

export default function MapGrid({
	model,
	seasons,
	orientation = "auto",
	lens = "rating",
	selectedSeason = null,
	selectedEpisode = null,
	marked,
	onSeason,
	onEpisode,
	afterRow,
	maxCell = 40,
	seasonScores = true,
	wrap = false,
	compactRow,
}: MapGridProps) {
	const { ref, width } = useWidth()
	const most = Math.max(1, ...seasons.map((s) => s.episodes.length))
	const scoreCol = seasonScores ? SCORE_W + GAP : 0
	const rowsCell = Math.min(
		maxCell,
		(width - LABEL_W - scoreCol - GAP * most) / most,
	)
	const columnsCell = Math.min(
		maxCell + 16,
		(width - 28 - GAP * seasons.length) / Math.max(1, seasons.length),
	)
	const shape: "rows" | "columns" =
		orientation === "auto"
			? rowsCell >= 18 || columnsCell < rowsCell
				? "rows"
				: "columns"
			: orientation
	const cellAll = shape === "rows" ? rowsCell : columnsCell
	const readableAll = cellAll >= MIN_READABLE
	const cell = cellAll
	const averages = new Map(seasons.map((s) => [s.number, seasonAverage(s)]))

	// Keyboard: arrows move along the grid in reading order of the orientation, Enter presses.
	const [focusId, setFocusId] = useState<number | null>(null)
	const position = (id: number) => {
		for (let si = 0; si < seasons.length; si++) {
			const ei = seasons[si].episodes.findIndex((e) => e.id === id)
			if (ei >= 0) return { si, ei }
		}
		return null
	}
	const roving =
		focusId ?? selectedEpisode ?? model.nextId ?? seasons[0]?.episodes[0]?.id
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const at = roving == null ? null : position(roving)
		if (!at) return
		let { si, ei } = at
		const across = shape === "rows" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"]
		const down = shape === "rows" ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"]
		if (event.key === across[0]) ei -= 1
		else if (event.key === across[1]) ei += 1
		else if (event.key === down[0]) si -= 1
		else if (event.key === down[1]) si += 1
		else if (event.key === "Home") ei = 0
		else if (event.key === "End") ei = seasons[si].episodes.length - 1
		else return
		event.preventDefault()
		si = Math.max(0, Math.min(seasons.length - 1, si))
		ei = Math.max(0, Math.min(seasons[si].episodes.length - 1, ei))
		const to = seasons[si].episodes[ei]
		setFocusId(to.id)
		ref.current
			?.querySelector<HTMLElement>(`[data-map-cell="${to.id}"]`)
			?.focus()
		onEpisode?.(to, { shift: event.shiftKey })
	}

	const tile = (episode: PageEpisode, readable = readableAll, cell = cellAll, thin = false) => {
		const watched = model.tracked && model.view.watched.has(episode.id)
		const aired = model.aired(episode)
		const isNext = model.nextId === episode.id
		const selected = selectedEpisode === episode.id
		const inRange = marked?.has(episode.id)
		const avg = averages.get(displaySeason(episode)) ?? null
		const faded =
			lens === "standouts" &&
			episode.rating !== null &&
			avg !== null &&
			Math.abs(episode.rating - avg) < 0.4
		const colour =
			episode.rating === null
				? "rgb(255 255 255 / 0.12)"
				: vibeTileColor(imdbVibe(episode.rating))
		const label = `${episodeLabel(episode)} · ${episode.name ?? "Untitled"}${episode.rating === null ? "" : ` · ${formatScore(episode.rating)}`}${watched ? " · watched" : aired ? "" : " · not aired"}`
		return (
			<button
				key={episode.id}
				type="button"
				data-map-cell={episode.id}
				data-watched={watched || undefined}
				data-next={isNext || undefined}
				tabIndex={roving === episode.id ? 0 : -1}
				aria-label={label}
				aria-pressed={selected}
				title={label}
				onFocus={() => setFocusId(episode.id)}
				onClick={(e) => onEpisode?.(episode, { shift: e.shiftKey })}
				className={`relative flex min-w-0 cursor-pointer items-center justify-center rounded-[3px] font-semibold tabular-nums text-white transition-[opacity,transform] duration-150 hover:brightness-125 ${FOCUS} ${!readable ? "text-[0px]" : cell >= 28 ? "text-[11.5px]" : "text-[10px] tracking-tight"} ${aired ? "" : "border border-dashed border-white/25"} ${isNext ? "z-[1] ring-2 ring-white" : ""} ${selected ? "z-[2] scale-110 ring-2 ring-sky-400" : ""} ${inRange ? "z-[1] outline outline-2 outline-sky-300" : ""}`}
				style={{
					background: aired ? colour : undefined,
					height: thin ? 14 : shape === "rows" ? (readable ? 30 : Math.max(16, cell)) : readable ? 26 : 20,
					opacity: faded ? 0.18 : 1,
				}}
			>
				{readable && episode.rating !== null ? formatScore(episode.rating) : null}
				{watched && (
					// Watched: a white bar along the tile's foot, so the rating colour stays readable and a season's
					// watched run reads as one line.
					<span
						aria-hidden
						className={`absolute inset-x-[3px] bottom-[2px] rounded-full bg-white ${readable ? "h-[3px]" : "h-[2px]"}`}
					/>
				)}
			</button>
		)
	}

	const seasonLabel = (season: Season) => {
		const count = model.count(season)
		const on = selectedSeason === season.number
		return (
			<button
				type="button"
				data-map-season={season.number}
				aria-pressed={on}
				aria-label={`Season ${season.number}${model.tracked ? `, ${count.watched} of ${count.aired} watched` : ""}`}
				onClick={() => onSeason?.(season)}
				className={`flex h-full min-w-0 cursor-pointer items-center gap-1 rounded-md ${shape === "columns" ? "justify-center px-0" : "px-1.5"} text-left text-xs font-bold tabular-nums ${on ? "bg-white/15 text-white" : count.done ? "text-green-300 hover:bg-white/10" : "text-gray-300 hover:bg-white/10"} ${FOCUS}`}
			>
				{shape === "columns" && cell < 30 ? season.number : seasonShort(season.number)}
				{count.done && cell >= 30 && <CheckIcon className="h-3 w-3 shrink-0" />}
			</button>
		)
	}

	const seasonScore = (season: Season) => {
		const score = model.seasonScore(season.number) ?? averages.get(season.number) ?? null
		return (
			<ScoreTile
				score={score === null ? null : Math.round(score * 10) / 10}
				title={score === null ? undefined : `Season score ${formatScore(score)}`}
				className="h-5 w-8 text-[10.5px]"
			/>
		)
	}

	if (shape === "columns") {
		return (
			<div
				ref={ref}
				role="grid"
				aria-label="Episodes by season and rating"
				onKeyDown={onKeyDown}
				className="grid w-full"
				style={{
					gridTemplateColumns: `24px repeat(${seasons.length}, minmax(0, ${maxCell + 16}px))`,
					gap: GAP,
				}}
			>
				<span />
				{seasons.map((s) => (
					<div key={s.number} className="flex h-8 flex-col items-stretch">
						{seasonLabel(s)}
					</div>
				))}
				{seasonScores && (
					<>
						<span />
						{seasons.map((s) => (
							<span key={s.number} className="flex justify-center [&>span]:w-full">
								{seasonScore(s)}
							</span>
						))}
					</>
				)}
				{Array.from({ length: most }, (_, i) => (
					<Row key={i} index={i}>
						<span className="flex items-center justify-end pr-1 text-[10px] tabular-nums text-gray-500">
							{i + 1}
						</span>
						{seasons.map((s) =>
							s.episodes[i] ? tile(s.episodes[i]) : <span key={s.number} />,
						)}
					</Row>
				))}
			</div>
		)
	}

	return (
		<div
			ref={ref}
			role="grid"
			aria-label="Episodes by season and rating"
			onKeyDown={onKeyDown}
			className="flex w-full flex-col"
			style={{ gap: GAP }}
		>
			{seasons.map((season) => {
				const thin = compactRow?.(season) ?? false
				const avail = width - LABEL_W - scoreCol - GAP
				const fit = Math.floor((avail + GAP) / (MIN_WRAP + GAP))
				const perLine = [12, 10, 8, 6, 5].find((n) => n <= fit) ?? Math.max(1, fit)
				const wrapped = wrap && !thin && !readableAll && most > perLine
				const columns = wrapped ? perLine : most
				const rowCell = wrapped
					? Math.min(maxCell, (avail - GAP * (perLine - 1)) / perLine)
					: cellAll
				const rowReadable = !thin && rowCell >= MIN_READABLE
				return (
					<div key={season.number} data-map-row={season.number}>
						<div
							className="grid items-start"
							style={{
								// The tiles' column is only as wide as the longest season at full size, so the season score sits right after it.
								gridTemplateColumns: `${LABEL_W}px minmax(0, ${most * (maxCell + GAP)}px) ${seasonScores ? `${SCORE_W}px` : ""}`,
								gap: GAP,
							}}
						>
							<div style={{ height: thin ? 22 : rowReadable ? 30 : Math.max(16, rowCell) }}>
								{seasonLabel(season)}
							</div>
							<div
								className="grid items-center"
								style={{
									gridTemplateColumns: `repeat(${columns}, minmax(0, ${maxCell}px))`,
									gap: GAP,
									paddingTop: thin ? 4 : 0,
								}}
							>
								{(wrapped ? season.episodes : Array.from({ length: most }, (_, i) => season.episodes[i])).map(
									(episode, i) =>
										episode ? tile(episode, rowReadable, rowCell, thin) : <span key={`gap-${i}`} />,
								)}
							</div>
							{seasonScores && (
								<span className="flex h-[30px] items-center justify-end">{seasonScore(season)}</span>
							)}
						</div>
						{afterRow?.(season)}
					</div>
				)
			})}
		</div>
	)
}

/** A row of the columns layout: its children sit straight in the parent grid. */
function Row({ children }: { index: number; children: ReactNode }) {
	return <>{children}</>
}
