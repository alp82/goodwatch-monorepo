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
	const { essenceTags = [] } = fingerprint || {}

	const badges = essenceTags.map(tag => ({ label: tag }))
	return (
		<section className="mt-12 rounded-xl border border-white/3 bg-white/3 p-4 sm:p-6 backdrop-blur-sm">
			<h2 className="flex items-center gap-3 text-2xl font-bolds">
				About
			</h2>

			{tagline && (
				<div className="mt-4">
					<blockquote className="relative rounded-lg border border-l-8 border-white/10 bg-white/5 p-4 sm:p-5">
						<p className="text-white/90 italic text-base sm:text-lg leading-relaxed">
							{tagline}
						</p>
					</blockquote>
				</div>
			)}

			<div className="mt-4 text-gray-100">
				<Description description={synopsis} />
			</div>

			<div className="mt-6">
				<Badges badges={badges} />
			</div>
		</section>
	)
}
