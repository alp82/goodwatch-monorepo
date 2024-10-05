import React, { useEffect, useState } from "react"
import { Spoiler } from "spoiled"
import type { DNA } from "~/server/details.server"
import type { ExploreParams } from "~/server/explore.server"
import InfoBox from "~/ui/InfoBox"
import DNACategory from "~/ui/dna/DNACategory"
import { DNATag } from "~/ui/dna/DNATag"
import {
	getCategoryColor,
	getSortedCategories,
	spoilerCategories,
} from "~/ui/dna/utils"

export interface DNAProps {
	type: ExploreParams["type"]
	dna: DNA
}

export default function DNA({ type, dna = {} }: DNAProps) {
	// const hasDNA = Object.keys(dna).length > 0
	const [hasDNA, setHasDNA] = useState(false)

	useEffect(() => {
		if (Object.keys(dna).length > 0) setHasDNA(true)
	}, [])
	const sortedCategories = getSortedCategories(dna)

	const [spoilerVisible, setSpoilerVisible] = React.useState(false)
	const handleRevealSpoiler = () => {
		setSpoilerVisible(true)
	}

	return (
		<div>
			<h2 className="text-2xl font-bold">DNA</h2>
			<p className="mt-2 mb-8 text-lg">
				Explore similar movies and shows based on the categories below.
			</p>
			{hasDNA ? (
				<div className="mt-4">
					{sortedCategories.map((category) => (
						<DNACategory
							key={category}
							category={category}
							tags={dna[category]}
							spoilerVisible={spoilerVisible}
							onRevealSpoiler={handleRevealSpoiler}
						/>
					))}
				</div>
			) : (
				<InfoBox text="No DNA found for this title. Please try again later, we are working on it." />
			)}
			{hasDNA ? (
				<div className="mt-4">
					{sortedCategories.map((category) => {
						const isSpoiler = spoilerCategories.includes(category)
						return (
							<dl key={category} className="divide-y divide-white/10">
								<div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
									<dt className="text-sm font-medium leading-6 text-white">
										{category}
									</dt>
									<dd
										className={`
										mt-1 text-sm leading-6 text-gray-400 sm:col-span-2 sm:mt-0 flex flex-wrap gap-2
										${spoilerCategories.includes(category) && !spoilerVisible ? "cursor-pointer" : ""}
									`}
										onClick={
											spoilerCategories.includes(category)
												? handleRevealSpoiler
												: undefined
										}
										onKeyDown={() => null}
									>
										{dna[category].map((label) => (
											<Spoiler
												key={label}
												hidden={isSpoiler && !spoilerVisible}
												theme="dark"
												accentColor={"#55c8f7"}
												density={0.15}
											>
												<DNATag
													category={category}
													label={label}
													linkDisabled={isSpoiler && !spoilerVisible}
												/>
											</Spoiler>
										))}
									</dd>
								</div>
							</dl>
						)
					})}
				</div>
			) : (
				<InfoBox text="No DNA found for this title. Please try again later, we are working on it." />
			)}
		</div>
	)
}
