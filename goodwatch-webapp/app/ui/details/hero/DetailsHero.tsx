import type React from "react"
import { useEffect, useRef, useState } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { SectionIds } from "~/ui/details/sections"
import EpisodeGridLink from "~/ui/details/hero/EpisodeGridLink"
import ListActions from "~/ui/details/hero/ListActions"
import RateButton from "~/ui/details/hero/RateButton"
import RatingChips from "~/ui/details/hero/RatingChips"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { BackdropTrailer, PosterTrailer, backdropUrl } from "~/ui/details/hero/Trailer"
import WhereToWatch from "~/ui/details/hero/WhereToWatch"
import type { Section, SectionProps } from "~/utils/scroll"

type Media = MovieResult | ShowResult

export interface DetailsHeroProps {
	media: Media
	country: string
	/** Whether the page has an episode grid to link to from the ratings row. */
	hasEpisodeGrid?: boolean
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (section: Section) => void
}

// The poster on the left plays the trailer (md and up); beside it one box sits on the blurred
// backdrop: the GoodWatch score with the rate button, the site ratings, where to watch, and the
// list actions, separated by thin lines. Phones get a backdrop banner that plays the trailer on
// top of the same box instead of the poster.
export default function DetailsHero({ media, country, hasEpisodeGrid = false, sectionProps, navigateToSection }: DetailsHeroProps) {
	return (
		<div className="relative mx-auto mb-10 mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
			<div {...sectionProps.overview}>
				<PosterMatchedRow media={media}>
					<div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4">
						<div className="md:hidden">
							<ScoreRing media={media} size={72} label={false} />
						</div>
						<div className="hidden md:block">
							<ScoreRing media={media} size={96} label={false} />
						</div>
						<RateButton media={media} className="min-w-0" />
						<div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 empty:hidden">
							<RatingChips media={media} />
							{hasEpisodeGrid && <EpisodeGridLink className="ml-auto" />}
						</div>
					</div>
					<Divider className="my-6 md:my-7" />
					<WhereToWatch media={media} country={country} navigateToSection={navigateToSection} />
					<div className="min-h-6 grow" />
					<Divider className="mb-6 md:mb-7" />
					<ListActions media={media} />
				</PosterMatchedRow>
			</div>
		</div>
	)
}

function Divider({ className }: { className: string }) {
	return <div aria-hidden="true" className={`h-px bg-white/10 ${className}`} />
}

// The box's content alone sets the row height (with a floor of POSTER_MIN_W * 1.5). The poster is
// absolutely positioned in the first column, so it never feeds back into that height: it is
// min(100%, column width * 1.5) tall at 2:3, so it matches the box unless the column is too
// narrow, and it never crops or stretches.
// A ResizeObserver sets the column width to 2/3 of the box height, clamped to
// [POSTER_MIN_W, min(POSTER_MAX_W, 40% of the row)]. A narrower column means a wider and maybe
// shorter box, and so on, so it re-measures until it settles, or gives up after MAX_CHANGES.
// The server renders a per-breakpoint default close to the settled value, so hydration rarely
// shifts the layout.
const POSTER_MIN_W = 192
const POSTER_MAX_W = 352
const POSTER_MAX_SHARE = 0.4
// Width changes allowed in one burst before it stops, in case the two sizes keep flipping.
const MAX_CHANGES = 6

function PosterMatchedRow({ media, children }: { media: Media; children: React.ReactNode }) {
	const rowRef = useRef<HTMLDivElement>(null)
	const boxRef = useRef<HTMLDivElement>(null)
	const [posterW, setPosterW] = useState<number | null>(null)
	useEffect(() => {
		const row = rowRef.current
		const box = boxRef.current
		if (!row || !box) return
		let current = -1
		let changes = 0
		let settle: ReturnType<typeof setTimeout> | undefined
		const measure = () => {
			if (!window.matchMedia("(min-width: 768px)").matches) return
			const max = Math.min(POSTER_MAX_W, Math.floor(row.clientWidth * POSTER_MAX_SHARE))
			const next = Math.round(Math.min(max, Math.max(POSTER_MIN_W, (box.offsetHeight * 2) / 3)))
			if (next === current || changes >= MAX_CHANGES) return
			current = next
			changes += 1
			setPosterW(next)
			// A quiet second ends the burst, so later changes (a rating, a resize) adjust again.
			clearTimeout(settle)
			settle = setTimeout(() => {
				changes = 0
			}, 1000)
		}
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(row)
		observer.observe(box)
		return () => {
			observer.disconnect()
			clearTimeout(settle)
		}
	}, [])
	const style = posterW == null ? undefined : ({ "--poster-w": `${posterW}px` } as React.CSSProperties)
	return (
		<div
			ref={rowRef}
			style={style}
			className="grid gap-4 md:min-h-[18rem] md:grid-cols-[var(--poster-w)_minmax(0,1fr)] md:[--poster-w:21rem] lg:[--poster-w:20.5rem] [&>*]:min-w-0"
		>
			<div className="relative hidden md:block">
				<div className="absolute left-0 top-0 aspect-[2/3] h-[min(100%,var(--poster-w)*1.5)]">
					<PosterTrailer media={media} className="block h-full w-full" />
				</div>
			</div>
			{/* z-30 keeps the rate, country, and all-services popovers above the sections below. */}
			<div ref={boxRef} className="relative isolate z-30 flex min-w-0 flex-col rounded-2xl border border-white/10 bg-stone-950 md:rounded-xl">
				<div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl md:rounded-xl" aria-hidden="true">
					<img src={backdropUrl(media)} alt="" className="h-full w-full scale-110 object-cover object-[center_25%]" />
					<div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
					<div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
				</div>
				<BackdropTrailer media={media} className="h-44 rounded-t-2xl md:hidden" />
				<div className="flex grow flex-col px-4 pb-5 pt-2 md:p-5 lg:p-7">{children}</div>
			</div>
		</div>
	)
}
