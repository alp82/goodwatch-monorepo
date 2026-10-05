import { PlayIcon } from "@heroicons/react/24/solid"
import type React from "react"
import { Suspense, lazy, useState } from "react"
import { usePosterImpression } from "~/hooks/usePosterImpression"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { useOpenedOnce } from "~/utils/first-use"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { SizeRule } from "~/utils/tmdb-image"

type Media = MovieResult | ShowResult

// The hero shows the backdrop twice with one request: sharp in the phone banner, and blurred and
// darkened behind the box. Both images carry the same sources so the browser picks the same file,
// and that file is the page's largest image. From md up only the blurred one shows, so it
// declares half the box width there.
const HERO_BACKDROP_SIZES: SizeRule[] = [
	["(min-width: 768px)", "390px"],
	[null, "100vw"],
]

export function HeroBackdropImage({ media, className }: { media: Media; className: string }) {
	if (!media.details.backdrop_path) return null
	return <TmdbImage kind="backdrop" path={media.details.backdrop_path} sizes={HERO_BACKDROP_SIZES} maxWidth={780} priority="high" className={className} />
}

// The poster column is 192 to 352 px wide and shows from md up. Lazy, so a phone never requests it.
const HERO_POSTER_SIZES: SizeRule[] = [[null, "340px"]]

const trailerKey = (media: Media) => media.videos?.trailers?.[0]?.key

// The dialog that plays the trailer. Its code, with the dialog library, loads when a visitor reaches for the play
// button (pointer, touch or focus), or at the latest when the dialog opens.
const loadTrailerDialog = () => import("~/ui/details/hero/TrailerDialog")
const TrailerDialog = lazy(reloadOnStaleChunk(loadTrailerDialog))
const preloadTrailerDialog = () => {
	void loadTrailerDialog().catch(() => {})
}

export function PlayPill({ label = "Play trailer" }: { label?: string }) {
	return (
		<span
			aria-hidden="true"
			className="absolute left-1/2 top-1/2 inline-flex h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 text-sm font-bold text-black shadow-[0_0_0_1px_rgba(0,0,0,.4),0_8px_24px_rgba(0,0,0,.6)] transition-transform group-hover:scale-105 group-active:scale-95 motion-reduce:transition-none md:h-12 md:px-5 md:text-base"
		>
			<span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white">
				<PlayIcon className="h-3.5 w-3.5 translate-x-px" />
			</span>
			{label}
		</span>
	)
}

// An image that plays the trailer when clicked. Without a trailer it is a
// plain image.
function TrailerImage({ media, image, className }: { media: Media; image: React.ReactNode; className: string }) {
	const [open, setOpen] = useState(false)
	const opened = useOpenedOnce(open)
	const key = trailerKey(media)
	if (!key) return <div className={`relative ${className}`}>{image}</div>
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				onPointerEnter={preloadTrailerDialog}
				onTouchStart={preloadTrailerDialog}
				onFocus={preloadTrailerDialog}
				aria-label={`Play trailer for ${media.details.title}`}
				className={`group relative block cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 ${className}`}
			>
				{image}
				<span aria-hidden="true" className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/30 motion-reduce:transition-none" />
				<PlayPill />
			</button>
			{opened && (
				<Suspense fallback={null}>
					<TrailerDialog videoKey={key} open={open} onClose={() => setOpen(false)} />
				</Suspense>
			)}
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
				<TmdbImage
					imgRef={impressionRef}
					kind="poster"
					path={media.details.poster_path}
					sizes={HERO_POSTER_SIZES}
					maxWidth={352}
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
			image={<HeroBackdropImage media={media} className="absolute inset-0 h-full w-full object-cover object-[center_25%]" />}
		/>
	)
}
