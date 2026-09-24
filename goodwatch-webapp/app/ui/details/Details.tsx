import React, { useState } from "react"
import DetailsContent from "~/ui/details/DetailsContent"
import DetailsSideNav from "~/ui/details/DetailsSideNav"
import { sections } from "~/ui/details/sections"
import DetailsHeader from "~/ui/details/DetailsHeader"
import DetailsFingerprint from "~/ui/details/DetailsFingerprint"
import DetailsOverview from "~/ui/details/DetailsOverview"
import DetailsRatings from "~/ui/details/DetailsRatings"
import DetailsStreaming from "~/ui/details/DetailsStreaming"
import { useScrollSections } from "~/utils/scroll"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { FingerprintBlock } from "~/ui/prototype/FingerprintBlocks"
import { PrototypeSwitcher, usePrototypeVariants } from "~/ui/prototype/FingerprintTextPrototype"
import { HeroSection } from "~/ui/prototype/HeroVariants"

export interface DetailsProps {
	media: MovieResult | ShowResult
	country: string
}

export default function Details({ media, country }: DetailsProps) {
	const [headerHeight, setHeaderHeight] = useState(112)
	const { details } = media
	const { backdrop_path } = details
	const { hero, fp } = usePrototypeVariants()
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

			{hero !== "0" ? (
				<HeroSection
					variant={hero}
					media={media}
					country={country}
					sectionProps={sectionProps}
					navigateToSection={navigateToSection}
				/>
			) : (
				<DetailsOverview media={media} sectionProps={sectionProps} />
			)}

			{hero === "0" && fp === "0" && (
				<div className="isolate flex flex-col items-center">
					<div className="px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
						<div className="flex flex-col lg:flex-row gap-8">
							<div>
								<DetailsFingerprint media={media} />
							</div>
							<div className="w-full flex flex-col justify-between">
								<DetailsRatings media={media} sectionProps={sectionProps} />

								<DetailsStreaming
									media={media}
									country={country}
									sectionProps={sectionProps}
									navigateToSection={navigateToSection}
								/>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* PROTOTYPE: current ratings and streaming side by side when only the fingerprint changes */}
			{hero === "0" && fp !== "0" && (
				<div className="isolate max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-x-8">
					<DetailsRatings media={media} sectionProps={sectionProps} />
					<DetailsStreaming
						media={media}
						country={country}
						sectionProps={sectionProps}
						navigateToSection={navigateToSection}
					/>
				</div>
			)}

			{fp !== "0" && (
				<div className="isolate">
					<FingerprintBlock variant={fp} media={media} />
				</div>
			)}

			{hero !== "0" && fp === "0" && (
				<div className="isolate max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<DetailsFingerprint media={media} />
				</div>
			)}

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
			<PrototypeSwitcher />
		</>
	)
	return content
}
