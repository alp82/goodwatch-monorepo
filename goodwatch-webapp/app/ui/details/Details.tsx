import React from "react"
import type { MovieDetails, TVDetails } from "~/server/details.server"
import DetailsContent from "~/ui/details/DetailsContent"
import DetailsInlineNav from "~/ui/details/DetailsInlineNav"
import DetailsOverview from "~/ui/details/DetailsOverview"
import DetailsSideNav from "~/ui/details/DetailsSideNav"
import { sections } from "~/ui/details/common"
import { useScrollSections } from "~/utils/scroll"

export interface DetailsProps {
	details: MovieDetails | TVDetails
	country: string
}

export default function Details({ details, country }: DetailsProps) {
	// Scroll Sections
	const { activeSections, sectionProps, navigateToSection } = useScrollSections(
		{
			sections,
		},
	)

	return (
		<>
			<DetailsSideNav
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>

			<DetailsOverview
				details={details}
				country={country}
				sectionProps={sectionProps}
				navigateToSection={navigateToSection}
			/>

			<DetailsInlineNav
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>

			<div className="relative flex flex-col items-center">
				<div className="px-4 sm:px-6 lg:px-8 w-full max-w-7xl z-30">
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
