import React from "react"
import DetailsContent from "~/ui/details/DetailsContent"
import DetailsSideNav from "~/ui/details/DetailsSideNav"
import { sections } from "~/ui/details/sections"
import DetailsHeader from "~/ui/details/DetailsHeader"
import DetailsOverview from "~/ui/details/DetailsOverview"
import DetailsRatings from "~/ui/details/DetailsRatings"
import DetailsStreaming from "~/ui/details/DetailsStreaming"
import { useScrollSections } from "~/utils/scroll"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

export interface DetailsProps {
	media: MovieResult | ShowResult
	country: string
}

export default function Details({ media, country }: DetailsProps) {
	const { details } = media
	const { backdrop_path } = details
	const backdropUrl = `https://www.themoviedb.org/t/p/w1920_and_h800_multi_faces/${backdrop_path}`

	// Scroll Sections
	const { activeSections, sectionProps, navigateToSection } = useScrollSections(
		{
			sections,
		},
	)

	return (
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

			<DetailsOverview media={media} sectionProps={sectionProps} />

			<DetailsRatings details={details} sectionProps={sectionProps} />

			<DetailsStreaming
				media={media}
				country={country}
				sectionProps={sectionProps}
				navigateToSection={navigateToSection}
			/>

			<div className="isolate flex flex-col items-center">
				<div className="px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
					<DetailsContent
						media={media}
						country={country}
						sectionProps={sectionProps}
						navigateToSection={navigateToSection}
					/>
				</div>
			</div>
		</>
	)
}
