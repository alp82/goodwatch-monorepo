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
					<div
						className="
							w-full h-full
							flex items-center justify-center
							group cursor-pointer
							border-2 border-transparent hover:border-gray-800 hover:bg-black/20
							transition-all duration-300 ease-in-out
						"
						onClick={handleShowTrailer}
						onKeyDown={() => {}}
					>
						<button
							type="button"
							className="
							px-6 py-3
							flex flex-row items-center justify-center gap-3
							bg-black/60 rounded-full border-2 border-slate-950
							group-hover:bg-black/90 group-hover:border-slate-900
							focus:outline focus:outline-2 focus:outline-white
							transition-all duration-300 ease-in-out
						"
						>
							<PlayCircleIcon
								className="
									w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12 md:w-14 md:h-14
									opacity-90 group-hover:opacity-100
									transition-all duration-300 ease-in-out
								"
							/>
							<span className="font-bold text-white text-sm xs:text-base sm:text-lg md:text-xl select-none">
								Trailer
							</span>
						</button>
					</div>
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
