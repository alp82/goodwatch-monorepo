import React from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import fingerprintIcon from "~/img/fingerprint.webp"
import { getDNAForCategory, getSortedCategories } from "~/ui/dna/dna_utils"
import Genres from "~/ui/details/Genres"
import { DNACategory } from "~/ui/dna/DNACategory"
import Pillars from "~/ui/fingerprint/Pillars"
import Badges from "~/ui/fingerprint/Badges"

export interface DetailsFingerprintProps {
	media: MovieResult | ShowResult
}

export default function DetailsFingerprint({
	media,
}: DetailsFingerprintProps) {
	const { fingerprint } = media

	return (
		<div className="md:mt-8 lg:max-w-lg space-y-6">
			<h2 className="flex items-center gap-2 text-2xl font-bold">
				<img
					src={fingerprintIcon}
					className="h-7 p-0.5 w-auto bg-amber-950/50"
					alt="Fingerprint Icon"
				/>
				Fingerprint
			</h2>
			
			<div className="space-y-4">
				<Pillars pillars={fingerprint?.pillars} className={!fingerprint ? 'opacity-50' : ''} />
				{!fingerprint && (
					<p className="text-sm text-gray-500 italic">
						Fingerprint not yet available
					</p>
				)}
			</div>
		</div>
	)
}
