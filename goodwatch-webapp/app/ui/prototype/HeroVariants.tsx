// PROTOTYPE - throwaway. Round 8: round 7's hero 1 on desktop. Phones get
// their own calmer layout: one surface, no nested bars, logo-only streaming
// tiles in one row, and Rate next to the short-labeled actions.
// Round 7's heroes are in 3ff58f2c. `?owned=1` marks the first service as yours.

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
	"1": "Glass bars, calm mobile",
} as const
export type HeroVariant = keyof typeof HERO_VARIANTS

interface HeroProps {
	media: Media
	country: string
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (s: Section) => void
}

const GLASS = "rounded-xl border border-white/10 bg-black/55 backdrop-blur-md"

function DesktopHero({ media, country, navigateToSection }: Omit<HeroProps, "sectionProps">) {
	return (
		<div className="hidden md:grid gap-4 md:grid-cols-[auto_1fr] md:h-[28.5rem] md:grid-rows-[minmax(0,1fr)] [&>*]:min-w-0">
			<PosterTrailer media={media} className="md:w-[19rem] md:h-full aspect-[2/3]" />
			<div className="relative flex min-h-0 flex-col rounded-xl border border-white/10">
				<div className="absolute inset-0 overflow-hidden rounded-xl" aria-hidden="true">
					<img src={backdropUrl(media)} alt="" className="h-full w-full object-cover object-[center_25%]" />
					<div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
				</div>
				<div className={`relative z-30 m-3 flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 ${GLASS}`}>
					<ScoreRing media={media} size={56} />
					<RatingChips media={media} tone="brand" size="md" />
					<RateButton media={media} look="outline" className="ml-auto" />
				</div>
				<div className="min-h-16 grow" aria-hidden="true" />
				<div className={`relative m-3 mt-0 flex flex-col gap-4 p-4 ${GLASS}`}>
					<StreamingTiles media={media} country={country} navigateToSection={navigateToSection} rows={2} named />
					<Actions media={media} style="block" />
				</div>
			</div>
		</div>
	)
}

// Phones: the backdrop is a short banner that fades into one dark surface.
function MobileHero({ media, country, navigateToSection }: Omit<HeroProps, "sectionProps">) {
	return (
		<div className="md:hidden relative overflow-hidden rounded-2xl border border-white/10 bg-stone-950/80">
			<div className="absolute inset-x-0 top-0 h-40" aria-hidden="true">
				<img src={backdropUrl(media)} alt="" className="h-full w-full object-cover object-[center_25%] opacity-60" />
				<div className="absolute inset-0 bg-gradient-to-b from-transparent to-stone-950" />
			</div>
			<div className="relative flex flex-col gap-5 p-4">
				<div className="flex items-end gap-4 pt-10">
					<PosterTrailer media={media} compact className="w-24 shrink-0 aspect-[2/3]" />
					<div className="flex min-w-0 grow flex-col gap-3 pb-1">
						<ScoreRing media={media} size={48} />
						<RatingChips media={media} tone="brand" />
					</div>
				</div>
				<StreamingTiles media={media} country={country} navigateToSection={navigateToSection} rows={1} />
				<div className="flex gap-2">
					<RateButton media={media} look="icon" className="flex-1 min-w-0" />
					<Actions media={media} style="compact" className="flex-[3] min-w-0 gap-2" />
				</div>
			</div>
		</div>
	)
}

export function HeroSection({ variant, media, country, sectionProps, navigateToSection }: HeroProps & { variant: HeroVariant }) {
	if (variant !== "1") return null
	return (
		<div className="relative max-w-7xl mx-auto mt-4 mb-10 px-4 sm:px-6 lg:px-8">
			<div {...sectionProps.overview}>
				<DesktopHero media={media} country={country} navigateToSection={navigateToSection} />
				<MobileHero media={media} country={country} navigateToSection={navigateToSection} />
			</div>
		</div>
	)
}
