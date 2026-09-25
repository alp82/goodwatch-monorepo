// PROTOTYPE — round 2 score-area layouts. Lives only on the prototype/score-area branch.
// Every variant uses the production ScoreRing, rating chips, rate button, and episode-ratings
// chip as they look today, and only changes where they sit, how they group, and their size step.
// The top bar variants use a container query, so the backdrop panel's own width (wide at 1280,
// narrow at 768 beside the poster, and the phone card) picks the arrangement.
import EpisodeGridLink from "~/ui/details/hero/EpisodeGridLink"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { Chips, EpisodesText, GLASS, HeroFrame, RateBtn, type VariantProps } from "./shared"

const TOP_BAR = `@container relative z-30 px-4 pt-1 md:m-3 md:py-3 ${GLASS}`

// 1 — Action cluster: ring left, the badges in one tidy row, and Episode ratings plus Rate
// grouped on the right at one shared height. Narrow: ring, badges, then the two actions as a pair.
export function Variant1ActionCluster(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	const top = (
		<div className={TOP_BAR}>
			<div className="flex flex-col gap-4 @[50rem]:flex-row @[50rem]:items-center @[50rem]:gap-5">
				<ScoreRing media={media} size={52} />
				<Chips media={media} layout="fill" className="@[50rem]:flex @[50rem]:items-center" />
				<div className={`grid gap-2 @[50rem]:ml-auto @[50rem]:flex @[50rem]:items-center ${hasEpisodeGrid ? "grid-cols-2" : "grid-cols-1"}`}>
					{hasEpisodeGrid && (
						<div className="[&>a]:h-11 [&>a]:w-full [&>a]:justify-center @[50rem]:[&>a]:h-9">
							<EpisodeGridLink />
						</div>
					)}
					<RateBtn media={media} size="md" className="@[50rem]:[&>button]:h-9 @[50rem]:[&>button]:text-sm" />
				</div>
			</div>
		</div>
	)
	return <HeroFrame {...p} top={top} />
}

// 2 — Poster stack: the score block leaves the backdrop and stacks under the poster: ring,
// badges, Rate, then Episode ratings as a text link. The backdrop shows uncovered at the top.
export function Variant2PosterStack(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	const stack = (
		<div className="flex flex-col gap-3">
			<ScoreRing media={media} size={52} />
			<Chips media={media} size="sm" layout="fill" />
			<RateBtn media={media} align="left" />
			{hasEpisodeGrid && <EpisodesText className="self-center" />}
		</div>
	)
	const phone = <div className="px-4 pt-4 md:hidden">{stack}</div>
	return <HeroFrame {...p} height="auto" top={phone} posterBelow={<div className="pt-1">{stack}</div>} />
}

// 3 — Big ring: the ring one size step up and dominant, the badges one step down in a single
// line beneath it with Episode ratings as a text link; Rate stays on the right.
export function Variant3BigRing(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	const top = (
		<div className={`${TOP_BAR} md:py-4`}>
			<div className="flex flex-col gap-4 @[40rem]:flex-row @[40rem]:items-center">
				<div className="flex min-w-0 flex-col gap-3">
					<ScoreRing media={media} size={84} />
					<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
						<Chips media={media} size="sm" layout="row" hideEmpty />
						{hasEpisodeGrid && <EpisodesText />}
					</div>
				</div>
				<RateBtn media={media} className="@[40rem]:ml-auto @[40rem]:self-start" />
			</div>
		</div>
	)
	return <HeroFrame {...p} top={top} />
}

// 4 — Quiet pill: the badges grouped in one dark segmented container at the Rate button's
// height, with Episode ratings as the last segment. Narrow: the pill spans the width.
export function Variant4QuietPill(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	const top = (
		<div className={TOP_BAR}>
			<div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-4 @[50rem]:grid-cols-[auto_1fr_auto] @[50rem]:gap-x-5">
				<ScoreRing media={media} size={52} />
				<RateBtn media={media} className="@[50rem]:col-start-3 @[50rem]:row-start-1" />
				<div className="col-span-2 flex flex-col gap-2 rounded-lg bg-black/45 p-1 ring-1 ring-white/10 @[50rem]:col-span-1 @[50rem]:col-start-2 @[50rem]:row-start-1 @[50rem]:flex-row @[50rem]:items-center @[50rem]:justify-self-start">
					<Chips media={media} layout="fill" className="@[50rem]:flex @[50rem]:items-center @[50rem]:gap-1" />
					{hasEpisodeGrid && (
						<>
							<span aria-hidden="true" className="hidden h-6 w-px bg-white/15 @[50rem]:block" />
							<div className="[&>a]:w-full [&>a]:justify-center [&>a]:bg-transparent [&>a]:hover:bg-white/10">
								<EpisodeGridLink />
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	)
	return <HeroFrame {...p} top={top} />
}

// 5 — Title strip: the score row moves off the backdrop onto the page, directly under the title
// and beside the poster. On phones it comes before the trailer banner.
export function Variant5TitleStrip(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	const strip = (
		<div className="@container px-1 md:px-0">
			<div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 @[50rem]:grid-cols-[auto_1fr_auto] @[50rem]:gap-x-5">
				<ScoreRing media={media} size={52} />
				<RateBtn media={media} className="@[50rem]:col-start-3 @[50rem]:row-start-1" />
				<div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-2 @[50rem]:col-span-1 @[50rem]:col-start-2 @[50rem]:row-start-1">
					<Chips media={media} layout="fill" className="w-full @[50rem]:flex @[50rem]:w-auto @[50rem]:items-center" />
					{hasEpisodeGrid && <EpisodeGridLink />}
				</div>
			</div>
		</div>
	)
	return <HeroFrame {...p} height="min" abovePanel={strip} />
}

// 6 — Compact line: everything one size step down. Wide panel: one line. Tablet panel: ring and
// Rate, then badges and the episodes link. Phone: ring and Rate, badges in equal columns, link.
export function Variant6CompactLine(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	const top = (
		<div className={`@container relative z-30 px-4 pt-1 md:m-3 md:px-3 md:py-2 ${GLASS}`}>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3 @[50rem]:flex-nowrap">
				<ScoreRing media={media} size={40} />
				<RateBtn media={media} size="sm" className="ml-auto @[50rem]:order-last" />
				<div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 @[50rem]:w-auto">
					<Chips media={media} size="sm" layout="fill" className="w-full md:flex md:w-auto md:items-center" />
					{hasEpisodeGrid && <EpisodesText className="md:ml-1" />}
				</div>
			</div>
		</div>
	)
	return <HeroFrame {...p} top={top} />
}

// 7 — Score and Rate: Rate sits right beside the GoodWatch score as one unit (theirs, then
// yours), and the badges move to the far right.
export function Variant7ScoreAndRate(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	const top = (
		<div className={TOP_BAR}>
			<div className="flex flex-col gap-4 @[50rem]:flex-row @[50rem]:items-center @[50rem]:gap-5">
				<div className="flex items-center gap-3 @[50rem]:gap-4">
					<ScoreRing media={media} size={52} />
					<span aria-hidden="true" className="hidden h-9 w-px bg-white/15 @[50rem]:block" />
					<RateBtn media={media} align="left" />
				</div>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2 @[50rem]:ml-auto @[50rem]:justify-end">
					<Chips media={media} layout="fill" className="w-full @[50rem]:flex @[50rem]:w-auto @[50rem]:items-center" />
					{hasEpisodeGrid && <EpisodesText />}
				</div>
			</div>
		</div>
	)
	return <HeroFrame {...p} top={top} />
}

// 8 — One panel: the score row joins the where-to-watch glass at the bottom, so the backdrop
// is uncovered at the top and everything you act on sits in one place.
export function Variant8OnePanel(p: VariantProps) {
	const { media, hasEpisodeGrid } = p
	const row = (
		<div className="@container">
			<div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-3 @[50rem]:grid-cols-[auto_1fr_auto] @[50rem]:gap-x-5">
				<ScoreRing media={media} size={52} />
				<RateBtn media={media} className="@[50rem]:col-start-3 @[50rem]:row-start-1" />
				<div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2 @[50rem]:col-span-1 @[50rem]:col-start-2 @[50rem]:row-start-1">
					<Chips media={media} layout="fill" className="w-full @[50rem]:flex @[50rem]:w-auto @[50rem]:items-center" />
					{hasEpisodeGrid && <EpisodesText />}
				</div>
			</div>
			<div className="mt-4 h-px bg-white/10" />
		</div>
	)
	return <HeroFrame {...p} bottomTop={row} />
}
