// PROTOTYPE - throwaway. Five ways to arrange poster, trailer, actions,
// ratings, and streaming above the full-width fingerprint (`?hero=1..5`).

import React from "react"
import type { SectionIds } from "~/ui/details/sections"
import {
	Actions,
	MyScore,
	RatingChips,
	ScoreRing,
	Streaming,
	TrailerButton,
	backdropUrl,
	posterUrl,
	type Media,
} from "~/ui/prototype/detail-parts"
import type { Section, SectionProps } from "~/utils/scroll"

export const HERO_VARIANTS = {
	"0": "Current",
	"1": "Actions on the poster",
	"2": "One rail under the images",
	"3": "Actions in the sticky header",
	"4": "Info panel beside the poster",
	"5": "Cinematic backdrop",
} as const
export type HeroVariant = keyof typeof HERO_VARIANTS

interface HeroProps {
	media: Media
	country: string
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (s: Section) => void
}

const Wrap = ({ sectionProps, children }: { sectionProps: HeroProps["sectionProps"]; children: React.ReactNode }) => (
	<div className="relative max-w-7xl mx-auto mt-4 mb-10 px-4 sm:px-6 lg:px-8">
		<div {...sectionProps.overview}>{children}</div>
	</div>
)

function Poster({ media, className = "" }: { media: Media; className?: string }) {
	return (
		<img
			src={posterUrl(media)}
			alt={`Poster for ${media.details.title}`}
			className={`block w-full rounded-lg shadow-2xl shadow-black/60 ${className}`}
			draggable={false}
		/>
	)
}

function Backdrop({ media, className = "", children }: { media: Media; className?: string; children?: React.ReactNode }) {
	return (
		<div className={`relative overflow-hidden rounded-lg bg-black ${className}`}>
			<img src={backdropUrl(media)} alt="" className="absolute inset-0 h-full w-full object-cover" />
			{children}
		</div>
	)
}

// 1: actions sit on the poster as glass buttons, ratings sit on the backdrop.
function Hero1({ media, country, sectionProps, navigateToSection }: HeroProps) {
	return (
		<Wrap sectionProps={sectionProps}>
			<div className="flex gap-3">
				<div className="relative w-[22%] min-w-24 shrink-0">
					<Poster media={media} />
					<div className="hidden md:block absolute inset-x-0 bottom-0 rounded-b-lg bg-gradient-to-t from-black/90 via-black/60 to-transparent px-1.5 pb-1.5 pt-10">
						<Actions media={media} style="glass" className="w-full gap-1 [&>*]:flex-1 [&>*]:min-w-0" />
					</div>
				</div>
				<Backdrop media={media} className="grow">
					<div className="absolute inset-0 flex items-center justify-center">
						<TrailerButton media={media} style="center" />
					</div>
					<div className="hidden md:flex absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-16 flex-wrap items-end gap-3">
						<ScoreRing media={media} size={52} />
						<RatingChips media={media} />
						<div className="ml-auto">
							<MyScore media={media} compact />
						</div>
					</div>
				</Backdrop>
			</div>
			<div className="md:hidden mt-3 flex flex-wrap items-center gap-2">
				<ScoreRing media={media} size={40} label={false} />
				<RatingChips media={media} />
				<MyScore media={media} compact />
			</div>
			<Actions media={media} style="block" className="md:hidden mt-3" />
			<div className="mt-4 rounded-xl bg-white/4 px-4 py-3">
				<Streaming media={media} country={country} navigateToSection={navigateToSection} logoSize={40} max={8} />
			</div>
		</Wrap>
	)
}

// 2: images as today, then everything else in one dense rail.
function Hero2({ media, country, sectionProps, navigateToSection }: HeroProps) {
	return (
		<Wrap sectionProps={sectionProps}>
			<div className="flex gap-2">
				<div className="w-[21.8%] min-w-16 shrink-0">
					<Poster media={media} />
				</div>
				<Backdrop media={media} className="grow">
					<div className="absolute inset-0 flex items-center justify-center bg-black/20">
						<TrailerButton media={media} style="center" />
					</div>
				</Backdrop>
			</div>
			<div className="mt-3 grid gap-4 rounded-2xl border border-white/10 bg-black/35 backdrop-blur-sm p-3 lg:grid-cols-[auto_auto_1fr] lg:items-center lg:gap-0 lg:divide-x lg:divide-white/10">
				<Actions media={media} style="pill" className="lg:pr-4 flex-wrap" />
				<div className="flex flex-wrap items-center gap-3 lg:px-4">
					<ScoreRing media={media} size={40} label={false} />
					<RatingChips media={media} />
					<MyScore media={media} compact />
				</div>
				<div className="lg:pl-4">
					<Streaming media={media} country={country} navigateToSection={navigateToSection} logoSize={32} max={5} showTitle={false} />
				</div>
			</div>
		</Wrap>
	)
}

// 3: the header carries score and actions (see HeaderDock); the page keeps
// the images and a two-part bar for ratings and streaming.
export function HeaderDock({ media }: { media: Media }) {
	return (
		<div className="hidden md:flex items-center gap-3">
			<ScoreRing media={media} size={40} label={false} />
			<MyScore media={media} compact />
			<span className="h-6 w-px bg-white/15" aria-hidden="true" />
			<Actions media={media} style="icon" />
		</div>
	)
}

function Hero3({ media, country, sectionProps, navigateToSection }: HeroProps) {
	return (
		<Wrap sectionProps={sectionProps}>
			<div className="flex gap-2">
				<div className="w-[21.8%] min-w-16 shrink-0">
					<Poster media={media} />
				</div>
				<Backdrop media={media} className="grow">
					<div className="absolute inset-0 flex items-center justify-center bg-black/20">
						<TrailerButton media={media} style="center" />
					</div>
				</Backdrop>
			</div>
			<Actions media={media} style="block" className="md:hidden mt-3" />
			<div className="mt-3 grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
				<div className="rounded-xl bg-white/4 px-4 py-3">
					<h2 className="text-sm font-semibold text-gray-200">Ratings</h2>
					<div className="mt-2">
						<RatingChips media={media} tone="brand" size="md" />
					</div>
				</div>
				<div className="rounded-xl bg-white/4 px-4 py-3">
					<Streaming media={media} country={country} navigateToSection={navigateToSection} layout="named" logoSize={36} max={5} />
				</div>
			</div>
		</Wrap>
	)
}

// 4: poster left, an info panel on the backdrop replaces the big trailer image.
function Hero4({ media, country, sectionProps, navigateToSection }: HeroProps) {
	return (
		<Wrap sectionProps={sectionProps}>
			<div className="grid gap-4 md:grid-cols-[minmax(10rem,17rem)_1fr]">
				<div className="relative max-w-56 md:max-w-none mx-auto md:mx-0 w-full">
					<Poster media={media} />
					<div className="absolute top-2 left-2">
						<TrailerButton media={media} style="chip" />
					</div>
				</div>
				<div className="relative overflow-hidden rounded-xl border border-white/10">
					<img src={backdropUrl(media)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
					<div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/85 to-black/50" />
					<div className="relative flex h-full flex-col gap-5 p-5">
						<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
							<ScoreRing media={media} size={68} />
							<RatingChips media={media} tone="brand" size="md" />
							<div className="ml-auto">
								<MyScore media={media} />
							</div>
						</div>
						<div className="grow">
							<Streaming media={media} country={country} navigateToSection={navigateToSection} layout="list" max={4} />
						</div>
						<Actions media={media} style="block" className="[&>*]:flex-1" />
					</div>
				</div>
			</div>
		</Wrap>
	)
}

// 5: full-width backdrop, poster overlaps its lower edge, controls on the gradient.
function Hero5({ media, country, sectionProps, navigateToSection }: HeroProps) {
	return (
		<div {...sectionProps.overview} className="relative mb-10">
			<div className="relative h-[40vw] max-h-[28rem] min-h-60 w-full overflow-hidden">
				<img
					src={backdropUrl(media, "original")}
					alt=""
					className="absolute inset-0 h-full w-full object-cover object-[center_20%]"
					style={{ maskImage: "linear-gradient(to bottom, black 45%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 45%, transparent)" }}
				/>
				<div className="absolute inset-0 flex items-center justify-center pb-16">
					<TrailerButton media={media} style="center" />
				</div>
			</div>
			<div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-28 sm:-mt-36">
				<div className="flex gap-5 items-end">
					<div className="w-28 sm:w-44 shrink-0">
						<Poster media={media} className="ring-1 ring-white/15" />
					</div>
					<div className="flex min-w-0 grow flex-col gap-3 pb-1">
						<div className="flex flex-wrap items-center gap-3">
							<ScoreRing media={media} size={52} />
							<RatingChips media={media} tone="brand" />
							<MyScore media={media} compact />
						</div>
						<Actions media={media} style="pill" className="hidden sm:flex" />
					</div>
				</div>
				<Actions media={media} style="block" className="sm:hidden mt-3" />
				<div className="mt-5 sm:pl-49">
					<Streaming media={media} country={country} navigateToSection={navigateToSection} layout="named" logoSize={32} max={6} />
				</div>
			</div>
		</div>
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
