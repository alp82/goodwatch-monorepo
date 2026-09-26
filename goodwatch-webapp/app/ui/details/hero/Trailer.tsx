import { Dialog, DialogPanel } from "@headlessui/react"
import { PlayIcon, XMarkIcon } from "@heroicons/react/24/solid"
import type React from "react"
import { useState } from "react"
import ReactPlayer from "react-player/youtube"
import { usePosterImpression } from "~/hooks/usePosterImpression"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

type Media = MovieResult | ShowResult

export const backdropUrl = (media: Media) => `https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces${media.details.backdrop_path}`
export const posterUrl = (media: Media) => `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${media.details.poster_path}`

const trailerKey = (media: Media) => media.videos?.trailers?.[0]?.key

function TrailerDialog({ media, open, onClose }: { media: Media; open: boolean; onClose: () => void }) {
	const key = trailerKey(media)
	if (!key) return null
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
					{open && <ReactPlayer url={`https://www.youtube.com/watch?v=${key}`} width="100%" height="100%" controls config={{ playerVars: { autoplay: 1 } }} />}
				</DialogPanel>
			</div>
		</Dialog>
	)
}

function PlayPill() {
	return (
		<span
			aria-hidden="true"
			className="absolute left-1/2 top-1/2 inline-flex h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 text-sm font-bold text-black shadow-[0_0_0_1px_rgba(0,0,0,.4),0_8px_24px_rgba(0,0,0,.6)] transition-transform group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none md:h-12 md:px-5 md:text-base"
		>
			<span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white">
				<PlayIcon className="h-3.5 w-3.5 translate-x-px" />
			</span>
			Play trailer
		</span>
	)
}

// An image that plays the trailer when clicked. Without a trailer it is a
// plain image.
function TrailerImage({ media, image, className }: { media: Media; image: React.ReactNode; className: string }) {
	const [open, setOpen] = useState(false)
	if (!trailerKey(media)) return <div className={`relative ${className}`}>{image}</div>
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label={`Play trailer for ${media.details.title}`}
				className={`group relative block cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 ${className}`}
			>
				{image}
				<span aria-hidden="true" className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/30 motion-reduce:transition-none" />
				<PlayPill />
			</button>
			<TrailerDialog media={media} open={open} onClose={() => setOpen(false)} />
		</>
	)
}

export function PosterTrailer({ media, className = "" }: { media: Media; className?: string }) {
	const impressionRef = usePosterImpression(media.mediaType, media.details.tmdb_id)
	return (
		<TrailerImage
			media={media}
			className={`overflow-hidden rounded-xl shadow-2xl shadow-black/60 ${className}`}
			image={
				<img
					ref={impressionRef}
					src={posterUrl(media)}
					alt={`Poster for ${media.details.title}`}
					className="h-full w-full bg-white/5 object-cover"
					draggable={false}
				/>
			}
		/>
	)
}

// The sharp backdrop, fading out at the bottom into whatever is behind it.
export function BackdropTrailer({ media, className = "" }: { media: Media; className?: string }) {
	return (
		<TrailerImage
			media={media}
			className={`w-full overflow-hidden [mask-image:linear-gradient(to_bottom,black_65%,transparent)] ${className}`}
			image={<img src={backdropUrl(media)} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_25%]" />}
		/>
	)
}
