// Which view the episodes section shows, Grid or Spread, set by the switch in the section header. One show at a
// time: another show starts on the grid again.
import { useSyncExternalStore } from "react"
import { FOCUS } from "./presentation"

let state: { showId: number; chart: boolean } = { showId: 0, chart: false }
const listeners = new Set<() => void>()

export function setEpisodeChart(showId: number, chart: boolean) {
	state = { showId, chart }
	for (const listener of listeners) listener()
}

/** Whether the show's episodes are drawn as the Spread chart. */
export function useEpisodeChart(showId: number): boolean {
	const chart = useSyncExternalStore(
		(listener) => {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
		() => state.showId === showId && state.chart,
		() => false,
	)
	return chart
}

const GridIcon = () => (
	<svg
		viewBox="0 0 14 14"
		aria-hidden="true"
		className="h-3.5 w-3.5"
		fill="currentColor"
	>
		<rect x="1" y="1" width="5" height="5" rx="1.2" />
		<rect x="8" y="1" width="5" height="5" rx="1.2" />
		<rect x="1" y="8" width="5" height="5" rx="1.2" />
		<rect x="8" y="8" width="5" height="5" rx="1.2" />
	</svg>
)
const SpreadIcon = () => (
	<svg
		viewBox="0 0 14 14"
		aria-hidden="true"
		className="h-3.5 w-3.5"
		fill="currentColor"
	>
		<rect x="0.5" y="6.4" width="13" height="1.2" rx="0.6" opacity="0.45" />
		<circle cx="2.6" cy="7" r="1.6" />
		<circle cx="6.4" cy="4.4" r="1.6" />
		<circle cx="8.6" cy="9.4" r="1.6" />
		<circle cx="11.6" cy="5.6" r="1.6" />
	</svg>
)

/** The Grid / Spread switch: Grid shows every episode as a square, Spread places them on the score axis. */
export function EpisodeViewToggle({
	showId,
	loading = false,
	className = "",
}: {
	showId: number
	loading?: boolean
	className?: string
}) {
	const chart = useEpisodeChart(showId)
	return (
		<div
			role="radiogroup"
			aria-label="Show the episodes as"
			data-view-toggle
			className={`items-center rounded-lg bg-white/[0.05] p-0.5 ring-1 ring-inset ring-white/10 ${className}`}
		>
			{[false, true].map((on) => (
				<button
					key={String(on)}
					type="button"
					// biome-ignore lint/a11y/useSemanticElements: a two-button switch styled as a segmented control
					role="radio"
					aria-checked={chart === on}
					disabled={loading}
					title={
						on ? "Each episode on the score scale" : "Each episode as a square"
					}
					onClick={() => setEpisodeChart(showId, on)}
					className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 sm:px-2.5 text-xs font-semibold transition-colors ${FOCUS} ${chart === on ? "bg-white/[0.14] text-white shadow-sm shadow-black/40" : "text-gray-400 hover:text-gray-100"}`}
				>
					{on ? <SpreadIcon /> : <GridIcon />}
					<span className="sr-only sm:not-sr-only">
						{on ? "Spread" : "Grid"}
					</span>
				</button>
			))}
		</div>
	)
}
