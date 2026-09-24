// PROTOTYPE - throwaway. Round 5: variations on round 4's heroes 4 and 5.
// Streaming shows as rectangular tiles in two reserved rows with a "+N" tile,
// your services get a green check badge, and the trailer button is solid white
// so it reads on any image. Poster and panel share a fixed 28.5rem row on md+.
// Round 4's heroes are in 15a4dc8a. `?owned=1` marks the first service as yours.

import React from "react"
import type { SectionIds } from "~/ui/details/sections"
import {
	Actions,
	RateButton,
	RatingChips,
	ScoreRing,
	StreamingTiles,
	TrailerSolid,
	backdropUrl,
	posterUrl,
	type Media,
} from "~/ui/prototype/detail-parts"
import type { Section, SectionProps } from "~/utils/scroll"

export const HERO_VARIANTS = {
	"0": "Current",
	"1": "Backdrop strip, logo tiles",
	"2": "Backdrop strip, named tiles",
	"3": "Cards, trailer on the poster",
	"4": "Cards, trailer beside Rate",
	"5": "Cards, trailer bar under poster",
} as const
export type HeroVariant = keyof typeof HERO_VARIANTS

interface HeroProps {
	media: Media
	country: string
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (s: Section) => void
}

const ROW = "md:h-[28.5rem] md:grid-rows-[minmax(0,1fr)]"

function Frame({ sectionProps, children }: { sectionProps: HeroProps["sectionProps"]; children: React.ReactNode }) {
	return (
		<div className="relative max-w-7xl mx-auto mt-4 mb-10 px-4 sm:px-6 lg:px-8">
			<div {...sectionProps.overview} className={`grid gap-4 md:grid-cols-[auto_1fr] ${ROW}`}>
				{children}
			</div>
		</div>
	)
}

function PosterImg({ media, className = "" }: { media: Media; className?: string }) {
	return (
		<img
			src={posterUrl(media)}
			alt={`Poster for ${media.details.title}`}
			className={`h-full w-full rounded-xl object-cover shadow-2xl shadow-black/60 bg-white/5 ${className}`}
			draggable={false}
		/>
	)
}

// Poster at the full row height: 19rem wide, 2:3.
function TallPoster({ media, children }: { media: Media; children?: React.ReactNode }) {
	return (
		<div className="relative mx-auto w-48 md:w-[19rem] md:h-full aspect-[2/3]">
			<PosterImg media={media} />
			{children}
		</div>
	)
}

// Backdrop strip across the top of the panel, trailer button on it.
function Strip({ media, className = "", align = "center" }: { media: Media; className?: string; align?: "center" | "left" }) {
	return (
		<div className={`relative shrink-0 overflow-hidden rounded-t-xl ${className}`}>
			<img src={backdropUrl(media)} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_25%]" />
			<div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/95" />
			<div className={`absolute inset-0 flex p-4 ${align === "center" ? "items-center justify-center" : "items-start justify-start"}`}>
				<TrailerSolid media={media} />
			</div>
		</div>
	)
}

// 1: round 4's hero 4 with a shorter strip, taller poster, and two rows of logo tiles.
function Hero1({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame sectionProps={sectionProps}>
			<TallPoster media={media} />
			<div className="relative flex min-h-0 flex-col rounded-xl border border-white/10 bg-black/70">
				<Strip media={media} className="h-36" />
				<div className="relative -mt-10 flex flex-wrap items-center gap-4 px-5">
					<ScoreRing media={media} size={60} />
					<RatingChips media={media} tone="brand" size="md" />
					<RateButton media={media} look="outline" className="ml-auto" />
				</div>
				<div className="flex grow flex-col justify-between gap-4 p-5 pt-4">
					<StreamingTiles media={media} country={country} navigateToSection={navigateToSection} rows={2} />
					<Actions media={media} style="block" />
				</div>
			</div>
		</Frame>
	)
}

// 2: same frame, tiles carry the service name so they scan without hovering.
function Hero2({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame sectionProps={sectionProps}>
			<TallPoster media={media} />
			<div className="relative flex min-h-0 flex-col rounded-xl border border-white/10 bg-black/70">
				<Strip media={media} className="h-28" align="left" />
				<div className="relative -mt-9 flex flex-wrap items-center gap-4 px-5">
					<ScoreRing media={media} size={56} />
					<RatingChips media={media} tone="brand" size="md" />
					<RateButton media={media} className="ml-auto" />
				</div>
				<div className="flex grow flex-col justify-between gap-4 p-5 pt-4">
					<StreamingTiles media={media} country={country} navigateToSection={navigateToSection} rows={2} named />
					<Actions media={media} style="block" />
				</div>
			</div>
		</Frame>
	)
}

function RatingsCard({ media, extra }: { media: Media; extra?: React.ReactNode }) {
	return (
		<section className="rounded-xl bg-white/6 p-5">
			<h2 className="sr-only">Ratings</h2>
			<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
				<ScoreRing media={media} size={76} />
				<RatingChips media={media} tone="brand" size="md" />
				<div className="ml-auto flex items-center gap-3">
					{extra}
					<RateButton media={media} />
				</div>
			</div>
		</section>
	)
}

function WatchCard({ media, country, navigateToSection, named = false }: Omit<HeroProps, "sectionProps"> & { named?: boolean }) {
	return (
		<section className="flex min-h-0 grow flex-col justify-between gap-5 rounded-xl bg-white/6 p-5">
			<StreamingTiles media={media} country={country} navigateToSection={navigateToSection} rows={2} named={named} />
			<div>
				<h2 className="mb-2 text-sm font-semibold text-gray-200">Your list</h2>
				<Actions media={media} style="block" />
			</div>
		</section>
	)
}

// 3: round 4's hero 5; the trailer button sits on the poster's lower edge.
function Hero3({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame sectionProps={sectionProps}>
			<TallPoster media={media}>
				<div className="absolute inset-x-0 bottom-4 flex justify-center">
					<TrailerSolid media={media} size="lg" />
				</div>
			</TallPoster>
			<div className="flex min-h-0 flex-col gap-3">
				<RatingsCard media={media} />
				<WatchCard media={media} country={country} navigateToSection={navigateToSection} />
			</div>
		</Frame>
	)
}

// 4: trailer and Rate side by side, the two things you do before deciding.
function Hero4({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame sectionProps={sectionProps}>
			<TallPoster media={media} />
			<div className="flex min-h-0 flex-col gap-3">
				<RatingsCard media={media} extra={<TrailerSolid media={media} className="h-11" />} />
				<WatchCard media={media} country={country} navigateToSection={navigateToSection} named />
			</div>
		</Frame>
	)
}

// 5: a full-width trailer bar attached under the poster.
function Hero5({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame sectionProps={sectionProps}>
			<div className="mx-auto flex w-48 md:w-[17rem] md:h-full flex-col gap-2">
				<div className="aspect-[2/3] min-h-0 md:aspect-auto md:grow">
					<PosterImg media={media} />
				</div>
				<TrailerSolid media={media} className="w-full rounded-xl" />
			</div>
			<div className="flex min-h-0 flex-col gap-3">
				<RatingsCard media={media} />
				<WatchCard media={media} country={country} navigateToSection={navigateToSection} />
			</div>
		</Frame>
	)
}

export function HeroSection({ variant, ...props }: HeroProps & { variant: HeroVariant }) {
	if (variant === "1") return <Hero1 {...props} />
	if (variant === "2") return <Hero2 {...props} />
	if (variant === "3") return <Hero3 {...props} />
	if (variant === "4") return <Hero4 {...props} />
	if (variant === "5") return <Hero5 {...props} />
	return null
}
