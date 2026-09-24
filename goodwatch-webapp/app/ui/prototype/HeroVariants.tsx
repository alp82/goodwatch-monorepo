// PROTOTYPE - throwaway. Round 4: five takes on the info-panel hero
// (round 3's hero 4). Poster and panel share a fixed height on md+, so tabs,
// the country picker, and the "+N" list never make the layout jump.
// Round 3's five heroes are in b1c85b75.

import React from "react"
import type { SectionIds } from "~/ui/details/sections"
import imdbLogo from "~/img/imdb-logo-250.png"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png"
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png"
import {
	Actions,
	RateButton,
	RatingChips,
	ScoreRing,
	StreamingChips,
	TrailerButton,
	backdropUrl,
	posterUrl,
	useRatings,
	type Media,
} from "~/ui/prototype/detail-parts"
import type { Section, SectionProps } from "~/utils/scroll"

export const HERO_VARIANTS = {
	"0": "Current",
	"1": "Panel in rows",
	"2": "Score column + trailer tile",
	"3": "Poster, panel, trailer",
	"4": "Backdrop top, controls below",
	"5": "Ratings card + watch card",
} as const
export type HeroVariant = keyof typeof HERO_VARIANTS

interface HeroProps {
	media: Media
	country: string
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (s: Section) => void
}

// Poster column and panel share this height from md up.
const ROW = "md:h-[25.5rem] md:grid-rows-[minmax(0,1fr)]"

function Frame({ sectionProps, cols, children }: { sectionProps: HeroProps["sectionProps"]; cols: string; children: React.ReactNode }) {
	return (
		<div className="relative max-w-7xl mx-auto mt-4 mb-10 px-4 sm:px-6 lg:px-8">
			<div {...sectionProps.overview} className={`grid gap-4 ${cols} ${ROW}`}>
				{children}
			</div>
		</div>
	)
}

function Poster({ media, trailer = false }: { media: Media; trailer?: boolean }) {
	return (
		<div className="relative mx-auto w-44 md:w-[17rem] md:h-full aspect-[2/3]">
			<img
				src={posterUrl(media)}
				alt={`Poster for ${media.details.title}`}
				className="h-full w-full rounded-xl object-cover shadow-2xl shadow-black/60 bg-white/5"
				draggable={false}
			/>
			{trailer && (
				<div className="absolute top-2 left-2">
					<TrailerButton media={media} style="chip" />
				</div>
			)}
		</div>
	)
}

// Panel surface: dark, with the backdrop as a faint texture. The image is
// clipped in its own layer so popovers can still leave the panel.
function Panel({ media, children, className = "", texture = 30 }: { media: Media; children: React.ReactNode; className?: string; texture?: number }) {
	return (
		<div className={`relative rounded-xl border border-white/10 ${className}`}>
			<div className="absolute inset-0 overflow-hidden rounded-xl" aria-hidden="true">
				<img src={backdropUrl(media)} alt="" className="h-full w-full object-cover" style={{ opacity: texture / 100 }} />
				<div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/85 to-black/55" />
			</div>
			<div className="relative h-full">{children}</div>
		</div>
	)
}

function TrailerTile({ media, className = "" }: { media: Media; className?: string }) {
	return (
		<div className={`relative overflow-hidden rounded-xl bg-black ${className}`}>
			<img src={backdropUrl(media)} alt="" className="absolute inset-0 h-full w-full object-cover" />
			<div className="absolute inset-0 bg-black/25" />
			<div className="absolute inset-0 flex items-center justify-center">
				<TrailerButton media={media} style="center" />
			</div>
		</div>
	)
}

// 1: round 3's panel, tidied into three even rows.
function Hero1({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame sectionProps={sectionProps} cols="md:grid-cols-[auto_1fr]">
			<Poster media={media} trailer />
			<Panel media={media}>
				<div className="flex h-full flex-col justify-between gap-6 p-5 lg:p-6">
					<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
						<ScoreRing media={media} size={72} />
						<RatingChips media={media} tone="brand" size="md" />
						<RateButton media={media} className="ml-auto" />
					</div>
					<StreamingChips media={media} country={country} navigateToSection={navigateToSection} max={4} />
					<Actions media={media} style="block" />
				</div>
			</Panel>
		</Frame>
	)
}

function RatingRows({ media }: { media: Media }) {
	const r = useRatings(media)
	const row = (href: string, logo: string, alt: string, value: string, bg: string) => (
		<a
			href={href || undefined}
			target="_blank"
			rel="noreferrer"
			className={`flex items-center justify-between rounded-md px-2.5 py-1.5 hover:brightness-110 ${bg} ${href ? "" : "opacity-50 pointer-events-none"}`}
		>
			<img src={logo} alt={alt} className="h-4" />
			<span className="text-sm font-bold tabular-nums">{value}</span>
		</a>
	)
	return (
		<div className="flex flex-col gap-1.5">
			{row(r.imdbUrl, imdbLogo, "IMDb", r.imdb ?? "–", "bg-imdb text-black")}
			{row(r.mcUrl, metacriticLogoIcon, "Metacritic", r.mc == null ? "–" : String(r.mc), "bg-metacritic text-white")}
			{row(r.rtUrl, rottenLogoIcon, "Rotten Tomatoes", r.rt == null ? "–" : `${r.rt}%`, "bg-rotten text-white")}
		</div>
	)
}

// 2: a score column on the left of the panel; trailer returns as a tile.
function Hero2({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame sectionProps={sectionProps} cols="md:grid-cols-[auto_1fr]">
			<Poster media={media} />
			<Panel media={media} texture={20}>
				<div className="grid h-full md:grid-cols-[12.5rem_1fr]">
					<div className="flex flex-col gap-4 border-b md:border-b-0 md:border-r border-white/10 p-5">
						<div className="flex justify-center">
							<ScoreRing media={media} size={88} />
						</div>
						<RatingRows media={media} />
						<RateButton media={media} className="md:mt-auto" />
					</div>
					<div className="flex min-w-0 flex-col gap-4 p-5">
						<StreamingChips media={media} country={country} navigateToSection={navigateToSection} max={3} />
						<TrailerTile media={media} className="min-h-40 grow" />
						<Actions media={media} style="block" />
					</div>
				</div>
			</Panel>
		</Frame>
	)
}

// 3: three columns of equal height, the trailer gets its own column again.
function Hero3({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame sectionProps={sectionProps} cols="md:grid-cols-[auto_1fr] xl:grid-cols-[auto_1fr_24rem]">
			<Poster media={media} />
			<Panel media={media} texture={0}>
				<div className="flex h-full flex-col justify-between gap-5 p-5">
					<div className="flex items-center gap-4">
						<ScoreRing media={media} size={64} />
						<RateButton media={media} className="ml-auto" />
					</div>
					<RatingChips media={media} tone="brand" size="md" />
					<StreamingChips media={media} country={country} navigateToSection={navigateToSection} max={2} />
					<Actions media={media} style="block" />
				</div>
			</Panel>
			<TrailerTile media={media} className="hidden xl:block" />
		</Frame>
	)
}

// 4: the backdrop shows in the top of the panel, controls sit below it.
function Hero4({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame sectionProps={sectionProps} cols="md:grid-cols-[auto_1fr]">
			<Poster media={media} />
			<div className="relative flex flex-col rounded-xl border border-white/10 bg-black/70">
				<div className="relative h-40 md:h-auto md:grow overflow-hidden rounded-t-xl">
					<img src={backdropUrl(media)} alt="" className="absolute inset-0 h-full w-full object-cover" />
					<div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/90" />
					<div className="absolute inset-0 flex items-center justify-center">
						<TrailerButton media={media} style="center" />
					</div>
				</div>
				<div className="relative -mt-12 flex flex-wrap items-center gap-4 px-5">
					<ScoreRing media={media} size={60} />
					<RatingChips media={media} tone="brand" size="md" />
					<RateButton media={media} look="outline" className="ml-auto" />
				</div>
				<div className="flex flex-col gap-4 p-5">
					<StreamingChips media={media} country={country} navigateToSection={navigateToSection} max={4} />
					<Actions media={media} style="block" />
				</div>
			</div>
		</Frame>
	)
}

// 5: the panel splits into two surfaces: what people think, and how to watch.
function Hero5({ media, country, navigateToSection, sectionProps }: HeroProps) {
	return (
		<Frame sectionProps={sectionProps} cols="md:grid-cols-[auto_1fr]">
			<Poster media={media} trailer />
			<div className="flex flex-col gap-3">
				<section className="rounded-xl bg-white/6 p-5">
					<h2 className="sr-only">Ratings</h2>
					<div className="flex flex-wrap items-center gap-x-6 gap-y-3">
						<ScoreRing media={media} size={80} />
						<RatingChips media={media} tone="brand" size="md" />
						<RateButton media={media} className="ml-auto" />
					</div>
				</section>
				<section className="flex grow flex-col justify-between gap-5 rounded-xl bg-white/6 p-5">
					<StreamingChips media={media} country={country} navigateToSection={navigateToSection} max={4} />
					<div>
						<h2 className="mb-2 text-sm font-semibold text-gray-200">Your list</h2>
						<Actions media={media} style="block" />
					</div>
				</section>
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
