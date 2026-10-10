import { PlayIcon } from "@heroicons/react/24/solid"
import { Suspense, lazy, useRef, useState } from "react"
import { usePosterImpression } from "~/hooks/usePosterImpression"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { useOpenedOnce } from "~/utils/first-use"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import type { SizeRule } from "~/utils/tmdb-image"

type Media = MovieResult | ShowResult

// The backdrop is the hero's banner, as wide as the page's column, and the page's largest image.
const HERO_BACKDROP_SIZES: SizeRule[] = [
	["(min-width: 1280px)", "1216px"],
	[null, "100vw"],
]

export function HeroBackdropImage({ media, className }: { media: Media; className: string }) {
	if (!media.details.backdrop_path) return null
	// `maxWidth` stays at 780: it names the file that `src` holds, which the render path budget looks for, and every
	// larger step is in the srcSet for the wide banner all the same.
	return <TmdbImage kind="backdrop" path={media.details.backdrop_path} sizes={HERO_BACKDROP_SIZES} maxWidth={780} priority="high" className={className} />
}

// The poster on the banner: 72 px wide on a phone, 128 px from md up.
const HERO_POSTER_SIZES: SizeRule[] = [
	["(min-width: 768px)", "128px"],
	[null, "72px"],
]

const trailerKey = (media: Media) => media.videos?.trailers?.[0]?.key

// The dialog that plays the trailer. Its code, with the dialog library, loads when a visitor reaches for the play
// button (pointer, touch or focus), or at the latest when the dialog opens.
const loadTrailerDialog = () => import("~/ui/details/hero/TrailerDialog")
const TrailerDialog = lazy(reloadOnStaleChunk(loadTrailerDialog))
const preloadTrailerDialog = () => {
	void loadTrailerDialog().catch(() => {})
}

/** The play pill that lies over a still or a clip in the page's media section. */
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

/**
 * The hero's trailer button. It always says what it is: "Trailer" on a phone, "Play trailer" from md up. A title
 * without a trailer has none.
 */
export function TrailerButton({ media, className = "" }: { media: Media; className?: string }) {
	const [open, setOpen] = useState(false)
	const opened = useOpenedOnce(open)
	const key = trailerKey(media)
	if (!key) return null
	return (
		<>
			<button
				type="button"
				data-trailer
				onClick={() => setOpen(true)}
				onPointerEnter={preloadTrailerDialog}
				onTouchStart={preloadTrailerDialog}
				onFocus={preloadTrailerDialog}
				aria-label={`Play trailer for ${media.details.title}`}
				className={`inline-flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-white pl-1.5 pr-3 text-xs font-bold text-black shadow-[0_0_0_1px_rgba(0,0,0,.4),0_8px_24px_rgba(0,0,0,.6)] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 motion-reduce:transition-none md:h-11 md:gap-2 md:pl-2 md:pr-4 md:text-sm ${className}`}
			>
				<span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white md:h-7 md:w-7">
					<PlayIcon className="h-3.5 w-3.5 translate-x-px" />
				</span>
				<span className="md:hidden">Trailer</span>
				<span className="max-md:hidden">Play trailer</span>
			</button>
			{opened && (
				<Suspense fallback={null}>
					<TrailerDialog videoKey={key} open={open} onClose={() => setOpen(false)} />
				</Suspense>
			)}
		</>
	)
}

// The poster over the whole screen. Its code loads when a visitor reaches for the poster, or at the latest with
// the press.
const loadPosterFullScreen = () => import("~/ui/details/hero/PosterFullScreen")
const PosterFullScreen = lazy(reloadOnStaleChunk(loadPosterFullScreen))
const preloadPosterFullScreen = () => {
	void loadPosterFullScreen().catch(() => {})
}

/** The poster on the banner. A press opens it over the whole screen; it grows out of this place and returns to it. */
export function HeroPoster({ media, className = "" }: { media: Media; className?: string }) {
	const impressionRef = usePosterImpression(media.mediaType, media.details.tmdb_id)
	const thumb = useRef<HTMLButtonElement>(null)
	const [open, setOpen] = useState(false)
	const opened = useOpenedOnce(open)
	if (!media.details.poster_path) return null
	return (
		<>
			<button
				ref={thumb}
				type="button"
				data-poster
				aria-haspopup="dialog"
				aria-label={`Poster for ${media.details.title}. Show it full screen`}
				onClick={() => setOpen(true)}
				onPointerEnter={preloadPosterFullScreen}
				onTouchStart={preloadPosterFullScreen}
				onFocus={preloadPosterFullScreen}
				className={`block aspect-[2/3] shrink-0 cursor-zoom-in overflow-hidden rounded-xl bg-white/5 shadow-[0_8px_30px_rgba(0,0,0,.7)] ring-1 ring-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${className}`}
			>
				<TmdbImage
					imgRef={impressionRef}
					kind="poster"
					path={media.details.poster_path}
					sizes={HERO_POSTER_SIZES}
					maxWidth={128}
					alt=""
					className="h-full w-full object-cover"
					draggable={false}
				/>
			</button>
			{opened && (
				<Suspense fallback={null}>
					<PosterFullScreen media={media} open={open} thumb={thumb} onClose={() => setOpen(false)} />
				</Suspense>
			)}
		</>
	)
}
