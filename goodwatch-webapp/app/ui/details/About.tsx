import React from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import Description from "~/ui/details/Description"
import Badges from "~/ui/fingerprint/Badges"
import type { Section } from "~/utils/scroll"
import { NewspaperIcon } from "@heroicons/react/24/outline"

export interface AboutProps {
	media: MovieResult | ShowResult
	navigateToSection: (section: Section) => void
}

export default function About({ media, navigateToSection }: AboutProps) {
	const { details, fingerprint } = media
	const { synopsis, tagline } = details
	const { essenceTags } = fingerprint

	const badges = essenceTags.map(tag => ({ label: tag }))
	return (
		<>
			<h2 className="mt-12 flex items-center gap-2 text-2xl font-bold">
				{/* <NewspaperIcon className="h-7 p-0.5 w-auto" /> */}
				About
			</h2>
			{tagline && (
				<div className="my-4">
					<blockquote className="relative border-l-4 lg:border-l-8 border-gray-700 bg-gray-800/50 py-2 pl-4 sm:pl-6">
						<p className="text-white italic text-sm xs:text-md sm:text-base md:text-lg">
							{tagline}
						</p>
					</blockquote>
				</div>
			)}
			<Description description={synopsis} />
			<Badges badges={badges} />
			{/*<div className="pt-4">*/}
			{/*	<DNAPreview dna={dna} navigateToSection={navigateToSection} />*/}
			{/*</div>*/}
		</>
	)
}
