import React, { useState } from "react"
import DetailsContent from "~/ui/details/DetailsContent"
import DetailsSideNav from "~/ui/details/DetailsSideNav"
import { sections } from "~/ui/details/sections"
import DetailsHeader from "~/ui/details/DetailsHeader"
import DetailsFingerprint from "~/ui/details/DetailsFingerprint"
import DetailsHero from "~/ui/details/hero/DetailsHero"
import { useScrollSections } from "~/utils/scroll"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { EpisodeGrid } from "~/server/episode-grid.server"

export interface DetailsProps {
	media: MovieResult | ShowResult
	country: string
	episodeGrid?: EpisodeGrid | null
}

export default function Details({ media, country, episodeGrid }: DetailsProps) {
	const [headerHeight, setHeaderHeight] = useState(112)
	const { details } = media
	const { backdrop_path } = details
	const backdropUrl = `https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}`

	// Scroll Sections
	const { activeSections, sectionProps, navigateToSection } = useScrollSections(
		{
			sections,
		},
	)

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
				onHeightChange={setHeaderHeight}
				media={media}
				country={country}
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>

			<DetailsSideNav
				headerHeight={headerHeight}
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>

			<DetailsHero
				media={media}
				country={country}
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
