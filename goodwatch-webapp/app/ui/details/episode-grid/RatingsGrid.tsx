// The ratings grid of a show page's episode list (#699): a row per season, a tile per episode in its IMDb rating's
// colour with the score inside, the member's watched episodes marked by a white bar at the tile's foot and the
// Next episode ringed. It always fits its box: a season too long for readable tiles wraps onto more lines at a
// round number per line (a phone), and never scrolls sideways. Pressing a season, a tile, or the free space of a
// season's row opens that season under its row.
//
// The same tiles also draw the Consistency view: each season's episodes as dots on one score axis, with the
// season's average and spread and its best and worst episode labelled. Switching between the two moves every tile
// to its dot and back. Only transform and opacity animate (a tile and a dot are two layers that cross-fade), so the
// morph runs on the compositor and never waits for a repaint.
import { CheckIcon } from "@heroicons/react/24/solid"
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { episodeCode as episodeLabel } from "~/domain/episode-label"
import type { PageEpisode } from "~/domain/tracking/show-page"
import {
	formatScore,
	imdbVibe,
	vibeTileColor,
} from "~/ui/details/episode-grid/scale"
import type { Season } from "~/ui/tracking/store"
import { ScoreTile } from "./ScoreTile"
import { FOCUS, seasonShort } from "./presentation"

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

/** Only the watch decorations the shared renderer reads; guests supply an empty history. */
export interface GridModel {
	tracked: boolean
	nextId: number | null
	view: { watched: ReadonlySet<number> }
	aired: (episode: PageEpisode) => boolean
	count: (season: Season) => {
		total: number
		aired: number
		watched: number
		done: boolean
	}
	seasonScore: (season: number) => number | null
}

const LABEL_W = 44
const SCORE_W = 36
const GAP = 3
const TILE_H = 30
const MAX_CELL = 40
const MIN_READABLE = 21
const MIN_WRAP = 28
const ROW_MIN = 40
const HEAD_H = 20
const SURFACE_BG = "#0b0f17"
const EASE = "cubic-bezier(.2,.8,.2,1)"
const DURATION = 450

export interface SeasonStats {
	season: Season
	rated: PageEpisode[]
	avg: number | null
	sd: number
	min: PageEpisode | null
	max: PageEpisode | null
}

export const seasonStats = (season: Season): SeasonStats => {
	const rated = season.episodes.filter((e) => e.rating !== null)
	if (!rated.length)
		return { season, rated, avg: null, sd: 0, min: null, max: null }
	const avg = rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length
	const sd = Math.sqrt(
		rated.reduce((s, e) => s + ((e.rating ?? 0) - avg) ** 2, 0) / rated.length,
	)
	const sorted = [...rated].sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
	return {
		season,
		rated,
		avg,
		sd,
		min: sorted[0],
		max: sorted[sorted.length - 1],
	}
}

function useWidth() {
	const ref = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(0)
	useIsoLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new ResizeObserver(() => setWidth(el.clientWidth))
		observer.observe(el)
		setWidth(el.clientWidth)
		return () => observer.disconnect()
	}, [])
	return { ref, width }
}

function useReducedMotion() {
	const [reduced, setReduced] = useState(false)
	useIsoLayoutEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)")
		const on = () => setReduced(media.matches)
		on()
		media.addEventListener("change", on)
		return () => media.removeEventListener("change", on)
	}, [])
	return reduced
}

interface Layout {
	measured: boolean
	/** Width of the area that holds the tiles and the dots. */
	plotW: number
	cell: number
	readable: boolean
	perLine: number
	wrapped: boolean
	/** Score axis of the chart state. */
	x: (score: number) => number
	ticks: number[]
	showAvg: number | null
}

export default function RatingsGrid({
	model,
	seasons,
	chart,
	selectedSeason,
	selectedEpisode,
	onSeason,
	onEpisode,
	afterRow,
	seasonScores,
}: {
	model: GridModel
	seasons: Season[]
	chart: boolean
	selectedSeason: number | null
	selectedEpisode: number | null
	onSeason: (season: Season) => void
	onEpisode: (episode: PageEpisode) => void
	afterRow: (season: Season) => ReactNode
	seasonScores: boolean
}) {
	const { ref, width } = useWidth()
	const reduced = useReducedMotion()
	const stats = useMemo(() => seasons.map(seasonStats), [seasons])
	const most = Math.max(1, ...seasons.map((s) => s.episodes.length))
	const scoreCol = seasonScores ? SCORE_W + GAP : 0

	const layout = useMemo<Layout>(() => {
		const avail = Math.max(120, width - LABEL_W - scoreCol - GAP)
		const fitCell = Math.min(MAX_CELL, (avail - GAP * (most - 1)) / most)
		const wrapped = fitCell < MIN_READABLE
		const fit = Math.floor((avail + GAP) / (MIN_WRAP + GAP))
		const perLine = wrapped
			? ([12, 10, 8, 6, 5].find((n) => n <= fit) ?? Math.max(1, fit))
			: most
		const cell = wrapped
			? Math.min(MAX_CELL, (avail - GAP * (perLine - 1)) / perLine)
			: fitCell
		// The chart spans the same width as the grid's widest row, so dots stay over where the tiles were.
		const plotW = wrapped
			? avail
			: Math.max(cell * most + GAP * (most - 1), Math.min(avail, 560))
		const scores = stats.flatMap((s) => s.rated.map((e) => e.rating ?? 0))
		const min = scores.length ? Math.min(...scores) : 6
		const max = scores.length ? Math.max(...scores) : 9
		const span = Math.max(2, max - min + 0.2)
		const lo = (min + max) / 2 - span / 2
		const hi = (min + max) / 2 + span / 2
		const pad = width < 520 ? 34 : 52
		const x = (score: number) =>
			pad + ((score - lo) / (hi - lo)) * (plotW - 2 * pad)
		const step = span <= 3 ? 0.5 : 1
		const ticks: number[] = []
		for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step)
			ticks.push(Math.round(t * 10) / 10)
		const all = stats.flatMap((s) => s.rated)
		const showAvg = all.length
			? all.reduce((sum, e) => sum + (e.rating ?? 0), 0) / all.length
			: null
		return {
			measured: width > 0,
			plotW,
			cell,
			readable: cell >= MIN_READABLE,
			perLine,
			wrapped,
			x,
			ticks,
			showAvg,
		}
	}, [width, scoreCol, most, stats])

	// Keyboard: left and right move along a season, up and down to the same episode of the next season.
	const [focusId, setFocusId] = useState<number | null>(null)
	const roving =
		focusId ?? selectedEpisode ?? model.nextId ?? seasons[0]?.episodes[0]?.id
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		let si = seasons.findIndex((s) => s.episodes.some((e) => e.id === roving))
		if (si < 0) return
		let ei = seasons[si].episodes.findIndex((e) => e.id === roving)
		if (event.key === "ArrowLeft") ei -= 1
		else if (event.key === "ArrowRight") ei += 1
		else if (event.key === "ArrowUp") si -= 1
		else if (event.key === "ArrowDown") si += 1
		else if (event.key === "Home") ei = 0
		else if (event.key === "End") ei = seasons[si].episodes.length - 1
		else return
		event.preventDefault()
		si = Math.max(0, Math.min(seasons.length - 1, si))
		ei = Math.max(0, Math.min(seasons[si].episodes.length - 1, ei))
		const to = seasons[si].episodes[ei]
		setFocusId(to.id)
		ref.current
			?.querySelector<HTMLElement>(`[data-morph-cell="${to.id}"]`)
			?.focus()
	}

	const transition = reduced
		? "none"
		: `transform ${DURATION}ms ${EASE}, opacity ${DURATION * 0.6}ms ${EASE}`

	return (
		<div
			ref={ref}
			// biome-ignore lint/a11y/useSemanticElements: a grid of buttons with arrow-key movement, not a data table
			role="grid"
			aria-label="Episodes by season"
			onKeyDown={onKeyDown}
			className="w-full"
			data-morph={chart ? "chart" : "grid"}
			data-measured={layout.measured}
		>
			<style>
				{
					".episode-rating-tile{position:absolute;left:0;top:0;display:flex;align-items:center;justify-content:center;cursor:pointer;font-weight:600;font-variant-numeric:tabular-nums;font-size:11.5px;color:#fff;will-change:transform}.episode-rating-tile:hover{filter:brightness(1.25)}.episode-rating-tile:focus-visible{outline:2px solid white;outline-offset:2px}[data-measured=false] .episode-rating-tile{position:relative;width:100%;height:30px;border-radius:3px}"
				}
			</style>
			<Head
				layout={layout}
				chart={chart}
				most={most}
				numbers={Array.from({ length: most }, (_, i) => {
					const numbers = new Set(
						seasons.flatMap((s) =>
							s.episodes[i] ? [s.episodes[i].number] : [],
						),
					)
					return numbers.size === 1 ? [...numbers][0] : null
				})}
				transition={transition}
			/>
			{/* Wrapped seasons are told apart by space, not by text. */}
			<div className="flex flex-col" style={{ gap: layout.wrapped ? 12 : GAP }}>
				{stats.map((s) => (
					<div key={s.season.number} data-season-row={s.season.number}>
						<SeasonRow
							s={s}
							model={model}
							layout={layout}
							chart={chart}
							most={most}
							selected={selectedSeason === s.season.number}
							selectedEpisode={selectedEpisode}
							roving={roving}
							onFocusCell={setFocusId}
							onSeason={onSeason}
							onEpisode={onEpisode}
							seasonScores={seasonScores}
							transition={transition}
							reduced={reduced}
						/>
						{afterRow(s.season)}
					</div>
				))}
			</div>
		</div>
	)
}

/** The strip above the rows: episode numbers in the grid, the score axis in the chart, cross-fading. */
function Head({
	numbers,
	layout,
	chart,
	most,
	transition,
}: {
	numbers: (number | null)[]
	layout: Layout
	chart: boolean
	most: number
	transition: string
}) {
	const fade = (on: boolean) => ({ opacity: on ? 1 : 0, transition })
	return (
		<div
			className="relative"
			style={{
				height: HEAD_H,
				marginLeft: LABEL_W + GAP,
				width: layout.measured ? layout.plotW : undefined,
				visibility: layout.measured ? undefined : "hidden",
			}}
			aria-hidden
		>
			{!layout.wrapped && layout.plotW >= 420 && (
				<div className="absolute inset-0" style={fade(!chart)}>
					{Array.from({ length: most }, (_, i) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: the episode numbers are the indexes
							key={i}
							className="absolute top-1 text-center text-[10px] tabular-nums text-gray-500"
							style={{ left: i * (layout.cell + GAP), width: layout.cell }}
						>
							{numbers[i]}
						</span>
					))}
				</div>
			)}
			<div className="absolute inset-0" style={fade(chart)}>
				{layout.ticks.map((t) => (
					<span
						key={t}
						className="absolute top-1 -translate-x-1/2 text-[10px] tabular-nums text-gray-500"
						style={{ left: layout.x(t) }}
					>
						{Number.isInteger(t) ? t : formatScore(t)}
					</span>
				))}
				{layout.showAvg !== null && (
					<span
						className="absolute top-0 -translate-x-1/2 rounded bg-white/10 px-1 text-[10px] font-semibold tabular-nums text-gray-300"
						style={{ left: layout.x(layout.showAvg) }}
					>
						avg {formatScore(layout.showAvg)}
					</span>
				)}
			</div>
		</div>
	)
}

function SeasonRow({
	s,
	model,
	layout,
	chart,
	most,
	selected,
	selectedEpisode,
	roving,
	onFocusCell,
	onSeason,
	onEpisode,
	seasonScores,
	transition,
	reduced,
}: {
	s: SeasonStats
	model: GridModel
	layout: Layout
	chart: boolean
	most: number
	selected: boolean
	selectedEpisode: number | null
	roving: number | undefined
	onFocusCell: (id: number) => void
	onSeason: (season: Season) => void
	onEpisode: (episode: PageEpisode) => void
	seasonScores: boolean
	transition: string
	reduced: boolean
}) {
	const { season } = s
	const { cell, readable, perLine, wrapped, x, plotW, showAvg } = layout
	const count = model.count(season)
	const columns = wrapped ? perLine : most
	const lines = wrapped ? Math.ceil(season.episodes.length / perLine) : 1
	const gridH = lines * TILE_H + (lines - 1) * GAP
	const rowH = Math.max(gridH, ROW_MIN)
	const gridTop = (rowH - gridH) / 2
	const phone = plotW < 420
	const dot = phone ? 9 : 11
	const mid = rowH / 2

	// Lanes for the chart state: dots that would overlap move up or down, as far as the row's height allows.
	const laneStep = phone ? 6 : 6
	const maxLane = Math.max(1, Math.floor((rowH / 2 - dot / 2 - 2) / laneStep))
	const lanes = useMemo(() => {
		const placed: { x: number; lane: number }[] = []
		const out = new Map<number, number>()
		const order = [...s.rated].sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
		const candidates = [0]
		for (let l = 1; l <= maxLane; l++) candidates.push(-l, l)
		for (const e of order) {
			const ex = x(e.rating ?? 0)
			const near = placed
				.filter((p) => Math.abs(p.x - ex) < dot - 1)
				.map((p) => p.lane)
			const lane = candidates.find((l) => !near.includes(l)) ?? 0
			placed.push({ x: ex, lane })
			out.set(e.id, lane)
		}
		return out
	}, [s.rated, x, dot, maxLane])

	// Labels: the best right of its dot, the worst left, and episodes far from the average above.
	const labels = useMemo(() => {
		if (!s.rated.length || s.avg === null) return []
		const picks = new Map<number, "right" | "left" | "above">()
		if (s.max) picks.set(s.max.id, "right")
		if (s.min && s.min.id !== s.max?.id) picks.set(s.min.id, "left")
		for (const e of s.rated)
			if (!picks.has(e.id) && Math.abs((e.rating ?? 0) - s.avg) > 0.8)
				picks.set(e.id, "above")
		const textW = phone ? 38 : 46
		const boxes: [number, number][] = []
		const out: {
			e: PageEpisode
			side: "right" | "left" | "above"
			left: number
		}[] = []
		for (const [id, side] of picks) {
			const e = s.rated.find((r) => r.id === id)
			if (!e) continue
			const ex = x(e.rating ?? 0)
			let place = side
			let left =
				side === "right"
					? ex + dot / 2 + 4
					: side === "left"
						? ex - dot / 2 - 4 - textW
						: ex - textW / 2
			// No room on its side at the axis's end: the label goes to the other side of the dot.
			if (place === "left" && left < -4) {
				place = "right"
				left = ex + dot / 2 + 4
			} else if (place === "right" && left + textW > plotW + 4) {
				place = "left"
				left = ex - dot / 2 - 4 - textW
			}
			const box: [number, number] = [left, left + textW]
			if (box[0] < -4 || box[1] > plotW + 4) continue
			if (boxes.some(([a, b]) => box[0] < b && box[1] > a)) continue
			boxes.push(box)
			out.push({ e, side: place, left })
		}
		return out
	}, [s, x, dot, phone, plotW])

	const fade = (on: boolean, delay = 0) => ({
		opacity: on ? 1 : 0,
		transition: reduced
			? "none"
			: `opacity ${DURATION * 0.6}ms ${EASE} ${on ? delay : 0}ms`,
	})
	const score = model.seasonScore(season.number) ?? s.avg

	return (
		<div
			className="grid items-start"
			style={{
				gridTemplateColumns: `${LABEL_W}px ${layout.measured ? `${plotW}px` : "minmax(0,1fr)"} ${seasonScores ? `${SCORE_W}px` : ""}`,
				columnGap: GAP,
			}}
		>
			<button
				type="button"
				data-season-press={season.number}
				aria-pressed={selected}
				aria-label={`Season ${season.number}${model.tracked ? `, ${count.watched} of ${count.aired} watched` : ""}`}
				onClick={() => onSeason(season)}
				className={`flex min-w-0 cursor-pointer flex-col rounded-md px-1.5 text-left text-xs font-bold tabular-nums ${lines > 1 ? "justify-start pt-2" : "justify-center"} ${selected ? "bg-white/15 text-white" : count.done ? "text-green-300 hover:bg-white/10" : "text-gray-300 hover:bg-white/10"} ${FOCUS}`}
				style={{ height: rowH }}
			>
				<span className="flex items-center gap-1">
					{seasonShort(season.number)}
					{count.done && <CheckIcon className="h-3 w-3 shrink-0" />}
				</span>
			</button>
			<div
				className="relative"
				style={
					layout.measured
						? { height: rowH, width: plotW }
						: {
								display: "grid",
								gridTemplateColumns: `repeat(auto-fill, minmax(28px, ${MAX_CELL}px))`,
								gap: GAP,
								minHeight: ROW_MIN,
							}
				}
			>
				{/* The row behind the tiles and dots: its free space (the end of a short season, a wrapped season's last
				line, the chart's gaps) opens the season too. */}
				<button
					type="button"
					tabIndex={-1}
					aria-hidden
					data-season-space={season.number}
					onClick={() => onSeason(season)}
					className={`absolute inset-0 cursor-pointer rounded-md ${chart ? "hover:bg-white/[0.04]" : ""} ${selected && chart ? "bg-white/[0.08]" : ""}`}
				/>
				{/* The chart's furniture fades in after the tiles have started to move. */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0"
					style={{
						...fade(chart, 150),
						display: layout.measured ? undefined : "none",
					}}
				>
					{layout.ticks.map((t) => (
						<span
							key={t}
							className="absolute inset-y-1 w-px bg-white/[0.05]"
							style={{ left: x(t) }}
						/>
					))}
					{s.avg !== null && (
						<span
							className="absolute rounded-md bg-white/[0.06]"
							style={{
								left: x(s.avg - s.sd),
								width: Math.max(4, x(s.avg + s.sd) - x(s.avg - s.sd)),
								top: mid - Math.min(14, rowH / 2 - 2),
								height: Math.min(28, rowH - 4),
							}}
						/>
					)}
					{showAvg !== null && (
						<span
							className="absolute inset-y-0 w-0 border-l border-dashed border-white/25"
							style={{ left: x(showAvg) }}
						/>
					)}
					{s.avg !== null && (
						<span
							className="absolute h-6 w-[2px] -translate-x-1/2 rounded-full bg-white/70"
							style={{ left: x(s.avg), top: mid - 12 }}
						/>
					)}
					{labels.map(({ e, side, left }) => (
						<span
							key={e.id}
							className={`absolute whitespace-nowrap text-[10px] font-semibold tabular-nums leading-none text-gray-300 ${side === "right" ? "text-left" : side === "left" ? "text-right" : "text-center"}`}
							style={{
								left,
								width: phone ? 38 : 46,
								top:
									side === "above"
										? mid - dot / 2 - 13
										: mid + (lanes.get(e.id) ?? 0) * laneStep - 5,
							}}
						>
							E{e.number} {formatScore(e.rating ?? 0)}
						</span>
					))}
				</div>
				{season.episodes.map((e, i) => {
					const line = wrapped ? Math.floor(i / perLine) : 0
					const col = wrapped ? i % perLine : i
					const gx = col * (cell + GAP)
					const gy = gridTop + line * (TILE_H + GAP)
					const rated = e.rating !== null
					const watched = model.tracked && model.view.watched.has(e.id)
					const aired = model.aired(e)
					const isNext = model.nextId === e.id
					const sel = selectedEpisode === e.id
					const size = isNext || sel ? dot + 4 : dot
					const lane = lanes.get(e.id) ?? 0
					const cx = rated ? x(e.rating ?? 0) : gx + cell / 2
					const cy = rated ? mid + lane * laneStep : gy + TILE_H / 2
					const sx = size / cell
					const sy = size / TILE_H
					// The chart state: centred on the dot, scaled to its size. Unrated episodes have no place on the axis
					// and fade out where they are.
					const transform = chart
						? `translate(${cx - cell / 2}px, ${cy - TILE_H / 2}px) scale(${sx}, ${sy})`
						: `translate(${gx}px, ${gy}px) scale(1, 1)`
					const colour = rated
						? vibeTileColor(imdbVibe(e.rating ?? 0))
						: "rgb(255 255 255 / 0.12)"
					const ringPx = isNext || sel ? 2 : 0
					const ringColour = sel ? "#38bdf8" : "#ffffff"
					// The ring keeps 2 screen pixels in both states: its spread is divided by the scale.
					const ring = ringPx
						? `0 0 0 ${chart ? ringPx / Math.min(sx, sy) : ringPx}px ${ringColour}`
						: "0 0 0 0 transparent"
					const label = `${episodeLabel(e)} · ${e.name ?? "Untitled"}${rated ? ` · ${formatScore(e.rating ?? 0)}` : ""}${watched ? " · watched" : aired ? "" : " · not aired"}`
					const stagger = reduced
						? 0
						: Math.min(160, (chart ? col : most - col) * 7)
					return (
						<button
							key={e.id}
							type="button"
							data-morph-cell={e.id}
							data-watched={watched || undefined}
							data-next={isNext || undefined}
							tabIndex={roving === e.id ? 0 : -1}
							aria-label={label}
							aria-pressed={sel}
							title={label}
							onFocus={() => onFocusCell(e.id)}
							onClick={() => onEpisode(e)}
							className={`episode-rating-tile ${aired ? "" : "border border-dashed border-white/25"}`}
							style={
								layout.measured
									? {
											width: cell,
											fontSize: cell >= 28 ? 11.5 : 10,
											position: layout.measured ? "absolute" : "relative",
											height: TILE_H,
											transform: layout.measured ? transform : undefined,
											transformOrigin: "0 0",
											// No background, radius or shadow change here: a tile and a dot are two layers that cross-fade, so
											// the morph only animates transform and opacity and never waits for a repaint to look right.
											opacity: chart && !rated ? 0 : 1,
											pointerEvents: chart && !rated ? "none" : undefined,
											zIndex: sel ? 3 : isNext ? 2 : 1,
											transition: transition === "none" ? "none" : transition,
											transitionDelay: `${stagger}ms`,
										}
									: { background: aired ? colour : undefined }
							}
						>
							{layout.measured ? (
								<>
									<span
										aria-hidden
										className="absolute inset-0 rounded-[3px]"
										style={{
											background: aired ? colour : undefined,
											boxShadow: chart ? undefined : ring,
											...fade(!chart),
										}}
									/>
									<span
										aria-hidden
										className="absolute inset-0 rounded-[50%]"
										style={{
											background: aired ? colour : undefined,
											boxShadow: chart ? ring : undefined,
											...fade(chart),
										}}
									/>
									{/* The score, gone in the chart: the dot's place on the axis says it. */}
									<span
										className="relative"
										style={fade(
											!chart && (!layout.measured || readable) && rated,
										)}
										aria-hidden
									>
										{rated ? formatScore(e.rating ?? 0) : null}
									</span>
								</>
							) : rated ? (
								formatScore(e.rating ?? 0)
							) : null}
							{/* An unwatched dot is a ring: a hole of the page colour, its border kept at 2 screen pixels. */}
							{model.tracked && !watched && rated && (
								<span
									aria-hidden
									className="absolute rounded-[50%]"
									style={{
										left: 2 / sx,
										right: 2 / sx,
										top: 2 / sy,
										bottom: 2 / sy,
										background: SURFACE_BG,
										...fade(chart),
									}}
								/>
							)}
							{/* Watched in the grid: the white foot bar. In the chart a filled dot says it. */}
							{watched && (
								<span
									aria-hidden
									className="absolute inset-x-[3px] bottom-[2px] h-[3px] rounded-full bg-white"
									style={fade(!chart)}
								/>
							)}
						</button>
					)
				})}
			</div>
			{seasonScores && (
				<span
					className="flex items-center justify-end"
					style={{ height: rowH }}
				>
					<ScoreTile
						score={score === null ? null : Math.round(score * 10) / 10}
						title={
							score === null ? undefined : `Season score ${formatScore(score)}`
						}
						className="h-5 w-8 text-[10.5px]"
					/>
				</span>
			)}
		</div>
	)
}
