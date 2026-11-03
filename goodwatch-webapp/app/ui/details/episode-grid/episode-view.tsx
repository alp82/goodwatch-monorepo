// Which view the episodes section shows, Grid or Consistency, shared by the switch in the section header (sm and up)
// and the one above the grid on a phone. One show at a time: another show starts on the grid again.
import { useSyncExternalStore } from "react"
import { FOCUS } from "./presentation"

let state: { showId: number; chart: boolean } = { showId: 0, chart: false }
const listeners = new Set<() => void>()

export function setEpisodeChart(showId: number, chart: boolean) {
	state = { showId, chart }
	for (const listener of listeners) listener()
}

/** Whether the show's episodes are drawn as the Consistency chart. */
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

/** The Grid / Consistency switch. */
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
			className={`items-center gap-1 ${className}`}
		>
			{[false, true].map((on) => (
				<button
					key={String(on)}
					type="button"
					// biome-ignore lint/a11y/useSemanticElements: a two-button switch styled as pills
					role="radio"
					aria-checked={chart === on}
					disabled={loading}
					onClick={() => setEpisodeChart(showId, on)}
					className={`inline-flex h-10 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold lg:h-8 ${FOCUS} ${loading ? "text-transparent bg-white/[0.07] animate-pulse motion-reduce:animate-none" : chart === on ? "bg-white text-gray-900" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}
				>
					{on ? "Consistency" : "Grid"}
				</button>
			))}
		</div>
	)
}
