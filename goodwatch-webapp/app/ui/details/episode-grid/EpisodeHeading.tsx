import { EpisodeViewToggle } from "./episode-view"
import { FOCUS } from "./presentation"

/** The skeleton and the interactive overview reserve the same controls, including a future Next episode. */
export default function EpisodeHeading({
	showId = 0,
	next,
	onNext,
	loading,
	onRetry,
}: {
	/** The show whose view the switch sets; the switch sits in the section header from sm up (episode-view.tsx). */
	showId?: number
	next?: { label: string; title?: string }
	onNext?: () => void
	loading?: "loading" | "failed" | "changed"
	onRetry?: () => void
}) {
	return (
		// From sm up the switch is in the section header, so a row with nothing else in it goes.
		<div
			className={`flex flex-wrap items-center gap-2 ${!next && !loading ? "sm:hidden" : ""}`}
		>
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
			<EpisodeViewToggle
				showId={showId}
				loading={Boolean(loading)}
				className="flex sm:hidden"
			/>
		</div>
	)
}
