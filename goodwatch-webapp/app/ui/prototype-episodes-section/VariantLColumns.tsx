// PROTOTYPE - throwaway. Round 3, variant L's phone grid: seasons as columns, every tile wide enough for its
// score. When the show has more seasons than fit, the grid shows a window of them with ‹ and › in the header row
// (a swipe pages too), and a one-line minimap of every season above it shows where the window is.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { displaySeason, episodeLabel } from "~/domain/tracking/machine"
import type { PageEpisode } from "~/domain/tracking/show-page"
import { SITE_BAR_HEIGHT } from "~/ui/details/header-height"
import { formatScore, imdbVibe, vibeTileColor } from "~/ui/details/episode-grid/scale"
import { type Model, type Nav, ScoreTile } from "~/ui/tracking/EpisodeList"
import { FOCUS, type Season } from "~/ui/tracking/store"
import { seasonAverage } from "./MapGrid"

const GAP = 3
const SIDE = 24
const MIN_COL = 30
const MAX_COL = 64

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

const colourOf = (score: number | null) =>
	score === null ? "rgb(255 255 255 / 0.12)" : vibeTileColor(imdbVibe(score))

export default function SeasonColumns({
	model,
	nav,
	seasons,
	onSeason,
	onEpisode,
}: {
	model: Model
	nav: Nav
	seasons: Season[]
	onSeason: (season: Season) => void
	onEpisode: (episode: PageEpisode) => void
}) {
	const { ref, width } = useWidth()
	const room = Math.max(0, width - 2 * SIDE - 2 * GAP)
	const fit = Math.max(1, Math.floor((room + GAP) / (MIN_COL + GAP)))
	const count = Math.min(fit, seasons.length)
	const paged = count < seasons.length
	const col = Math.min(MAX_COL, (room - GAP * (count - 1)) / count)
	const indexOf = (number: number | null | undefined) =>
		number == null ? -1 : seasons.findIndex((s) => s.number === number)

	// The window starts where the Next episode's season is in view.
	const nextSeason = (() => {
		const next = seasons.flatMap((s) => s.episodes).find((e) => e.id === model.nextId)
		return next ? displaySeason(next) : null
	})()
	const [start, setStart] = useState(0)
	const clamp = (i: number) => Math.max(0, Math.min(seasons.length - count, i))
	const show = (i: number) => {
		if (i < 0) return
		setStart((s) => (i < s || i >= s + count ? clamp(i - Math.floor(count / 2)) : clamp(s)))
	}
	// Once the width is known (and whenever the window's size changes), centre the open season, else the Next one's.
	useEffect(() => {
		if (!width) return
		const i = indexOf(nav.open) >= 0 ? indexOf(nav.open) : indexOf(nextSeason)
		setStart(clamp(Math.max(0, i) - Math.floor(count / 2)))
	}, [count, width > 0])
	// A season opened from elsewhere (finder, Next) comes into the window.
	useEffect(() => show(indexOf(nav.open)), [nav.open])

	const visible = seasons.slice(start, start + count)
	const most = Math.max(1, ...visible.map((s) => s.episodes.length))
	const template = `${SIDE}px repeat(${count}, ${col}px) ${SIDE}px`
	const readable = col >= 28

	// A swipe across the grid pages it.
	const touch = useRef<{ x: number; y: number } | null>(null)
	const page = (by: number) => setStart((s) => clamp(s + by * count))

	const pager = (by: number) => {
		const off = by < 0 ? start === 0 : start + count >= seasons.length
		return (
			<button
				type="button"
				aria-label={by < 0 ? "Earlier seasons" : "Later seasons"}
				disabled={off}
				onClick={() => page(by)}
				className={`flex h-full w-full cursor-pointer items-center justify-center rounded-md text-gray-200 hover:bg-white/10 disabled:cursor-default disabled:opacity-20 ${FOCUS}`}
			>
				{by < 0 ? <ChevronLeftIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
			</button>
		)
	}

	const tile = (episode: PageEpisode) => {
		const watched = model.tracked && model.view.watched.has(episode.id)
		const aired = model.aired(episode)
		const isNext = model.nextId === episode.id
		const selected = nav.selected === episode.id
		const label = `${episodeLabel(episode)} · ${episode.name ?? "Untitled"}${episode.rating === null ? "" : ` · ${formatScore(episode.rating)}`}${watched ? " · watched" : aired ? "" : " · not aired"}`
		return (
			<button
				key={episode.id}
				type="button"
				data-map-cell={episode.id}
				aria-label={label}
				aria-pressed={selected}
				title={label}
				onClick={() => onEpisode(episode)}
				className={`relative flex h-7 min-w-0 cursor-pointer items-center justify-center rounded-[3px] font-semibold tabular-nums text-white ${readable ? "text-[11px]" : "text-[0px]"} ${FOCUS} ${aired ? "" : "border border-dashed border-white/25"} ${isNext ? "z-[1] ring-2 ring-white" : ""} ${selected ? "z-[2] ring-2 ring-sky-400" : ""}`}
				style={{ background: aired ? colourOf(episode.rating) : undefined }}
			>
				{episode.rating !== null ? formatScore(episode.rating) : null}
				{watched && (
					<span aria-hidden className="absolute inset-x-[3px] bottom-[2px] h-[3px] rounded-full bg-white" />
				)}
			</button>
		)
	}

	const openIndex = indexOf(nav.open) - start
	const highlight = openIndex >= 0 && openIndex < count

	return (
		<div ref={ref} className="w-full" data-season-columns>
			{paged && (
				<div className="mb-2 flex items-center gap-2">
					<div
						role="group"
						aria-label="All seasons"
						className="relative flex h-5 min-w-0 flex-1"
						style={{ gap: 2 }}
					>
						{seasons.map((s, i) => {
							const c = model.count(s)
							const inWindow = i >= start && i < start + count
							return (
								<button
									key={s.number}
									type="button"
									aria-label={`Season ${s.number}`}
									onClick={() => setStart(clamp(i - Math.floor(count / 2)))}
									className={`relative min-w-0 flex-1 cursor-pointer rounded-[2px] ${FOCUS} ${inWindow ? "" : "opacity-45"}`}
									style={{ background: colourOf(seasonAverage(s)) }}
								>
									{c.aired > 0 && c.watched > 0 && (
										<span
											aria-hidden
											className="absolute bottom-[2px] left-[2px] h-[2px] rounded-full bg-white"
											style={{ width: `calc(${(c.watched / c.aired) * 100}% - 4px)` }}
										/>
									)}
								</button>
							)
						})}
						<span
							aria-hidden
							className="pointer-events-none absolute -inset-y-[3px] rounded-[4px] ring-2 ring-white transition-transform duration-200"
							style={{
								left: 0,
								width: `calc(${(count / seasons.length) * 100}% - 1px)`,
								transform: `translateX(calc(${(start / count) * 100}% + ${(start / count) * 2}px))`,
							}}
						/>
					</div>
					<span className="shrink-0 text-[11px] tabular-nums text-gray-400">
						S{seasons[start]?.number}–{seasons[start + count - 1]?.number} of {seasons.length}
					</span>
				</div>
			)}
			<div
				className="sticky z-10 bg-[#0b0f17] pb-1 pt-1"
				style={{ top: SITE_BAR_HEIGHT }}
			>
				<div className="grid" style={{ gridTemplateColumns: template, gap: GAP }}>
					<div className="row-span-2">{paged && pager(-1)}</div>
					{visible.map((s) => {
						const on = nav.open === s.number
						const c = model.count(s)
						return (
							<button
								key={s.number}
								type="button"
								data-map-season={s.number}
								aria-pressed={on}
								aria-label={`Season ${s.number}${model.tracked ? `, ${c.watched} of ${c.aired} watched` : ""}`}
								onClick={() => onSeason(s)}
								className={`flex h-7 cursor-pointer items-center justify-center rounded-md text-xs font-bold tabular-nums ${on ? "bg-white text-gray-900" : c.done ? "text-green-300 hover:bg-white/10" : "text-gray-200 hover:bg-white/10"} ${FOCUS}`}
							>
								S{s.number}
							</button>
						)
					})}
					<div className="row-span-2">{paged && pager(1)}</div>
					{visible.map((s) => {
						const score = model.seasonScore(s.number) ?? seasonAverage(s)
						return (
							<span key={s.number} className="flex justify-center [&>span]:w-full">
								<ScoreTile
									score={score === null ? null : Math.round(score * 10) / 10}
									className="h-5 text-[10.5px]"
								/>
							</span>
						)
					})}
				</div>
			</div>
			<div
				className="relative mt-1"
				onTouchStart={(e) => {
					touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
				}}
				onTouchEnd={(e) => {
					const t = touch.current
					touch.current = null
					if (!t || !paged) return
					const dx = e.changedTouches[0].clientX - t.x
					const dy = e.changedTouches[0].clientY - t.y
					if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) page(dx < 0 ? 1 : -1)
				}}
			>
				{highlight && (
					<span
						aria-hidden
						className="pointer-events-none absolute -inset-y-1 rounded-md bg-white/[0.08]"
						style={{ left: SIDE + GAP + openIndex * (col + GAP) - 2, width: col + 4 }}
					/>
				)}
				<div className="relative grid" style={{ gridTemplateColumns: template, gap: GAP }}>
					{Array.from({ length: most }, (_, i) => (
						<Line key={i}>
							<span className="flex items-center justify-end pr-1 text-[10px] tabular-nums text-gray-500">
								{i + 1}
							</span>
							{visible.map((s) =>
								s.episodes[i] ? tile(s.episodes[i]) : <span key={s.number} />,
							)}
							<span />
						</Line>
					))}
				</div>
			</div>
		</div>
	)
}

function Line({ children }: { children: React.ReactNode }) {
	return <>{children}</>
}
