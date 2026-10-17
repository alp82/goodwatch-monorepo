// PROTOTYPE - throwaway. Layout variants of the title page overview card, picked with ?variant= (A is the live card).
import type { ReactNode } from "react"
import EpisodeGridLink from "~/ui/details/hero/EpisodeGridLink"
import ListActions from "~/ui/details/hero/ListActions"
import RatingChips from "~/ui/details/hero/RatingChips"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import SeenScore from "~/ui/details/hero/SeenScore"
import TitleSidesLine from "~/ui/details/hero/TitleSidesLine"
import { HeroBackdropImage, HeroPoster, TrailerButton } from "~/ui/details/hero/Trailer"
import WhereToWatch from "~/ui/details/hero/WhereToWatch"
import type { DetailsHeroProps } from "~/ui/details/hero/DetailsHero"

export const OVERVIEW_VARIANTS = {
	A: "Live card",
	B: "Your row under the banner",
	C: "Everything yours on the banner",
	D: "Side column, watch on the right",
	E: "Banner left, watch on the right",
}

type P = Omit<DetailsHeroProps, "sectionProps">

function Banner({ media, children, tall = false }: { media: P["media"]; children: ReactNode; tall?: boolean }) {
	return (
		<div className="relative">
			<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-t-2xl" aria-hidden="true">
				<HeroBackdropImage media={media} className="h-full w-full object-cover object-[center_22%]" />
				<div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/10" />
				<div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/20 to-transparent" />
			</div>
			<TrailerButton media={media} className="absolute right-3 top-3 md:right-5 md:top-4" />
			<div className={`px-4 pb-4 md:px-6 md:pb-5 ${tall ? "pt-24 md:pt-28" : "pt-14 md:pt-10"}`}>{children}</div>
		</div>
	)
}

function Sites({ media, episodeGrid }: P) {
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-3">
			<RatingChips media={media} fill={false} />
			{episodeGrid && <EpisodeGridLink grid={episodeGrid} />}
		</div>
	)
}

function Scores(p: P) {
	return (
		<div className="flex min-w-0 flex-col gap-2.5">
			<ScoreRing media={p.media} size={56} />
			<Sites {...p} />
		</div>
	)
}

const seenWidth = (p: P) => (p.media.mediaType === "show" ? "md:w-[22rem]" : "md:w-[20rem]")

function Watch(p: P & { wide?: boolean; className?: string }) {
	return (
		<WhereToWatch
			media={p.media}
			country={p.country}
			shownCountry={p.shownCountry}
			preview={p.preview}
			wide={p.wide}
			className={p.className ?? "rounded-xl bg-white/[0.035] p-3 ring-1 ring-white/[0.07] md:p-4"}
		/>
	)
}

function Taste(p: P) {
	return p.sides ? <TitleSidesLine sides={p.sides} mediaType={p.media.mediaType} tmdbId={p.media.details.tmdb_id} quiet /> : null
}

// B: banner keeps poster + public scores. Under it one plain row with the member's things (Seen/score, then the
// list buttons), then where to watch across the card, then the taste line as a quiet foot.
function VariantB(p: P) {
	return (
		<>
			<Banner media={p.media}>
				<div className="flex items-end gap-3 md:gap-6">
					<HeroPoster media={p.media} className="w-[4.5rem] md:w-32" />
					<Scores {...p} />
				</div>
			</Banner>
			<div className="flex flex-col gap-3 border-y border-white/10 bg-white/[0.03] px-3 py-3 md:flex-row md:items-center md:px-5">
				<SeenScore media={p.media} className={`max-md:w-full md:shrink-0 ${seenWidth(p)}`} />
				<div className="min-w-0 flex-1">
					<ListActions media={p.media} />
				</div>
			</div>
			<div className="p-3 md:p-5">
				<Watch {...p} wide />
			</div>
			<Taste {...p} />
		</>
	)
}

// C: the banner holds everything about the title and you: scores on the left, Seen/score and the list buttons as
// one stack on the right, bottom aligned. Where to watch gets the whole body. Taste at the foot.
function VariantC(p: P) {
	return (
		<>
			<Banner media={p.media} tall>
				<div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
					<div className="flex items-end gap-3 md:gap-6">
						<HeroPoster media={p.media} className="w-[4.5rem] md:w-32" />
						<Scores {...p} />
					</div>
					<div className={`flex flex-col gap-2 max-md:w-full ${seenWidth(p)} md:shrink-0`}>
						<SeenScore media={p.media} className="w-full" />
						<ListActions media={p.media} />
					</div>
				</div>
			</Banner>
			<div className="p-3 md:p-5">
				<Watch {...p} wide className="" />
			</div>
			<Taste {...p} />
		</>
	)
}

// D: a narrow left column is "you" (poster, scores, Seen/score, list buttons stacked); the right column is where
// to watch, full height, with room to breathe. Banner is only a strip behind the top.
function VariantD(p: P) {
	return (
		<>
			<Banner media={p.media}>
				<div className="h-16 md:h-24" />
			</Banner>
			<div className="-mt-20 grid gap-4 px-3 pb-3 md:-mt-28 md:grid-cols-[20rem_minmax(0,1fr)] md:gap-6 md:px-5 md:pb-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
				<div className="flex min-w-0 flex-col gap-3">
					<div className="flex items-end gap-4">
						<HeroPoster media={p.media} className="w-24 md:w-32" />
						<ScoreRing media={p.media} size={56} />
					</div>
					<Sites {...p} />
					<SeenScore media={p.media} className="w-full" />
					<ListActions media={p.media} />
				</div>
				<div className="min-w-0 md:pt-24">
					<Watch {...p} wide />
				</div>
			</div>
			<Taste {...p} />
		</>
	)
}

// E: two halves from the top. Left: the banner with poster, scores, Seen/score and list buttons. Right: where to
// watch on plain dark, from the top of the card. Taste spans the foot.
function VariantE(p: P) {
	return (
		<>
			<div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
				<div className="relative min-w-0">
					<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-tl-2xl max-lg:rounded-t-2xl" aria-hidden="true">
						<HeroBackdropImage media={p.media} className="h-full w-full object-cover object-[center_22%]" />
						<div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/10" />
						<div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/20 to-stone-950/60" />
					</div>
					<TrailerButton media={p.media} className="absolute right-3 top-3 md:right-5 md:top-4" />
					<div className="flex h-full flex-col justify-end gap-4 px-4 pb-4 pt-20 md:px-6 md:pb-5">
						<div className="flex items-end gap-3 md:gap-6">
							<HeroPoster media={p.media} className="w-[4.5rem] md:w-32" />
							<Scores {...p} />
						</div>
						<div className="flex flex-col gap-2">
							<SeenScore media={p.media} className="w-full" />
							<ListActions media={p.media} />
						</div>
					</div>
				</div>
				<div className="min-w-0 p-3 md:p-5 lg:border-l lg:border-white/10">
					<Watch {...p} className="" />
				</div>
			</div>
			<Taste {...p} />
		</>
	)
}

export function OverviewVariant({ variant, ...p }: P & { variant: string }) {
	if (variant === "B") return <VariantB {...p} />
	if (variant === "C") return <VariantC {...p} />
	if (variant === "D") return <VariantD {...p} />
	if (variant === "E") return <VariantE {...p} />
	return null
}
