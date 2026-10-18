// After "I watched it": the score control in a dialog, with Rate later, and the toast that names what rose into the
// hero, with Undo.
import { Suspense, lazy, useMemo } from "react"
import type { WatchNext } from "~/server/watch-next.server"
import { UndoToast } from "~/ui/title-actions/UndoToast"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { Finished } from "./useFinish"

const TitleScoreDialog = lazy(
	reloadOnStaleChunk(() => import("~/ui/scoring/TitleScoreDialog")),
)

// The date line of the dialog, with the date choice behind its "Change": loaded when the dialog first shows it.
const WatchedLine = lazy(
	reloadOnStaleChunk(() => import("~/ui/watch-log/WatchedLine")),
)

export function FinishPrompt({
	finished,
	onClose,
}: {
	finished: Finished | null
	onClose: (scored: boolean) => void
}) {
	const title = finished?.title
	// One promise per "I watched it", so the line doesn't start over when the dialog renders again.
	const watchId = useMemo(
		() => finished?.undo?.then((undo) => undo?.watchId ?? null) ?? null,
		[finished?.undo],
	)
	if (!title) return null
	return (
		<Suspense fallback={null}>
			<TitleScoreDialog
				open
				media={{
					mediaType: title.media_type,
					details: { tmdb_id: title.tmdb_id, title: title.title },
				}}
				onClose={() => onClose(false)}
				onRated={() => onClose(true)}
				aside={<span className="text-xs text-green-300">✓ Seen</span>}
				footer={
					<>
						{title.media_type === "movie" && watchId && (
							<Suspense fallback={null}>
								<WatchedLine movieId={title.tmdb_id} watchId={watchId} />
							</Suspense>
						)}
						<div className="mt-4 flex justify-end">
							<button
								type="button"
								onClick={() => onClose(false)}
								className="cursor-pointer rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10"
							>
								Rate later
							</button>
						</div>
					</>
				}
			/>
		</Suspense>
	)
}

export function FinishToast({
	toast,
	data,
	onUndo,
	onDismiss,
}: {
	toast: Finished | null
	data: WatchNext | null
	onUndo: () => void
	onDismiss: () => void
}) {
	const next =
		data?.hero && data.hero.key !== toast?.title.key ? data.hero : null
	return (
		<UndoToast
			toast={
				toast && {
					id: toast.id,
					text: next
						? `Watch next: ${next.title}`
						: `${toast.title.title} moved to Seen`,
				}
			}
			onUndo={onUndo}
			onDismiss={onDismiss}
			// Phones: above the slab (its buttons and the navigation).
			className="bottom-40 lg:bottom-6"
		/>
	)
}
