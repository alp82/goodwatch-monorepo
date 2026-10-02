import {
	Dialog,
	DialogBackdrop,
	DialogPanel,
	DialogTitle,
} from "@headlessui/react"
import { XMarkIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useState } from "react"
import { ImdbExportHowTo } from "./ImdbExportHowTo"

const linkClass =
	"text-indigo-300 underline underline-offset-2 hover:text-indigo-200"

/**
 * A link-styled button that opens the IMDb export explainer in a dialog. The dialog's content only exists
 * while it is open, so the animation starts from the first step each time and never runs in the background.
 */
export function ImdbExportHowToLink({
	className = "",
	children = "See how the export works",
}: {
	className?: string
	children?: ReactNode
}) {
	const [open, setOpen] = useState(false)
	const close = () => setOpen(false)
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={`cursor-pointer ${linkClass} ${className}`}
			>
				{children}
			</button>
			<Dialog open={open} onClose={close} className="relative z-50">
				<DialogBackdrop className="fixed inset-0 bg-black/70" />
				<div className="fixed inset-0 overflow-y-auto">
					<div className="flex min-h-full items-center justify-center p-3 sm:p-4">
						<DialogPanel className="w-full max-w-xl space-y-4 rounded-xl bg-gray-900 p-4 text-gray-100 shadow-2xl ring-1 ring-white/10 sm:p-6">
							<div className="flex items-start justify-between gap-3">
								<DialogTitle className="text-lg font-semibold text-white sm:text-xl">
									How to export your ratings from IMDb
								</DialogTitle>
								<button
									type="button"
									onClick={close}
									aria-label="Close"
									className="-mr-1 -mt-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-white"
								>
									<XMarkIcon className="size-5" aria-hidden="true" />
								</button>
							</div>

							<ImdbExportHowTo />

							<ol className="list-decimal space-y-1.5 border-t border-white/10 pl-5 pt-4 text-sm text-gray-300 marker:font-semibold marker:text-gray-100">
								<li>
									Sign in to IMDb, open{" "}
									<a
										href="https://www.imdb.com/list/ratings"
										target="_blank"
										rel="noopener noreferrer"
										className={linkClass}
									>
										Your ratings
									</a>{" "}
									and click Export.
								</li>
								<li>
									IMDb prepares the file. This takes a few minutes, and you can
									leave the page in the meantime.
								</li>
								<li>
									Open{" "}
									<a
										href="https://www.imdb.com/exports"
										target="_blank"
										rel="noopener noreferrer"
										className={linkClass}
									>
										your exports
									</a>{" "}
									and download the Ratings file once it shows as ready.
								</li>
								<li>Come back to GoodWatch and upload the CSV file.</li>
							</ol>

							<div className="flex justify-end">
								<button
									type="button"
									onClick={close}
									className="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
								>
									Close
								</button>
							</div>
						</DialogPanel>
					</div>
				</div>
			</Dialog>
		</>
	)
}
