import { Suspense, lazy, useRef, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { useOpenedOnce } from "~/utils/first-use"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { HERO_TIMING } from "~/utils/start-after-paint"
import { HERO_BACKDROP_MAX_WIDTH, HERO_BACKDROP_SIZES, heroBackdropPath } from "~/ui/details/hero/hero-backdrop"
import { type SizeRule, tmdbImageUrl } from "~/utils/tmdb-image"

type Media = MovieResult | ShowResult

/**
 * The hero's file on a phone and on a desktop, for the page's 103 Early Hints response (server/hero-hints.ts): what
 * the srcSet below gives there. Under `sizes`, the usual phone windows (360 to 430 px wide at their pixel ratios, such
 * as 412 at 1.75 or 2.625 and 390 at 3) pick w780; the desktop's banner is 1216 px wide and picks w1280.
 */
export function heroBackdropFiles(path: string) {
	return { phone: tmdbImageUrl(heroBackdropPath(path), "w780"), desktop: tmdbImageUrl(heroBackdropPath(path), "w1280") }
}

export function HeroBackdropImage({ media, className }: { media: Media; className: string }) {
	if (!media.details.backdrop_path) return null
	// The sizes and width rule live in hero-backdrop.ts, which a prefetch also uses to load the same file early.
	// The page's scripts wait for it to paint (HERO_TIMING): it is the first screen's largest content. It asks without
	// credentials, as the 103 Early Hints response preloads it (TMDB answers with the CORS header).
	return <TmdbImage kind="backdrop" path={heroBackdropPath(media.details.backdrop_path)} sizes={HERO_BACKDROP_SIZES} maxWidth={HERO_BACKDROP_MAX_WIDTH} priority="high" className={className} crossOrigin="anonymous" {...HERO_TIMING} />
}

// The opener's poster: 80 to 96 px wide on a phone, 112 px from sm, 144 px from lg (ui/details/TitlePage.tsx).
const HERO_POSTER_SIZES: SizeRule[] = [
	["(min-width: 1024px)", "144px"],
	["(min-width: 640px)", "112px"],
	[null, "96px"],
]

// The poster over the whole screen. Its code loads when a visitor reaches for the poster, or at the latest with
// the press.
const loadPosterFullScreen = () => import("~/ui/details/hero/PosterFullScreen")
const PosterFullScreen = lazy(reloadOnStaleChunk(loadPosterFullScreen))
const preloadPosterFullScreen = () => {
	void loadPosterFullScreen().catch(() => {})
}

/** The poster on the banner. A press opens it over the whole screen; it grows out of this place and returns to it. */
export function HeroPoster({ media, className = "" }: { media: Media; className?: string }) {
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
					kind="poster"
					lang={media.details.presentation?.title.language ?? "en"}
					path={media.details.poster_path}
					sizes={HERO_POSTER_SIZES}
					maxWidth={144}
					alt={`Poster for ${media.details.title}`}
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
