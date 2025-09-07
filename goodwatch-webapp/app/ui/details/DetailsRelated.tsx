import React from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import RelatedTitles from "~/ui/details/RelatedTitles"

export interface DetailsRelatedProps {
    media: MovieResult | ShowResult
}

export default function DetailsRelated({ media }: DetailsRelatedProps) {
	const { fingerprint } = media

	if (!fingerprint?.highlightKeys || fingerprint.highlightKeys.length === 0) {
		return null
	}

	return (
		<div className="flex flex-col gap-16">
			{fingerprint.highlightKeys.map((highlightKey) => (
				<RelatedTitles
					key={highlightKey}
					media={media}
					fingerprintKey={highlightKey}
				/>
			))}
		</div>
	)
}
