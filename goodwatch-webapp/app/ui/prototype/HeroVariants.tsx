// PROTOTYPE - throwaway. Round 9: round 7's hero 1 on desktop for all
// variants; the variants differ on phones only (switch at < 768px).
// Every phone layout uses one surface, one left edge, equal-width controls,
// and a single primary button. Round 8's phone layout is in 6e5059ca. `?owned=1` marks the first service as yours.

import React from "react"
import type { SectionIds } from "~/ui/details/sections"
import imdbIcon from "~/img/imdb-logo-250.png"
import metacriticLogoIcon from "~/img/metacritic-logo-icon-250.png"
import rottenLogoIcon from "~/img/rotten-logo-icon-250.png"
import {
	Actions,
	PosterTrailer,
	RateButton,
	RatingChips,
	ScoreRing,
	StreamingTiles,
	TrailerSolid,
	backdropUrl,
	useRatings,
	type Media,
} from "~/ui/prototype/detail-parts"
import type { Section, SectionProps } from "~/utils/scroll"

export const HERO_VARIANTS = {
	"0": "Current",
	"1": "Phone: poster + ratings table",
	"2": "Phone: trailer banner",
	"3": "Phone: poster, Rate on its own row",
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

type Props = Omit<HeroProps, "sectionProps">

const SURFACE = "md:hidden relative overflow-hidden rounded-2xl border border-white/10 bg-stone-950"

function Banner({ media, className = "h-28" }: { media: Media; className?: string }) {
	return (
		<div className={`absolute inset-x-0 top-0 ${className}`} aria-hidden="true">
			<img src={backdropUrl(media)} alt="" className="h-full w-full object-cover object-[center_25%] opacity-50" />
			<div className="absolute inset-0 bg-gradient-to-b from-transparent to-stone-950" />
		</div>
	)
}

// Critics and audience as a small aligned table.
function RatingTable({ media }: { media: Media }) {
	const r = useRatings(media)
	const row = (logo: string, alt: string, href: string, critics: string | null, audience: string | null) => (
		<a href={href || undefined} target="_blank" rel="noreferrer" className="grid grid-cols-[1.5rem_1fr_3rem_3rem] items-center gap-2 rounded-md px-1 py-1 hover:bg-white/5">
			<img src={logo} alt={alt} className="h-4 w-auto justify-self-start" />
			<span className="truncate text-xs text-gray-400 max-[430px]:sr-only">{alt}</span>
			<span className="text-right text-sm font-semibold tabular-nums">{critics ?? "–"}</span>
			<span className="text-right text-sm tabular-nums text-gray-300">{audience ?? "–"}</span>
		</a>
	)
	return (
		<div className="w-full">
			<div className="grid grid-cols-[1.5rem_1fr_3rem_3rem] gap-2 px-1 text-[11px] text-gray-500">
				<span />
				<span />
				<span className="text-right">Critics</span>
				<span className="text-right">Audience</span>
			</div>
			{row(imdbIcon, "IMDb", r.imdbUrl, null, r.imdb)}
			{row(metacriticLogoIcon, "Metacritic", r.mcUrl, r.mc == null ? null : String(r.mc), r.mcUser)}
			{row(rottenLogoIcon, "Rotten Tomatoes", r.rtUrl, r.rt == null ? null : `${r.rt}%`, r.rtAudience == null ? null : `${r.rtAudience}%`)}
		</div>
	)
}

// 1: poster beside score and a ratings table; Rate is the one primary button.
function Mobile1({ media, country, navigateToSection }: Props) {
	return (
		<div className={SURFACE}>
			<Banner media={media} />
			<div className="relative flex flex-col gap-5 p-4 pt-16">
				<div className="grid grid-cols-[6.5rem_1fr] gap-4">
					<PosterTrailer media={media} compact className="w-full aspect-[2/3] self-start" />
					<div className="flex min-w-0 flex-col gap-2">
						<ScoreRing media={media} size={48} />
						<RatingTable media={media} />
					</div>
				</div>
				<StreamingTiles media={media} country={country} navigateToSection={navigateToSection} rows={1} />
				<div className="grid grid-cols-[1fr_3fr] gap-2">
					<RateButton media={media} look="icon" />
					<Actions media={media} style="compact" className="gap-2" />
				</div>
			</div>
		</div>
	)
}

// 2: no poster thumbnail; the backdrop is a trailer banner. Score row, then
// three equal rating chips, streaming, and three equal actions.
function Mobile2({ media, country, navigateToSection }: Props) {
	return (
		<div className={SURFACE}>
			<div className="relative h-44">
				<img src={backdropUrl(media)} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_25%]" />
				<div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-stone-950" />
				<div className="absolute inset-0 flex items-center justify-center">
					<TrailerSolid media={media} />
				</div>
			</div>
			<div className="relative flex flex-col gap-4 p-4 pt-1">
				<div className="flex items-center justify-between gap-3">
					<ScoreRing media={media} size={52} />
					<RateButton media={media} />
				</div>
				<RatingChips media={media} tone="brand" fill />
				<div className="h-px bg-white/10" />
				<StreamingTiles media={media} country={country} navigateToSection={navigateToSection} rows={1} />
				<Actions media={media} style="block" />
			</div>
		</div>
	)
}

// 3: poster beside score and stacked rating chips; Rate gets its own row,
// the three list actions share the row below.
function Mobile3({ media, country, navigateToSection }: Props) {
	return (
		<div className={SURFACE}>
			<Banner media={media} className="h-24" />
			<div className="relative flex flex-col gap-5 p-4 pt-12">
				<div className="flex gap-4">
					<PosterTrailer media={media} compact className="w-24 shrink-0 aspect-[2/3] self-start" />
					<div className="flex min-w-0 grow flex-col justify-end gap-3">
						<ScoreRing media={media} size={48} />
						<RatingChips media={media} tone="brand" />
					</div>
				</div>
				<StreamingTiles media={media} country={country} navigateToSection={navigateToSection} rows={1} />
				<div className="flex flex-col gap-2">
					<RateButton media={media} />
					<Actions media={media} style="block" />
				</div>
			</div>
		</div>
	)
}

export function HeroSection({ variant, media, country, sectionProps, navigateToSection }: HeroProps & { variant: HeroVariant }) {
	if (variant === "0") return null
	return (
		<div className="relative max-w-7xl mx-auto mt-4 mb-10 px-4 sm:px-6 lg:px-8">
			<div {...sectionProps.overview}>
				<DesktopHero media={media} country={country} navigateToSection={navigateToSection} />
				{variant === "1" && <Mobile1 media={media} country={country} navigateToSection={navigateToSection} />}
				{variant === "2" && <Mobile2 media={media} country={country} navigateToSection={navigateToSection} />}
				{variant === "3" && <Mobile3 media={media} country={country} navigateToSection={navigateToSection} />}
			</div>
		</div>
	)
}
