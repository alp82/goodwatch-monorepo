// PROTOTYPE - throwaway. Round 2, variant I: the consistency chart (the bolder one). Every season is a strip plot on
// a shared score axis: one dot per episode in its rating colour, the season's average as a tick, its spread as a
// faint band, the show's average as a dashed line through all rows. The best and worst episode of every season, and
// any that sit far from their season, carry a short label. A press on a row or a dot opens today's season rows
// inline under it. A Chart / Grid switch shows the round 2 grid in the same place for comparison.
import { CheckIcon } from "@heroicons/react/24/solid"
import {
	type KeyboardEvent,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { episodeLabel } from "~/domain/tracking/machine"
import type { PageEpisode, ShowView } from "~/domain/tracking/show-page"
import {
	formatScore,
	imdbVibe,
	vibeTileColor,
} from "~/ui/details/episode-grid/scale"
import {
	type Model,
	type Nav,
	ScoreTile,
	SeasonPanel,
	Tools,
	useEpisodeKit,
} from "~/ui/tracking/EpisodeList"
import { TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { type TrackingActions, useTrackingActions } from "~/ui/tracking/actions"
import {
	FOCUS,
	type Season,
	type ShowTracking,
	plural,
	seasonShort,
	useShowTracking,
} from "~/ui/tracking/store"
import MapGrid from "./MapGrid"
import type { VariantProps } from "./types"

const CHIP = `inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold cursor-pointer lg:h-8 ${FOCUS}`
const CHIP_ON = "bg-white text-black"
const CHIP_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"

export default function VariantI({ media, gridNode }: VariantProps) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	if (!tracking.ready || !tracking.view) return <>{gridNode}</>
	return <Inner tracking={tracking} view={tracking.view} actions={actions} />
}

interface Stats {
	season: Season
	rated: PageEpisode[]
	avg: number | null
	sd: number
	min: PageEpisode | null
	max: PageEpisode | null
}

const statsOf = (season: Season): Stats => {
	const rated = season.episodes.filter((e) => e.rating !== null)
	if (!rated.length)
		return { season, rated, avg: null, sd: 0, min: null, max: null }
	const avg = rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length
	const sd = Math.sqrt(
		rated.reduce((s, e) => s + ((e.rating ?? 0) - avg) ** 2, 0) / rated.length,
	)
	const sorted = [...rated].sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
	return { season, rated, avg, sd, min: sorted[0], max: sorted[sorted.length - 1] }
}

function Inner({
	tracking,
	view,
	actions,
}: {
	tracking: ShowTracking
	view: ShowView
	actions: TrackingActions
}) {
	const { model, nav } = useEpisodeKit(tracking, view, actions)
	const [mode, setMode] = useState<"chart" | "grid">("chart")
	const regular = model.seasons.filter((s) => s.number > 0)
	const specials = model.seasons.find((s) => s.number === 0) ?? null
	const stats = useMemo(() => regular.map(statsOf), [regular])
	const all = stats.flatMap((s) => s.rated)
	const showAvg = all.length
		? all.reduce((s, e) => s + (e.rating ?? 0), 0) / all.length
		: null
	const sized = stats.filter((s) => s.rated.length >= 3)
	const steadiest = sized.length
		? sized.reduce((a, b) => (b.sd < a.sd ? b : a))
		: null
	const widest = sized.length
		? sized.reduce((a, b) => (b.sd > a.sd ? b : a))
		: null
	const best = sized.length
		? sized.reduce((a, b) => ((b.avg ?? 0) > (a.avg ?? 0) ? b : a))
		: null

	const panel = (season: Season) =>
		nav.open === season.number ? (
			<div className="my-2">
				<SeasonPanel nav={nav} model={model} beside={false} />
			</div>
		) : null

	return (
		<section aria-labelledby="episodes-i-title">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 id="episodes-i-title" className="text-2xl font-bold">
						Episodes
					</h2>
					{showAvg !== null && (
						<p className="mt-1 text-sm text-gray-400">
							Show average{" "}
							<span className="font-semibold text-white">
								{formatScore(showAvg)}
							</span>
							{best && stats.length > 1 && (
								<>
									{" · "}best season{" "}
									<span className="font-semibold text-white">
										{seasonShort(best.season.number)}
									</span>
								</>
							)}
							{steadiest && widest && stats.length > 1 && (
								<>
									{" · "}steadiest{" "}
									<span className="font-semibold text-white">
										{seasonShort(steadiest.season.number)}
									</span>
									{" · "}widest swings{" "}
									<span className="font-semibold text-white">
										{seasonShort(widest.season.number)}
									</span>
								</>
							)}
						</p>
					)}
				</div>
				<div role="radiogroup" aria-label="View" className="flex gap-1">
					{(["chart", "grid"] as const).map((m) => (
						<button
							key={m}
							type="button"
							role="radio"
							aria-checked={mode === m}
							onClick={() => setMode(m)}
							className={`${CHIP} ${mode === m ? CHIP_ON : CHIP_OFF}`}
						>
							{m === "chart" ? "Chart" : "Grid"}
						</button>
					))}
				</div>
			</div>
			<div className="mt-3">
				<Tools nav={nav} model={model} />
			</div>
			<div className="mt-4">
				{mode === "chart" ? (
					<Chart
						stats={stats}
						showAvg={showAvg}
						model={model}
						nav={nav}
						panel={panel}
					/>
				) : (
					<MapGrid
						model={model}
						seasons={regular}
						orientation="rows"
						selectedSeason={nav.open}
						selectedEpisode={nav.selected}
						onSeason={(s) => nav.toggle(s)}
						onEpisode={(e) => nav.goEpisode(e, {}, true)}
						afterRow={panel}
					/>
				)}
				{specials && (
					<div className="mt-2">
						<button
							type="button"
							aria-expanded={nav.open === 0}
							onClick={() => nav.toggle(specials)}
							className={`flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left text-xs text-gray-500 hover:bg-white/[0.05] hover:text-gray-300 ${FOCUS}`}
						>
							<span className="w-9 font-bold text-gray-400">Sp</span>
							{plural(specials.episodes.length, "special")}, not counted
							{model.tracked &&
								` · ${specials.episodes.filter((e) => view.watched.has(e.id)).length} watched`}
						</button>
						{panel(specials)}
					</div>
				)}
				<ChartLegend model={model} chart={mode === "chart"} />
			</div>
			<TrackingToastHost tracking={tracking} actions={actions} />
		</section>
	)
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

const LABEL_W = 52
const SCORE_W = 40
const PHONE_LABEL_W = 38
const PHONE_SCORE_W = 36

function Chart({
	stats,
	showAvg,
	model,
	nav,
	panel,
}: {
	stats: Stats[]
	showAvg: number | null
	model: Model
	nav: Nav
	panel: (season: Season) => React.ReactNode
}) {
	const { ref, width } = useWidth()
	const scores = stats.flatMap((s) => s.rated.map((e) => e.rating ?? 0))
	const phone = width > 0 && width < 520
	// The axis: the show's own range, at least two points wide so a steady show doesn't look wild, with room in
	// pixels at both ends for the labels of the best and worst episodes.
	const min = scores.length ? Math.min(...scores) : 6
	const max = scores.length ? Math.max(...scores) : 9
	const span = Math.max(2, max - min + 0.2)
	const lo = (min + max) / 2 - span / 2
	const hi = (min + max) / 2 + span / 2
	const labelW = phone ? PHONE_LABEL_W : LABEL_W
	const plotW = Math.max(120, width - labelW - (phone ? PHONE_SCORE_W : SCORE_W) - 4)
	const pad = phone ? 40 : 58
	const x = (score: number) => pad + ((score - lo) / (hi - lo)) * (plotW - 2 * pad)
	const step = span <= 3 ? 0.5 : 1
	const ticks: number[] = []
	for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 10) / 10)
	const rowH = phone ? 44 : 44

	// Keyboard: left and right move through a season's episodes in order, up and down through seasons.
	const [focusId, setFocusId] = useState<number | null>(null)
	const roving = focusId ?? nav.selected ?? model.nextId ?? stats[0]?.rated[0]?.id
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		let si = stats.findIndex((s) => s.rated.some((e) => e.id === roving))
		if (si < 0) return
		let ei = stats[si].rated.findIndex((e) => e.id === roving)
		if (event.key === "ArrowLeft") ei -= 1
		else if (event.key === "ArrowRight") ei += 1
		else if (event.key === "ArrowUp") si -= 1
		else if (event.key === "ArrowDown") si += 1
		else return
		event.preventDefault()
		si = Math.max(0, Math.min(stats.length - 1, si))
		if (!stats[si].rated.length) return
		ei = Math.max(0, Math.min(stats[si].rated.length - 1, ei))
		const to = stats[si].rated[ei]
		setFocusId(to.id)
		ref.current?.querySelector<HTMLElement>(`[data-dot="${to.id}"]`)?.focus()
		nav.goEpisode(to, {}, true)
	}

	return (
		<div ref={ref} className="w-full" onKeyDown={onKeyDown}>
			{/* The score axis */}
			<div
				className="relative mb-1 h-5 text-[10px] tabular-nums text-gray-500"
				style={{ marginLeft: labelW, width: plotW }}
				aria-hidden
			>
				{ticks
					.filter((t) => showAvg === null || Math.abs(x(t) - x(showAvg)) > 30)
					.map((t) => (
						<span
							key={t}
							className="absolute -translate-x-1/2"
							style={{ left: x(t) }}
						>
							{t}
						</span>
					))}
				{showAvg !== null && (
					<span
						className="absolute -translate-x-1/2 whitespace-nowrap rounded bg-white/10 px-1 text-gray-300"
						style={{ left: x(showAvg), top: -2 }}
					>
						avg {formatScore(showAvg)}
					</span>
				)}
			</div>
			<div role="list" aria-label="Seasons by episode score">
				{stats.map((s) => (
					<div key={s.season.number} role="listitem" data-chart-season={s.season.number}>
						<StripRow
							s={s}
							model={model}
							nav={nav}
							x={x}
							plotW={plotW}
							ticks={ticks}
							showAvg={showAvg}
							rowH={rowH}
							phone={phone}
							labelW={labelW}
							roving={roving}
							onFocusDot={setFocusId}
						/>
						{panel(s.season)}
					</div>
				))}
			</div>
		</div>
	)
}

function StripRow({
	s,
	model,
	nav,
	x,
	plotW,
	ticks,
	showAvg,
	rowH,
	phone,
	labelW,
	roving,
	onFocusDot,
}: {
	s: Stats
	model: Model
	nav: Nav
	x: (score: number) => number
	plotW: number
	ticks: number[]
	showAvg: number | null
	rowH: number
	phone: boolean
	labelW: number
	roving: number | undefined
	onFocusDot: (id: number) => void
}) {
	const { season } = s
	const count = model.count(season)
	const on = nav.open === season.number
	const score = model.seasonScore(season.number) ?? s.avg
	const dot = phone ? 8 : 10

	// Lanes: a dot that would overlap one already placed moves up or down, so close scores stay visible.
	const lanes = useMemo(() => {
		const placed: { x: number; lane: number }[] = []
		const out = new Map<number, number>()
		const order = [...s.rated].sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
		for (const e of order) {
			const ex = x(e.rating ?? 0)
			const near = placed.filter((p) => Math.abs(p.x - ex) < dot - 1).map((p) => p.lane)
			const lane = [0, -1, 1, -2, 2, -3, 3].find((l) => !near.includes(l)) ?? 0
			placed.push({ x: ex, lane })
			out.set(e.id, lane)
		}
		return out
	}, [s.rated, x, dot])
	const laneStep = phone ? 5 : 6

	// Labels: the season's best and worst, and episodes far from its average. The best goes right of its dot, the
	// worst left; others above. Labels that would overlap one already placed are left out.
	const labels = useMemo(() => {
		if (!s.rated.length || s.avg === null) return []
		const picks = new Map<number, "right" | "left" | "above">()
		if (s.max) picks.set(s.max.id, "right")
		if (s.min && s.min.id !== s.max?.id) picks.set(s.min.id, "left")
		for (const e of s.rated)
			if (!picks.has(e.id) && Math.abs((e.rating ?? 0) - s.avg) > 0.8)
				picks.set(e.id, "above")
		const boxes: [number, number][] = []
		const out: { e: PageEpisode; side: "right" | "left" | "above"; left: number }[] = []
		const textW = phone ? 38 : 46
		for (const [id, side] of picks) {
			const e = s.rated.find((r) => r.id === id)!
			const ex = x(e.rating ?? 0)
			const left =
				side === "right"
					? ex + dot / 2 + 4
					: side === "left"
						? ex - dot / 2 - 4 - textW
						: ex - textW / 2
			const box: [number, number] = [left, left + textW]
			if (box[0] < -4 || box[1] > plotW + 4) continue
			if (side !== "above" && boxes.some(([a, b]) => box[0] < b && box[1] > a)) continue
			boxes.push(box)
			out.push({ e, side, left })
		}
		return out
	}, [s, x, dot, phone, plotW])

	return (
		<div
			className="relative flex items-center"
			style={{ height: rowH }}
			data-strip={season.number}
		>
			{/* The whole row opens the season. */}
			<button
				type="button"
				aria-expanded={on}
				aria-label={`${seasonShort(season.number)}, ${count.watched} of ${count.aired} watched${score === null ? "" : `, season score ${formatScore(score)}`}`}
				onClick={() => nav.toggle(season)}
				className={`absolute inset-0 cursor-pointer rounded-md bg-clip-content py-px ${on ? "bg-white/[0.12]" : "hover:bg-white/[0.05]"} ${FOCUS}`}
			/>
			<span
				className={`pointer-events-none relative flex shrink-0 flex-col justify-center pl-2 text-xs font-bold tabular-nums ${count.done ? "text-green-300" : on ? "text-white" : "text-gray-300"}`}
				style={{ width: labelW }}
			>
				<span className="flex items-center gap-1">
					{seasonShort(season.number)}
					{count.done && <CheckIcon className="h-3 w-3" aria-label="All watched" />}
				</span>
				{model.tracked && !count.done && (
					<span className="text-[10px] font-normal text-gray-500">
						{count.watched}/{count.aired}
					</span>
				)}
			</span>
			<div className="pointer-events-none relative h-full shrink-0" style={{ width: plotW }}>
				{/* Gridlines at whole points */}
				{ticks.map((t) => (
					<span
						key={t}
						aria-hidden
						className="absolute inset-y-1 w-px bg-white/[0.05]"
						style={{ left: x(t) }}
					/>
				))}
				{/* The season's spread: one standard deviation each side of its average */}
				{s.avg !== null && (
					<span
						aria-hidden
						className="absolute top-1/2 h-7 -translate-y-1/2 rounded-md bg-white/[0.06]"
						style={{
							left: x(s.avg - s.sd),
							width: Math.max(4, x(s.avg + s.sd) - x(s.avg - s.sd)),
						}}
					/>
				)}
				{/* The show's average */}
				{showAvg !== null && (
					<span
						aria-hidden
						className="absolute inset-y-0 w-0 border-l border-dashed border-white/25"
						style={{ left: x(showAvg) }}
					/>
				)}
				{/* The season's average */}
				{s.avg !== null && (
					<span
						aria-hidden
						className="absolute top-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70"
						style={{ left: x(s.avg) }}
					/>
				)}
				{s.rated.map((e) => {
					const watched = model.tracked && model.view.watched.has(e.id)
					const isNext = model.nextId === e.id
					const selected = nav.selected === e.id
					const colour = vibeTileColor(imdbVibe(e.rating ?? 0))
					const size = isNext || selected ? dot + 4 : dot
					const lane = lanes.get(e.id) ?? 0
					const label = `${episodeLabel(e)} · ${e.name ?? "Untitled"} · ${formatScore(e.rating ?? 0)}${watched ? " · watched" : ""}`
					return (
						<button
							key={e.id}
							type="button"
							data-dot={e.id}
							tabIndex={roving === e.id ? 0 : -1}
							aria-label={label}
							aria-pressed={selected}
							title={label}
							onFocus={() => onFocusDot(e.id)}
							onClick={(event) => {
								event.stopPropagation()
								nav.goEpisode(e, {}, true)
							}}
							className={`pointer-events-auto absolute z-[1] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full transition-transform duration-150 hover:scale-125 ${FOCUS} ${selected ? "z-[3] ring-2 ring-sky-400 ring-offset-1 ring-offset-[#141923]" : isNext ? "z-[2] ring-2 ring-white ring-offset-1 ring-offset-[#141923]" : ""}`}
							style={{
								left: x(e.rating ?? 0),
								top: `calc(50% + ${lane * laneStep}px)`,
								width: size,
								height: size,
								background: watched ? colour : "#141923",
								border: `2px solid ${colour}`,
							}}
						/>
					)
				})}
				{labels.map(({ e, side, left }) => (
					<span
						key={e.id}
						aria-hidden
						className={`absolute whitespace-nowrap text-[10px] font-semibold tabular-nums leading-none text-gray-300 ${side === "right" ? "text-left" : side === "left" ? "text-right" : "text-center"}`}
						style={{
							left,
							width: phone ? 38 : 46,
							top:
								side === "above"
									? `calc(50% - ${dot / 2 + 13}px)`
									: `calc(50% + ${(lanes.get(e.id) ?? 0) * laneStep - 5}px)`,
						}}
					>
						E{e.number} {formatScore(e.rating ?? 0)}
					</span>
				))}
			</div>
			<span
				className="pointer-events-none relative ml-auto flex shrink-0 justify-end pr-1"
				style={{ width: phone ? PHONE_SCORE_W : SCORE_W }}
			>
				<ScoreTile
					score={score === null ? null : Math.round(score * 10) / 10}
					title={score === null ? undefined : `Season score ${formatScore(score)}`}
					className="h-5 w-8 text-[10.5px]"
				/>
			</span>
		</div>
	)
}

function ChartLegend({ model, chart }: { model: Model; chart: boolean }) {
	const swatch = "inline-block h-2.5 w-2.5 rounded-full"
	return (
		<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500">
			<span>colour: IMDb rating</span>
			{chart ? (
				<>
					{model.tracked && (
						<>
							<span className="inline-flex items-center gap-1">
								<span className={swatch} style={{ background: vibeTileColor(imdbVibe(8.2)) }} />{" "}
								watched
							</span>
							<span className="inline-flex items-center gap-1">
								<span
									className={swatch}
									style={{ border: `2px solid ${vibeTileColor(imdbVibe(8.2))}` }}
								/>{" "}
								not watched
							</span>
						</>
					)}
					{model.nextId !== null && (
						<span className="inline-flex items-center gap-1">
							<span className={`${swatch} ring-2 ring-white`} /> next
						</span>
					)}
					<span className="inline-flex items-center gap-1">
						<span className="inline-block h-3 w-[2px] rounded bg-white/70" /> season average
					</span>
					<span className="inline-flex items-center gap-1">
						<span className="inline-block h-2.5 w-5 rounded-full bg-white/[0.12]" /> typical spread
					</span>
					<span className="inline-flex items-center gap-1">
						<span className="inline-block h-3 w-0 border-l border-dashed border-white/40" /> show
						average
					</span>
				</>
			) : (
				model.tracked && (
					<span className="inline-flex items-center gap-1">
						<span className="inline-block h-[3px] w-3 rounded-full bg-white" /> watched
					</span>
				)
			)}
		</div>
	)
}
