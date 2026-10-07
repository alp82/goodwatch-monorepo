import React, { useMemo } from "react"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import About from "~/ui/details/About"
import Actors from "~/ui/details/Actors"
import Crew from "~/ui/details/Crew"
import DetailsQuestions from "~/ui/details/DetailsQuestions"
import DetailsRelated from "~/ui/details/DetailsRelated"
import Media from "~/ui/details/Media"
import SequelsPrequelsFranchise from "~/ui/details/SequelsPrequelsFranchise"
import { belowFoldProps, useBelowFold } from "~/ui/details/below-fold"
import EpisodeGrid from "~/ui/details/episode-grid/EpisodeGrid"
import { hasEpisodeGrid } from "~/ui/details/episode-grid/scale"
import {
	type ReservedHeight,
	aboutHeight,
	actorsHeight,
	crewHeight,
	episodeGridHeight,
	mediaHeight,
	questionsHeight,
	relatedHeight,
	sequelsHeight,
} from "~/ui/details/section-heights"
import type { SectionIds } from "~/ui/details/sections"
import { titleQuestions } from "~/ui/details/titleQuestions"
// PROTOTYPE (native-scroll carousels): everything from ui/prototype-carousels is throwaway.
import ActorsNative from "~/ui/prototype-carousels/ActorsNative"
import DiveSection from "~/ui/prototype-carousels/DiveSection"
import Explore1Constellation from "~/ui/prototype-carousels/Explore1Constellation"
import Explore2Clusters from "~/ui/prototype-carousels/Explore2Clusters"
import Explore3Walk from "~/ui/prototype-carousels/Explore3Walk"
import Explore4Chips from "~/ui/prototype-carousels/Explore4Chips"
import Explore5Map from "~/ui/prototype-carousels/Explore5Map"
import { NativeRowAssets } from "~/ui/prototype-carousels/NativeRow"
import { PrototypeSwitcher } from "~/ui/prototype-carousels/PrototypeSwitcher"
import RelatedExplore from "~/ui/prototype-carousels/RelatedExplore"
import RelatedList from "~/ui/prototype-carousels/RelatedList"
import RelatedRowsNative from "~/ui/prototype-carousels/RelatedRowsNative"
import RingSection from "~/ui/prototype-carousels/RingSection"
import WalkSection from "~/ui/prototype-carousels/WalkSection"
import { useCarouselPrototype } from "~/ui/prototype-carousels/variant"
import Ratings from "~/ui/ratings/Ratings"
import Streaming from "~/ui/streaming/Streaming"
import { extractRatings } from "~/utils/ratings"
import type { PropsForSection, Section, SectionProps } from "~/utils/scroll"

export interface DetailsContentProps {
	media: MovieResult | ShowResult
	country: string
	episodeGrid?: EpisodeGridData | null
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (section: Section) => void
}

export default function DetailsContent({
	media,
	country,
	episodeGrid,
	sectionProps,
	navigateToSection,
}: DetailsContentProps) {
	const { details, cast, cast_total, crew, videos } = media
	const questions = useMemo(
		() => titleQuestions(media, country),
		[media, country],
	)
	// Every section here starts below the first screen, so each one skips its layout until it is near the viewport.
	const { skipping } = useBelowFold()
	const section = (
		reserved: ReservedHeight,
		props?: PropsForSection<SectionIds>,
	) => ({
		...props,
		...belowFoldProps(skipping, reserved, props?.className),
	})

	// PROTOTYPE (native-scroll carousels): null on today's page.
	const variant = useCarouselPrototype()?.variant
	const native = variant !== undefined && variant !== "today"
	const CastRow = native ? ActorsNative : Actors
	// Measured at 412 and 1,350 px wide on The Matrix and Breaking Bad.
	const castReserve = (reserved: ReservedHeight): ReservedHeight =>
		native && reserved.phone ? { phone: 212, desktop: 244 } : reserved
	// The second round's forms and the height each one reserves, measured the same way.
	const explore = {
		explore1: { form: Explore1Constellation, phone: 704, desktop: 610 },
		explore2: { form: Explore2Clusters, phone: 498, desktop: 335 },
		explore3: { form: Explore3Walk, phone: 522, desktop: 416 },
		explore4: { form: Explore4Chips, phone: 401, desktop: 366 },
		explore5: { form: Explore5Map, phone: 668, desktop: 623 },
		// The third round's forms: one component, and the same height for all five by design.
		walk1: { form: WalkSection, phone: 590, desktop: 582 },
		walk2: { form: WalkSection, phone: 590, desktop: 582 },
		walk3: { form: WalkSection, phone: 590, desktop: 614 },
		walk4: { form: WalkSection, phone: 590, desktop: 582 },
		walk5: { form: WalkSection, phone: 590, desktop: 582 },
		// The fourth round's forms, at the third round's heights.
		dive1: { form: DiveSection, phone: 590, desktop: 582 },
		dive2: { form: DiveSection, phone: 590, desktop: 582 },
		dive3: { form: DiveSection, phone: 590, desktop: 614 },
		dive4: { form: DiveSection, phone: 590, desktop: 582 },
		dive5: { form: DiveSection, phone: 590, desktop: 582 },
		// The fifth round's forms. Each has its own fixed height, measured the same way.
		ring1: { form: RingSection, phone: 590, desktop: 582 },
		ring2: { form: RingSection, phone: 590, desktop: 582 },
		ring3: { form: RingSection, phone: 589, desktop: 586 },
		ring4: { form: RingSection, phone: 589, desktop: 586 },
		ring5: { form: RingSection, phone: 590, desktop: 582 },
		ring6: { form: RingSection, phone: 503, desktop: 465 },
		ring7: { form: RingSection, phone: 590, desktop: 582 },
		ring8: { form: RingSection, phone: 510, desktop: 484 },
		ring9: { form: RingSection, phone: 586, desktop: 577 },
	}[variant as string]
	const relatedReserve = (reserved: ReservedHeight): ReservedHeight =>
		!reserved.phone
			? reserved
			: explore
				? { phone: explore.phone, desktop: explore.desktop }
				: variant === "list"
					? { phone: 1470, desktop: 880 }
					: variant === "explore"
						? { phone: 736, desktop: 632 }
						: reserved
	const Related = explore
		? explore.form
		: variant === "rows"
			? RelatedRowsNative
			: variant === "list"
				? RelatedList
				: variant === "explore"
					? RelatedExplore
					: DetailsRelated

	return (
		<div className="flex flex-col gap-12">
			{variant && <PrototypeSwitcher variant={variant} />}
			{native && <NativeRowAssets />}
			{hasEpisodeGrid(episodeGrid) && (
				<div {...section(episodeGridHeight(episodeGrid))}>
					<EpisodeGrid grid={episodeGrid} />
				</div>
			)}
			{/*<div>*/}
			{/*	<Streaming*/}
			{/*		details={details}*/}
			{/*		media_type={media_type}*/}
			{/*		links={streaming_links}*/}
			{/*		currentCountryCode={country}*/}
			{/*		countryCodes={streaming_country_codes}*/}
			{/*	/>*/}
			{/*</div>*/}
			<div {...section(aboutHeight(), sectionProps.about)}>
				<About media={media} navigateToSection={navigateToSection} />
			</div>
			<div
				{...section(
					castReserve(actorsHeight(media)),
					sectionProps.actors_and_crew,
				)}
			>
				<CastRow
					cast={cast}
					total={cast_total}
					mediaType={media.mediaType}
					tmdbId={details.tmdb_id}
				/>
			</div>
			<div {...section(crewHeight(media))}>
				<Crew crew={crew} />
			</div>
			<div
				{...section(relatedReserve(relatedHeight(media)), sectionProps.related)}
			>
				<Related media={media} />
			</div>
			<div {...section(sequelsHeight(media))}>
				<SequelsPrequelsFranchise media={media} />
			</div>
			<div {...section(mediaHeight(media), sectionProps.media)}>
				<Media
					videos={videos || []}
					title={details.title}
					backdropPath={details.backdrop_path}
				/>
			</div>
			<div {...section(questionsHeight(questions.length), sectionProps.faq)}>
				<DetailsQuestions
					media={media}
					country={country}
					questions={questions}
				/>
			</div>
		</div>
	)
}
