import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import DetailsContent from "~/ui/details/DetailsContent"
import DetailsInlineNav from "~/ui/details/DetailsInlineNav"
import DetailsOverview from "~/ui/details/DetailsOverview"
import DetailsSideNav from "~/ui/details/DetailsSideNav"
import { sections } from "~/ui/details/common"
import { useScrollSections } from "~/utils/scroll"
import DetailsHeader from "~/ui/details/DetailsHeader"
import DetailsMain from "~/ui/details/DetailsMain"

export interface DetailsProps {
	details: MovieDetails | TVDetails
	country: string
}

export default function Details({ details, country }: DetailsProps) {
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
						filter: "blur(28px) brightness(0.15)",
					}}
				/>
			)}

			<DetailsHeader
				details={details}
				activeSections={activeSections}
				navigateToSection={navigateToSection}
				// TODO: wire up isFavorite, onToggleFavorite, rating, onRate as needed
			/>

			<DetailsSideNav
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>

			<DetailsMain
				details={details}
				country={country}
				sectionProps={sectionProps}
				navigateToSection={navigateToSection}
			/>

			{/*<DetailsOverview*/}
			{/*	details={details}*/}
			{/*	country={country}*/}
			{/*	sectionProps={sectionProps}*/}
			{/*	navigateToSection={navigateToSection}*/}
			{/*/>*/}

			<div className="isolate flex flex-col items-center">
				<div className="px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
					<DetailsContent
						details={details}
						country={country}
						sectionProps={sectionProps}
					/>
				</div>
			</div>
		</>
	)
}
