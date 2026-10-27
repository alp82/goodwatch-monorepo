import { FOCUS } from "./presentation"

/** The skeleton and the interactive overview reserve the same controls, including a future Next episode. */
export default function EpisodeHeading({
	chart = false,
	onChart,
	next,
	onNext,
	loading,
	onRetry,
}: {
	chart?: boolean
	onChart?: (chart: boolean) => void
	next?: { label: string; title?: string }
	onNext?: () => void
	loading?: "loading" | "failed" | "changed"
	onRetry?: () => void
}) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<h2
				id="episode-list-title"
				tabIndex={-1}
				className="mr-auto text-xl font-bold focus:outline-none lg:text-2xl"
			>
				Episodes
			</h2>
			{loading && loading !== "loading" ? (
				<button
					type="button"
					onClick={onRetry}
					className={`inline-flex h-10 w-32 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-semibold lg:h-8 ${FOCUS}`}
				>
					{loading === "changed" ? "Reload episodes" : "Retry loading"}
				</button>
			) : next ? (
				<button
					type="button"
					data-jump-next
					onClick={onNext}
					title={next.title}
					className={`inline-flex h-10 w-32 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-lg bg-green-500/15 px-2 text-xs font-semibold text-green-300 hover:bg-green-500/25 lg:h-8 ${FOCUS}`}
				>
					Next <span className="truncate tabular-nums">{next.label}</span>
				</button>
			) : (
				<span
					aria-hidden
					className={`inline-block h-10 w-32 shrink-0 rounded-lg lg:h-8 ${loading ? "bg-white/[0.07] animate-pulse motion-reduce:animate-none" : "invisible"}`}
				/>
			)}
			<div
				role="radiogroup"
				aria-label="Show the episodes as"
				data-view-toggle
				className="flex items-center gap-1"
			>
				{[false, true].map((on) => (
					<button
						key={String(on)}
						type="button"
						role="radio"
						aria-checked={chart === on}
						disabled={Boolean(loading)}
						onClick={() => onChart?.(on)}
						className={`inline-flex h-10 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold lg:h-8 ${FOCUS} ${loading ? "text-transparent bg-white/[0.07] animate-pulse motion-reduce:animate-none" : chart === on ? "bg-white text-gray-900" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}
					>
						{on ? "Consistency" : "Grid"}
					</button>
				))}
			</div>
		</div>
	)
}
