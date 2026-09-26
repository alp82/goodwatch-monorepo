// PROTOTYPE — round 3 score-area layouts, grown from round 2's "8 One panel". Lives only on the
// prototype/score-area branch. There is no inner card any more: the content spans the whole
// backdrop panel and the whole backdrop behind it is blurred and dimmed with the production glass
// treatment (backdrop blur, black wash, and the production top-to-bottom gradient). The GoodWatch
// ring is the production ScoreRing scaled up without its verdict word and caption; the rating
// chips drop a size step and hide sites with no score. 8a is the base; 8b to 8f are small steps.
// Arrangements switch on the panel's own width (a container query), so the wide panel at 1280,
// the narrow one beside the poster at 768, and the phone card each get a fitting layout.
import type React from "react"
import EpisodeGridLink from "~/ui/details/hero/EpisodeGridLink"
import ListActions from "~/ui/details/hero/ListActions"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { BackdropTrailer, PosterTrailer, backdropUrl } from "~/ui/details/hero/Trailer"
import WhereToWatch from "~/ui/details/hero/WhereToWatch"
import { goodwatchScoreDisplay, scoreLabels } from "~/utils/ratings"
import { Chips, EpisodesText, type Media, RateBtn, type VariantProps } from "./shared"

// ---------------------------------------------------------------------------------------------
// The frame: poster left, and a backdrop panel whose whole surface is the blurred backdrop.

type Blur = "sm" | "md" | "xl"
// The production glass is backdrop-blur-md over black/55. The lighter blur gets a heavier wash so
// that the sharper image behind the text never gets brighter.
const GLASS_LAYER: Record<Blur, string> = {
	sm: "backdrop-blur-sm bg-black/65",
	md: "backdrop-blur-md bg-black/55",
	xl: "backdrop-blur-xl bg-black/55",
}
type Tint = "down" | "side"
const TINT: Record<Tint, string> = {
	// The production backdrop gradient.
	down: "bg-gradient-to-b from-black/30 via-transparent to-black/70",
	// Darkest on the left where the content starts, lighter towards the right edge.
	side: "bg-gradient-to-r from-black/60 via-black/30 to-black/10",
}

export function BlurFrame({ media, blur = "md", tint = "down", children }: { media: Media; blur?: Blur; tint?: Tint; children: React.ReactNode }) {
	return (
		<div className="grid gap-4 md:min-h-[28.5rem] md:grid-cols-[auto_1fr] [&>*]:min-w-0">
			<PosterTrailer media={media} className="hidden aspect-[2/3] self-start md:block md:w-[19rem]" />
			<div className="relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-stone-950 md:rounded-xl">
				<div className="absolute inset-0 -z-10" aria-hidden="true">
					<img src={backdropUrl(media)} alt="" className="h-full w-full scale-110 object-cover object-[center_25%]" />
					<div className={`absolute inset-0 ${GLASS_LAYER[blur]}`} />
					<div className={`absolute inset-0 ${TINT[tint]}`} />
				</div>
				{/* Phones keep the sharp trailer banner; it fades into the blurred surface below. */}
				<BackdropTrailer
					media={media}
					className="h-44 [mask-image:linear-gradient(to_bottom,black_65%,transparent)] md:hidden [&_span.bg-gradient-to-b]:hidden"
				/>
				<div className="@container flex grow flex-col px-4 pb-5 pt-2 md:p-5 lg:p-7">{children}</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------
// The production ring, bigger and without the verdict word and caption. The meaning moves into
// an accessible name and a tooltip. Two sizes: one for phones, one from md up.

function ringName(media: Media) {
	const percent = media.details.goodwatch_overall_score_normalized_percent
	const score = percent ? goodwatchScoreDisplay(percent) : null
	return score == null ? "GoodWatch score: not rated yet" : `GoodWatch score ${score} of 100, ${scoreLabels[Math.max(1, Math.round(score / 10))]}`
}

export function BigRing({ media, phone = 76, desktop = 96 }: { media: Media; phone?: number; desktop?: number }) {
	const name = ringName(media)
	return (
		<div role="img" aria-label={name} title={name} className="shrink-0 [&_*]:pointer-events-none">
			<div className="md:hidden">
				<ScoreRing media={media} size={phone} label={false} />
			</div>
			<div className="hidden md:block">
				<ScoreRing media={media} size={desktop} label={false} />
			</div>
		</div>
	)
}

export const Divider = () => <div aria-hidden="true" className="h-px bg-white/10" />

// ---------------------------------------------------------------------------------------------
// 8a — Blur panel: round 2's "One panel" without the inner card. Ring big on the left, the compact
// chips with the Episode ratings link beside it, Rate on the right. Where to watch follows after a
// generous gap, and the list actions sit on the bottom edge.
export function Variant8aBlurPanel(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	return (
		<BlurFrame media={media}>
			<div className="flex flex-wrap items-center gap-x-5 gap-y-4 @[36rem]:flex-nowrap @[36rem]:gap-x-6">
				<BigRing media={media} />
				<div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
					<Chips media={media} size="sm" layout="wrap" hideEmpty />
					{hasEpisodeGrid && <EpisodesText />}
				</div>
				<RateBtn media={media} className="w-full @[36rem]:w-auto @[36rem]:self-start" />
			</div>
			<div className="mt-8 md:mt-10">
				<WhereToWatch media={media} country={p.country} navigateToSection={p.navigateToSection} />
			</div>
			<div className="min-h-6 grow" />
			<ListActions media={media} />
		</BlurFrame>
	)
}

// 8b — Stacked chips: the three chips one size smaller and stacked in a column beside the ring,
// like a legend for it. Rate stays on the right with the Episode ratings link under it.
export function Variant8bStackedChips(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	return (
		<BlurFrame media={media}>
			<div className="flex flex-wrap items-center gap-x-5 gap-y-4 @[36rem]:flex-nowrap @[36rem]:gap-x-6">
				<BigRing media={media} />
				<Chips media={media} size="xs" layout="col" hideEmpty className="min-w-0 flex-1" />
				<div className="flex w-full flex-col items-center gap-3 @[36rem]:w-auto @[36rem]:items-end @[36rem]:self-start">
					<RateBtn media={media} className="w-full @[36rem]:w-auto" />
					{hasEpisodeGrid && <EpisodesText />}
				</div>
			</div>
			<div className="mt-8 md:mt-10">
				<WhereToWatch media={media} country={p.country} navigateToSection={p.navigateToSection} />
			</div>
			<div className="min-h-6 grow" />
			<ListActions media={media} />
		</BlurFrame>
	)
}

// 8c — Rate joins the actions: the score group is only what others think (ring, chips, Episode
// ratings); your own Rate button moves into the bottom row with Want to See, Mark as Seen, Skip.
export function Variant8cRateInActions(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	return (
		<BlurFrame media={media}>
			<div className="flex items-center gap-5 @[36rem]:gap-6">
				<BigRing media={media} phone={80} desktop={104} />
				<div className="flex min-w-0 flex-1 flex-col items-start gap-2.5">
					<Chips media={media} size="sm" layout="wrap" hideEmpty />
					{hasEpisodeGrid && <EpisodesText />}
				</div>
			</div>
			<div className="mt-8 md:mt-10">
				<WhereToWatch media={media} country={p.country} navigateToSection={p.navigateToSection} />
			</div>
			<div className="min-h-6 grow" />
			<div className="flex flex-col gap-2 @[36rem]:flex-row">
				<RateBtn media={media} align="left" className="@[36rem]:w-44 @[36rem]:shrink-0" />
				<div className="min-w-0 grow">
					<ListActions media={media} />
				</div>
			</div>
		</BlurFrame>
	)
}

// 8d — Score column: on a wide panel the score becomes its own column on the left (ring, stacked
// chips, Episode ratings, Rate) beside Where to watch and the actions. Narrow panels stack like 8a.
export function Variant8dScoreColumn(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	return (
		<BlurFrame media={media}>
			<div className="flex grow flex-col gap-8 @[44rem]:grid @[44rem]:grid-cols-[11rem_1fr] @[44rem]:gap-10">
				<div className="flex flex-wrap items-center gap-x-5 gap-y-4 @[44rem]:flex-col @[44rem]:flex-nowrap @[44rem]:items-start @[44rem]:gap-5">
					<BigRing media={media} desktop={112} />
					<div className="flex min-w-0 flex-1 flex-col items-start gap-2.5 @[44rem]:flex-none">
						<Chips media={media} size="sm" layout="col" hideEmpty />
						{hasEpisodeGrid && <EpisodesText />}
					</div>
					<RateBtn media={media} align="left" className="w-full @[44rem]:mt-auto" />
				</div>
				<div className="flex min-w-0 flex-col">
					<WhereToWatch media={media} country={p.country} navigateToSection={p.navigateToSection} />
					<div className="min-h-6 grow" />
					<ListActions media={media} />
				</div>
			</div>
		</BlurFrame>
	)
}

// 8e — Lines and side light: 8a's layout with thin dividers between the three groups instead of
// pure whitespace, Episode ratings as the production chip in line with the rating chips, a
// stronger blur, and the wash running from the left (dark behind the content) to the right.
export function Variant8eDividers(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	return (
		<BlurFrame media={media} blur="xl" tint="side">
			<div className="flex flex-wrap items-center gap-x-5 gap-y-4 @[36rem]:flex-nowrap @[36rem]:gap-x-6">
				<BigRing media={media} />
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
					<Chips media={media} size="sm" layout="wrap" hideEmpty />
					{hasEpisodeGrid && (
						<div className="[&>a]:h-7 [&>a]:text-[13px] md:[&>a]:h-7">
							<EpisodeGridLink />
						</div>
					)}
				</div>
				<RateBtn media={media} className="w-full @[36rem]:w-auto" />
			</div>
			<div className="my-6 md:my-7">
				<Divider />
			</div>
			<WhereToWatch media={media} country={p.country} navigateToSection={p.navigateToSection} />
			<div className="min-h-6 grow" />
			<div className="mb-6 md:mb-7">
				<Divider />
			</div>
			<ListActions media={media} />
		</BlurFrame>
	)
}

// 8f — Score and Rate, light blur: the biggest ring with Rate right beside it (theirs, then
// yours), the chips pushed to the right edge, and a lighter blur so more of the picture shows
// through, with a heavier wash to keep the text readable.
export function Variant8fScoreAndRate(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	return (
		<BlurFrame media={media} blur="sm">
			<div className="flex flex-col gap-4 @[40rem]:flex-row @[40rem]:items-center @[40rem]:justify-between @[40rem]:gap-6">
				<div className="flex items-center gap-5">
					<BigRing media={media} phone={80} desktop={112} />
					<RateBtn media={media} align="left" className="min-w-0 flex-1 @[40rem]:flex-none" />
				</div>
				<div className="flex min-w-0 flex-col items-start gap-2.5 @[40rem]:items-end">
					<Chips media={media} size="sm" layout="wrap" hideEmpty className="@[40rem]:justify-end" />
					{hasEpisodeGrid && <EpisodesText />}
				</div>
			</div>
			<div className="mt-8 md:mt-10">
				<WhereToWatch media={media} country={p.country} navigateToSection={p.navigateToSection} />
			</div>
			<div className="min-h-6 grow" />
			<ListActions media={media} />
		</BlurFrame>
	)
}
