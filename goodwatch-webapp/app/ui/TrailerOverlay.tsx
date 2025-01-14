import {
	Dialog,
	DialogPanel,
	Transition,
	TransitionChild,
} from "@headlessui/react"
import {
	ArrowLeftIcon,
	PlayCircleIcon,
	XMarkIcon,
} from "@heroicons/react/24/solid"
import React, { Fragment, useState } from "react"
import ReactPlayer from "react-player/youtube"
import type { Videos } from "~/server/details.server"

export interface TrailerOverlayProps {
	videos: Videos
}

export default function TrailerOverlay({ videos }: TrailerOverlayProps) {
	const hasTrailers = videos?.trailers?.length
	const [open, setOpen] = useState(false)

	const handleShowTrailer = () => {
		setOpen(true)
	}

	return (
		<>
			{hasTrailers ? (
				<>
					<button
						type="button"
						className="absolute flex flex-col items-center justify-center w-full h-full bg-black bg-opacity-0 hover:bg-opacity-50 cursor-pointer group"
						onClick={handleShowTrailer}
					>
						<PlayCircleIcon className="relative bottom-4 w-16 h-16 xs:w-20 xs:h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-24 lg:h-24 xl:w-32 xl:h-32 mx-auto opacity-80 transition duration-300 ease-in-out group-hover:scale-125" />
						<p className="absolute bottom-3 py-2 w-full bg-black bg-opacity-80 font-bold text-center text-xs xs:text-sm sm:text-base">
							Play Trailer
						</p>
					</button>
					<Transition show={open} as={Fragment}>
						<Dialog as="div" className="relative z-50" onClose={setOpen}>
							<TransitionChild
								as={Fragment}
								enter="ease-out duration-300"
								enterFrom="opacity-0"
								enterTo="opacity-100"
								leave="ease-in duration-200"
								leaveFrom="opacity-100"
								leaveTo="opacity-0"
							>
								<div className="fixed inset-0 bg-black bg-opacity-70 transition-opacity" />
							</TransitionChild>

							<div className="fixed inset-0 w-screen overflow-y-auto">
								<div className="flex max-h-screen items-center justify-center p-4 text-center">
									<TransitionChild
										as={Fragment}
										enter="ease-out duration-300"
										enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-75"
										enterTo="opacity-100 translate-y-0 sm:scale-100"
										leave="ease-in duration-200"
										leaveFrom="opacity-100 translate-y-0 sm:scale-100"
										leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-75"
									>
										<DialogPanel className="relative w-full h-screen transform overflow-hidden rounded-lg bg-slate-900/50 shadow-xl transition-all">
											<div className="mt-12 mx-4 pb-24 h-full">
												<button
													type="button"
													onClick={() => setOpen(false)}
													className="absolute top-2 left-4 p-2 flex gap-2 rounded  text-white bg-slate-800 hover:bg-slate-700 transition-colors"
												>
													<ArrowLeftIcon className="w-6 h-6" />
													<span>Back to Details</span>
												</button>
												<button
													type="button"
													onClick={() => setOpen(false)}
													className="absolute top-2 right-4 p-2 flex gap-2 rounded  text-white bg-slate-800 hover:bg-slate-700 transition-colors"
												>
													<XMarkIcon className="w-6 h-6" />
												</button>
												<ReactPlayer
													url={`https://www.youtube.com/watch?v=${videos.trailers[0].key}`}
													width="100%"
													height="100%"
													controls={true}
													config={{
														playerVars: {
															autoplay: 1,
														},
													}}
												/>
											</div>
										</DialogPanel>
									</TransitionChild>
								</div>
							</div>
						</Dialog>
					</Transition>
				</>
			) : null}
		</>
	)
}
