// PROTOTYPE - throwaway. Round 6: three close variants of round 5's hero 1.
// The whole poster plays the trailer. The backdrop fills the panel's full
// height: scores sit at the top over the image, Where to watch and the
// actions stay at the bottom on their own darker backing. Named tiles.
// Round 5's heroes are in fe46f1ea. `?owned=1` marks the first service as yours.

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
	"1": "Fade to dark",
	"2": "Frosted lower half",
	"3": "Scores on a glass bar",
} as const
export type HeroVariant = keyof typeof HERO_VARIANTS

interface HeroProps {
	media: Media
	country: string
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (s: Section) => void
}

function Frame({ media, sectionProps, children }: { media: Media; sectionProps: HeroProps["sectionProps"]; children: React.ReactNode }) {
	return (
		<div className="relative max-w-7xl mx-auto mt-4 mb-10 px-4 sm:px-6 lg:px-8">
			<div {...sectionProps.overview} className="grid gap-4 md:grid-cols-[auto_1fr] md:h-[28.5rem] md:grid-rows-[minmax(0,1fr)]">
				<PosterTrailer media={media} className="mx-auto w-48 md:w-[19rem] md:h-full aspect-[2/3]" />
				{children}
			</div>
		</div>
	)
}

// Full-height backdrop behind the whole panel.
function Backdrop({ media, children }: { media: Media; children: React.ReactNode }) {
	return (
		<div className="relative flex min-h-0 flex-col rounded-xl border border-white/10">
			<div className="absolute inset-0 overflow-hidden rounded-xl" aria-hidden="true">
				<img src={backdropUrl(media)} alt="" className="h-full w-full object-cover object-[center_25%]" />
			</div>
			{children}
		</div>
	)
}

function Bottom({ media, country, navigateToSection }: Omit<HeroProps, "sectionProps">) {
	return (
		<>
			<StreamingTiles media={media} country={country} navigateToSection={navigateToSection} rows={2} named />
			<Actions media={media} style="block" />
		</>
	)
}

// 1: one gradient from a light scrim at the top to near-black at the bottom.
function Hero1({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame media={media} sectionProps={sectionProps}>
			<Backdrop media={media}>
				<div
					className="absolute inset-0 rounded-xl"
					aria-hidden="true"
					style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,.15) 22%, rgba(0,0,0,.6) 45%, rgba(0,0,0,.94) 62%)" }}
				/>
				<div className="relative flex h-full flex-col justify-between gap-4 p-5">
					<div className="flex flex-wrap items-center gap-4">
						<ScoreRing media={media} size={60} />
						<RatingChips media={media} tone="brand" size="md" />
						<RateButton media={media} className="ml-auto" />
					</div>
					<div className="flex flex-col gap-4">
						<Bottom media={media} country={country} navigateToSection={navigateToSection} />
					</div>
				</div>
			</Backdrop>
		</Frame>
	)
}

// 2: the image stays clear on top; the lower half is frosted glass.
function Hero2({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame media={media} sectionProps={sectionProps}>
			<Backdrop media={media}>
				<div className="absolute inset-x-0 top-0 h-28 rounded-t-xl bg-gradient-to-b from-black/70 to-transparent" aria-hidden="true" />
				<div className="relative flex flex-wrap items-center gap-4 p-5">
					<ScoreRing media={media} size={64} />
					<RatingChips media={media} tone="brand" size="md" />
					<RateButton media={media} className="ml-auto" />
				</div>
				<div className="relative mt-auto flex flex-col gap-4 rounded-b-xl border-t border-white/10 bg-black/65 p-5 backdrop-blur-xl">
					<Bottom media={media} country={country} navigateToSection={navigateToSection} />
				</div>
			</Backdrop>
		</Frame>
	)
}

// 3: scores sit on their own glass bar; the image shows between bar and bottom.
function Hero3({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame media={media} sectionProps={sectionProps}>
			<Backdrop media={media}>
				<div className="absolute inset-0 rounded-xl bg-gradient-to-b from-transparent via-transparent to-black/95" aria-hidden="true" style={{ backgroundSize: "100% 100%" }} />
				<div className="relative m-3 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur-md">
					<ScoreRing media={media} size={56} />
					<RatingChips media={media} tone="brand" size="md" />
					<RateButton media={media} look="outline" className="ml-auto" />
				</div>
				<div className="relative mt-auto flex flex-col gap-4 p-5 pt-10 bg-gradient-to-b from-transparent to-black/90 rounded-b-xl">
					<Bottom media={media} country={country} navigateToSection={navigateToSection} />
				</div>
			</Backdrop>
		</Frame>
	)
}

export function HeroSection({ variant, ...props }: HeroProps & { variant: HeroVariant }) {
	if (variant === "1") return <Hero1 {...props} />
	if (variant === "2") return <Hero2 {...props} />
	if (variant === "3") return <Hero3 {...props} />
	return null
}
