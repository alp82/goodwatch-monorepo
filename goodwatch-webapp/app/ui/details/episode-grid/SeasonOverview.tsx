// The episodes of a show at a glance, for members and visitors alike: a row per season, every row as tall as the next
// (strip-layout.ts) whatever the season's length, so a 31-season show of 4,292 episodes fits about a screen. A row is
// one button (its label, its strip of squares, its score chip) that opens the season in place, under its row; while
// a season is open the other rows dim. The same rows draw the Spread view (SeasonStrip.tsx), so switching views
// never moves the page. Each row also carries its episodes as text for readers and search engines; the squares
// themselves are a drawing. Before the page knows its width the rows keep their height, with the strips empty.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { episodeCode } from "~/domain/episode-label"
import type { PageEpisode } from "~/domain/tracking/show-page"
import type { Season } from "~/ui/tracking/store"
import { ScoreTile } from "./ScoreTile"
import SeasonStrip from "./SeasonStrip"
import { type GridModel, seasonAverage } from "./grid-model"
import { FOCUS } from "./presentation"
import { formatScore, imdbVibe, vibeTileColor } from "./scale"
import {
	CHIP_W,
	LABEL_W,
	READABLE,
	ROW,
	ROW_CHROME,
	stripCell,
} from "./strip-layout"

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

export const OPEN_ANIMATION =
	"@keyframes gw-season-open{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}.gw-season-open{animation:gw-season-open 220ms cubic-bezier(.2,.8,.2,1)}@media (prefers-reduced-motion:reduce){.gw-season-open{animation:none}}"

/** The element's width, kept current. Zero until the page has laid it out. */
export function useWidth() {
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

/** The square size the overview draws this show at, for a box `width` wide. */
export const overviewCell = (seasons: Season[], width: number) =>
	stripCell(
		Math.max(1, ...seasons.map((s) => s.episodes.length)),
		Math.max(60, width - ROW_CHROME),
	)

/** The season and episode buttons on either side of an open season's title, stepping to the season before or after. */
export function SeasonStep({
	delta,
	onStep,
	disabled,
}: { delta: -1 | 1; onStep: (delta: -1 | 1) => void; disabled?: boolean }) {
	const Icon = delta < 0 ? ChevronLeftIcon : ChevronRightIcon
	return (
		<button
			type="button"
			aria-label={delta < 0 ? "Season before" : "Season after"}
			disabled={disabled}
			onClick={(event) => {
				event.stopPropagation()
				onStep(delta)
			}}
			className={`grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md text-gray-300 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30 ${FOCUS}`}
		>
			<Icon className="h-4 w-4" />
		</button>
	)
}

function Chip({ score }: { score: number | null }) {
	if (score === null) return <span style={{ width: CHIP_W }} />
	const r = Math.round(score * 10) / 10
	return (
		<span
			className="inline-flex h-5 w-8 shrink-0 items-center justify-center rounded-[4px] text-[10.5px] font-bold tabular-nums text-white"
			style={{ background: vibeTileColor(imdbVibe(r)) }}
		>
			{formatScore(r)}
		</span>
	)
}

function HoverCard({ e, x, y }: { e: PageEpisode; x: number; y: number }) {
	return (
		<span
			className="pointer-events-none fixed z-40 flex max-w-72 -translate-x-1/2 -translate-y-full items-center gap-2 rounded-lg bg-gray-950/95 px-2.5 py-1.5 shadow-xl ring-1 ring-white/10"
			style={{ left: x, top: y - 8 }}
		>
			<ScoreTile score={e.rating} className="h-6 min-w-9 text-[12px]" />
			<span className="min-w-0">
				<span className="block text-[11px] font-semibold tabular-nums text-gray-400">
					{episodeCode(e)}
				</span>
				<span className="block truncate text-xs text-gray-100">
					{e.name ?? "Untitled"}
				</span>
			</span>
		</span>
	)
}

export default function SeasonOverview({
	model,
	seasons,
	chart,
	open,
	selected,
	onToggle,
	renderOpen,
	chipScore,
}: {
	model: GridModel
	/** The regular seasons; specials have a row of their own outside the overview. */
	seasons: Season[]
	/** The Spread view. */
	chart: boolean
	open: number | null
	selected: number | null
	onToggle: (season: Season) => void
	/** The open season's panel, under its row. */
	renderOpen: (season: Season) => ReactNode
	/** The chip's score; the season's own score or its episodes' average by default. */
	chipScore?: (season: Season) => number | null
}) {
	const { ref, width } = useWidth()
	const [hover, setHover] = useState<{
		e: PageEpisode
		x: number
		y: number
	} | null>(null)
	const plot = Math.max(60, width - ROW_CHROME)
	const cell = useMemo(() => overviewCell(seasons, width), [seasons, width])
	const showAvg = useMemo(() => {
		const rated = seasons.flatMap((s) =>
			s.episodes.filter((e) => e.rating !== null),
		)
		return rated.length
			? rated.reduce((a, e) => a + (e.rating ?? 0), 0) / rated.length
			: null
	}, [seasons])
	const score = chipScore ?? ((season: Season) => seasonAverage(model, season))
	return (
		<div ref={ref} className="w-full" data-season-overview>
			<style>{OPEN_ANIMATION}</style>
			{hover && <HoverCard e={hover.e} x={hover.x} y={hover.y} />}
			<div className="flex flex-col gap-1">
				{seasons.map((season) => {
					const isOpen = open === season.number
					const avg = score(season)
					const count = model.count(season)
					const dim = open !== null && !isOpen
					return (
						<div key={season.number}>
							<div data-season-row={season.number}>
								<button
									type="button"
									data-season-press={season.number}
									aria-expanded={isOpen}
									aria-label={`Season ${season.number}${avg !== null ? `, ${formatScore(avg)}` : ""}${model.tracked ? `, ${count.watched} of ${count.aired} watched` : ""}`}
									onClick={() => {
										setHover(null)
										onToggle(season)
									}}
									className={`group flex w-full cursor-pointer items-center gap-1 rounded-lg py-0.5 text-left transition-opacity ${isOpen ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"} ${dim ? "opacity-40 hover:opacity-100" : ""} ${FOCUS}`}
								>
									<span
										className={`shrink-0 pl-1.5 text-[11px] font-bold tabular-nums ${isOpen ? "text-white" : count.done ? "text-green-300" : "text-gray-400 group-hover:text-gray-100"}`}
										style={{ width: LABEL_W }}
									>
										S{season.number}
									</span>
									{width ? (
										<SeasonStrip
											season={season}
											model={model}
											plot={plot}
											cell={cell}
											chart={chart}
											showAvg={showAvg}
											selected={isOpen ? selected : null}
											onHover={(e, x, y) => setHover(e ? { e, x, y } : null)}
										/>
									) : (
										<span className="block flex-1" style={{ height: ROW }} />
									)}
									<span className="flex flex-1 justify-end pr-1">
										<Chip score={avg} />
									</span>
								</button>
								<ol className="sr-only">
									{season.episodes.map((e) => (
										<li key={e.id}>
											{episodeCode(e)} {e.name ?? "Untitled"}
											{e.rating !== null
												? `, ${formatScore(e.rating)}`
												: ", not rated"}
										</li>
									))}
								</ol>
							</div>
							{isOpen && (
								<div className="gw-season-open mb-2 mt-1">
									{renderOpen(season)}
								</div>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}

/** Whether the overview's squares are too small to read, so the open season shows its episodes as tiles first. */
export const needsTiles = (seasons: Season[], width: number) =>
	!width || overviewCell(seasons, width) < READABLE
