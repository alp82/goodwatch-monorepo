// PROTOTYPE - throwaway. Round 7: round 6's hero 3 with Where to watch on a
// glass bar too. On phones the poster moves into the top bar as a thumbnail
// that still plays the trailer, so the backdrop carries the hero.
// Round 6's heroes are in 70688d27. `?owned=1` marks the first service as yours.

import React from "react"
import type { SectionIds } from "~/ui/details/sections"
import {
	Actions,
	PosterTrailer,
	RateButton,
	RatingChips,
	ScoreRing,
	StreamingTiles,
	backdropUrl,
	type Media,
} from "~/ui/prototype/detail-parts"
import type { Section, SectionProps } from "~/utils/scroll"

export const HERO_VARIANTS = {
	"0": "Current",
	"1": "One glass bar for watching",
	"2": "Separate glass bars",
} as const
export type HeroVariant = keyof typeof HERO_VARIANTS

interface HeroProps {
	media: Media
	country: string
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (s: Section) => void
}

const GLASS = "rounded-xl border border-white/10 bg-black/55 backdrop-blur-md"

function ScoresBar({ media }: { media: Media }) {
	return (
		<div className={`relative z-30 m-3 p-3 md:px-4 ${GLASS}`}>
			<div className="flex gap-3 md:items-center">
				<PosterTrailer media={media} compact className="w-20 shrink-0 self-start aspect-[2/3] md:hidden" />
				<div className="flex min-w-0 grow flex-wrap items-center gap-x-5 gap-y-3">
					<ScoreRing media={media} size={56} />
					<RatingChips media={media} tone="brand" size="md" />
					<RateButton media={media} look="outline" className="w-full md:ml-auto md:w-auto" />
				</div>
			</div>
		</div>
	)
}

function Hero({ media, country, navigateToSection, sectionProps, split }: HeroProps & { split: boolean }) {
	return (
		<div className="relative max-w-7xl mx-auto mt-4 mb-10 px-4 sm:px-6 lg:px-8">
			<div {...sectionProps.overview} className="grid gap-4 md:grid-cols-[auto_1fr] md:h-[28.5rem] md:grid-rows-[minmax(0,1fr)] [&>*]:min-w-0">
				<PosterTrailer media={media} className="hidden md:block md:w-[19rem] md:h-full aspect-[2/3]" />
				<div className="relative flex min-h-0 flex-col rounded-xl border border-white/10">
					<div className="absolute inset-0 overflow-hidden rounded-xl" aria-hidden="true">
						<img src={backdropUrl(media)} alt="" className="h-full w-full object-cover object-[center_25%]" />
						<div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
					</div>
					<ScoresBar media={media} />
					<div className="min-h-6 md:min-h-16 grow" aria-hidden="true" />
					{split ? (
						<div className="relative m-3 mt-0 flex flex-col gap-3">
							<div className={`p-4 ${GLASS}`}>
								<StreamingTiles media={media} country={country} navigateToSection={navigateToSection} rows={2} named />
							</div>
							<div className={`p-3 ${GLASS}`}>
								<Actions media={media} style="block" />
							</div>
						</div>
					) : (
						<div className={`relative m-3 mt-0 flex flex-col gap-4 p-4 ${GLASS}`}>
							<StreamingTiles media={media} country={country} navigateToSection={navigateToSection} rows={2} named />
							<Actions media={media} style="block" />
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export function HeroSection({ variant, ...props }: HeroProps & { variant: HeroVariant }) {
	if (variant === "1") return <Hero {...props} split={false} />
	if (variant === "2") return <Hero {...props} split />
	return null
}
