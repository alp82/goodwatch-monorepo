import React from "react"
import type {
	MovieDetails,
	StreamType,
	TVDetails,
} from "~/server/details.server"
import type { SectionIds } from "~/ui/details/sections"
import type { Section, SectionProps } from "~/utils/scroll"
import StreamingBadges from "~/ui/streaming/StreamingBadges"
import CountrySelector from "~/ui/streaming/CountrySelector"
import StreamingTypeSelector from "~/ui/streaming/StreamingTypeSelector"
import { Cog6ToothIcon } from "@heroicons/react/24/solid"
import Appear from "~/ui/fx/Appear"
import tmdb_logo from "~/img/tmdb-logo.svg"
import type { MovieResult, ShowResult } from "~/server/types/details-types"

export interface DetailsStreamingProps {
	media: MovieResult | ShowResult
	country: string
	sectionProps: SectionProps<SectionIds>
	navigateToSection: (section: Section) => void
}

export default function DetailsStreaming({
	media,
	country,
	sectionProps,
	navigateToSection,
}: DetailsStreamingProps) {
	const { details, mediaType, streaming_availabilities } = media
	const { streaming_country_codes } = details

	const [showSelectors, setShowSelectors] = React.useState(false)
	const [streamingType, setStreamingType] =
		React.useState<StreamType>("flatrate")

	return (
		<div {...sectionProps.streaming}>
			<div className="relative max-w-7xl mx-2 xl:mx-auto my-8">
				<h2 className="ml-4 mb-2 flex items-center gap-2 text-2xl font-bold">
					Where to Watch
				</h2>

				<div className="rounded-xl bg-gray-700/50">
					<div className="my-2 py-3 px-4 flex items-center justify-between gap-4">
						<StreamingBadges
							media={media}
							country={country}
							streamTypes={[streamingType]}
						/>
						<button
							className="my-2 p-1 flex items-center text-gray-400 hover:text-gray-200 bg-black/20 hover:bg-black/30 rounded-lg border-2 border-gray-700"
							onClick={() => setShowSelectors((v) => !v)}
							aria-label={showSelectors ? "Hide selectors" : "Show selectors"}
							type="button"
						>
							<Cog6ToothIcon
								className={`w-6 h-6 transition-transform duration-500 ${showSelectors ? "-rotate-90" : ""}`}
							/>
						</button>
					</div>
					<Appear isVisible={showSelectors}>
						<div className="py-3 px-4 flex flex-col gap-2 items-center bg-gray-900/50 border-t-[1px] border-gray-700">
							<div className="pt-4 w-full flex flex-col xs:flex-row gap-2 xs:gap-8 items-center justify-between">
								<StreamingTypeSelector
									value={streamingType}
									onChange={setStreamingType}
								/>
								<CountrySelector
									mediaType={mediaType}
									countryCodes={streaming_country_codes}
									currentCountryCode={country}
									navigateToSection={navigateToSection}
								/>
							</div>
							<div className="h-3 my-2 flex gap-2 items-center text-gray-400">
								<small>Powered by</small>
								<a
									href={
										streaming_availabilities.length
											? streaming_availabilities[0].tmdb_link
											: "https://www.themoviedb.org/"
									}
									target="_blank"
									className=""
									rel="noreferrer"
								>
									<img alt="TMDB" className="h-2 w-auto" src={tmdb_logo} />
								</a>
								<small>and</small>
								<a
									href="https://justwatch.com"
									target="_blank"
									className="ml-0.5 mt-0.5 scale-105"
									data-original="https://www.justwatch.com"
									rel="noreferrer"
								>
									<img
										alt="JustWatch"
										className="h-3 w-16"
										src="https://widget.justwatch.com/assets/JW_logo_color_10px.svg"
									/>
								</a>
							</div>
						</div>
					</Appear>
				</div>
			</div>
		</div>
	)
}
