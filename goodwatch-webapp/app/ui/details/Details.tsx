import React from "react"
import DetailsContent from "~/ui/details/DetailsContent"
import DetailsSideNav from "~/ui/details/DetailsSideNav"
import { sections } from "~/ui/details/sections"
import DetailsHeader from "~/ui/details/DetailsHeader"
import DetailsFingerprint from "~/ui/details/DetailsFingerprint"
import DetailsHero from "~/ui/details/hero/DetailsHero"
import { useScrollSections } from "~/utils/scroll"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { hasEpisodeGrid } from "~/ui/details/episode-grid/scale"
import { BelowFoldProvider, useBelowFold } from "~/ui/details/below-fold"
import type { Section } from "~/utils/scroll"

export interface DetailsProps {
	media: MovieResult | ShowResult
	country: string
	episodeGrid?: EpisodeGrid | null
}

export default function Details(props: DetailsProps) {
	const { details } = props.media
	return (
		<BelowFoldProvider titleKey={`${props.media.mediaType}-${details.tmdb_id}`}>
			<DetailsPage {...props} />
		</BelowFoldProvider>
	)
}

function DetailsPage({ media, country, episodeGrid }: DetailsProps) {
	const { details } = media
	const { backdrop_path } = details
	// Blurred by 64 px across the whole page, so the smallest backdrop is enough.
	const backdropUrl = backdrop_path ? tmdbImageUrl(backdrop_path, "w300") : ""

	// Scroll Sections. Which sections are on screen is not state of this component, so that the observer's reports
	// render the two navigations and not the whole page.
	const {
		activeSections,
		sectionProps,
		navigateToSection: scrollToSection,
	} = useScrollSections({
		sections,
	})
	// A section's place is exact only when every section above it is laid out.
	const { layOutAll } = useBelowFold()
	const navigateToSection = (section: Section) => {
		layOutAll()
		scrollToSection(section)
	}

	const content = (
		<>
			{backdrop_path && (
				<div
					className="pointer-events-none absolute top-0 z-0 w-full h-full"
					aria-hidden="true"
					style={{
						backgroundImage: `url(${backdropUrl})`,
						backgroundSize: "cover",
						backgroundPosition: "center",
						filter: "blur(64px) brightness(0.17)",
					}}
				/>
			)}

			<DetailsHeader
				media={media}
				country={country}
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>

			<DetailsSideNav
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>

			<DetailsHero
				media={media}
				country={country}
				episodeGrid={hasEpisodeGrid(episodeGrid) ? episodeGrid : null}
				sectionProps={sectionProps}
				navigateToSection={navigateToSection}
			/>

			<div className="isolate">
				<DetailsFingerprint media={media} sectionProps={sectionProps.fingerprint} />
			</div>

			<div className="isolate flex flex-col items-center">
				<div className="px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
					<DetailsContent
						media={media}
						country={country}
						episodeGrid={episodeGrid}
						sectionProps={sectionProps}
						navigateToSection={navigateToSection}
					/>
				</div>
			</div>
		</>
	)
	return content
}
