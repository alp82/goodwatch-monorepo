// After "I watched it": the existing score prompt (the title page's Rate picker) in a dialog, with Rate later, and the
// toast that names what rose into the hero, with Undo.
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react"
import { CheckIcon } from "@heroicons/react/24/solid"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect } from "react"
import type { WatchNext } from "~/server/watch-next.server"
import { ScorePicker } from "~/ui/details/hero/RateButton"
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
							<ScorePicker
								media={{
									mediaType: title.media_type,
									details: { tmdb_id: title.tmdb_id, title: title.title },
								}}
								onDone={() => onClose(true)}
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

const TOAST_MS = 6000

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
	useEffect(() => {
		if (!toast) return
		const id = setTimeout(onDismiss, TOAST_MS)
		return () => clearTimeout(id)
	}, [toast, onDismiss])
	const next =
		data?.hero && data.hero.key !== toast?.title.key ? data.hero : null
	return (
		<div
			// Phones: above the slab (its buttons and the navigation).
			className="pointer-events-none fixed inset-x-0 bottom-40 z-[1050] flex justify-center px-4 lg:bottom-6"
			aria-live="polite"
		>
			<AnimatePresence>
				{toast && (
					<motion.div
						key={toast.id}
						initial={{ y: 12, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 12, opacity: 0 }}
						className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-stone-900/95 py-2 pl-4 pr-2 text-sm text-white shadow-2xl shadow-black/60 backdrop-blur"
						data-toast
					>
						<span className="min-w-0">
							{next
								? `Watch next: ${next.title}`
								: `${toast.title.title} moved to Seen`}
						</span>
						<button
							type="button"
							onClick={onUndo}
							className="shrink-0 cursor-pointer rounded-full bg-white/10 px-3 py-1 font-semibold text-amber-300 hover:bg-white/20"
						>
							Undo
						</button>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}
