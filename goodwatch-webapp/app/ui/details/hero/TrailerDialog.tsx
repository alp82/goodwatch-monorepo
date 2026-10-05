// The dialog that plays a title's trailer. Trailer.tsx loads this module when a visitor reaches for the play button.
import { Dialog, DialogPanel } from "@headlessui/react"
import { XMarkIcon } from "@heroicons/react/24/solid"
import { YoutubePlayer } from "~/ui/details/YoutubePlayer"

export default function TrailerDialog({ videoKey, open, onClose }: { videoKey: string; open: boolean; onClose: () => void }) {
	return (
		<Dialog open={open} onClose={onClose} className="relative z-50">
			<div className="fixed inset-0 bg-black/80" aria-hidden="true" />
			<div className="fixed inset-0 flex items-center justify-center p-4">
				<DialogPanel className="relative aspect-video w-full max-w-5xl">
					<button
						type="button"
						onClick={onClose}
						aria-label="Close trailer"
						className="absolute -top-11 right-0 rounded-full bg-white/10 p-2 hover:bg-white/20 cursor-pointer"
					>
						<XMarkIcon className="h-5 w-5" />
					</button>
					{open && <YoutubePlayer videoKey={videoKey} />}
				</DialogPanel>
			</div>
		</Dialog>
	)
}
