// After "I watched it": the score control in a dialog, with Rate later, and the toast that names what rose into the
// hero, with Undo.
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CheckIcon } from "@heroicons/react/24/solid"
import type { WatchNext } from "~/server/watch-next.server"
import { TitleScore } from "~/ui/title-actions/TitleScore"
import { UndoToast } from "~/ui/title-actions/UndoToast"
import { posterUrl } from "./style"
import type { Finished } from "./useFinish"

export function FinishPrompt({
	finished,
	onClose,
}: {
	finished: Finished | null
	onClose: (scored: boolean) => void
}) {
	const title = finished?.title
	return (
		<Dialog
			open={!!finished}
			onClose={() => onClose(false)}
			className="relative z-[1100]"
		>
			<div className="fixed inset-0 bg-black/60" aria-hidden />
			<div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
				{title && (
					<DialogPanel className="w-full rounded-t-2xl border border-white/10 bg-stone-900 p-5 text-white shadow-2xl shadow-black/70 sm:w-[26rem] sm:rounded-2xl">
						<div className="flex items-center gap-3">
							<img
								src={posterUrl(title.poster_path, "w154")}
								alt=""
								className="h-20 w-[3.35rem] shrink-0 rounded-md object-cover"
							/>
							<div className="min-w-0">
								<p className="text-xs font-semibold text-green-300">
									<CheckIcon className="mr-1 inline h-3.5 w-3.5" aria-hidden />
									Moved to Seen
								</p>
								<DialogTitle className="truncate text-lg font-bold">
									How was {title.title}?
								</DialogTitle>
								<p className="text-xs text-gray-400">
									Your score sharpens what we suggest next.
								</p>
							</div>
						</div>
						<div className="mt-4">
							<TitleScore
								media={{
									mediaType: title.media_type,
									details: { tmdb_id: title.tmdb_id, title: title.title },
								}}
								size="compact"
								onRated={() => onClose(true)}
								// "I watched it" already recorded the watch; recording it again would move its time.
								recordWatch={false}
							/>
						</div>
						<div className="mt-4 flex justify-end">
							<button
								type="button"
								onClick={() => onClose(false)}
								className="cursor-pointer rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10"
							>
								Rate later
							</button>
						</div>
					</DialogPanel>
				)}
			</div>
		</Dialog>
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
