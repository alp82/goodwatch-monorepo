import DetailsWatchability from "~/ui/discovery/DetailsWatchability"
import type { SectionIds } from "~/ui/details/sections"
import type { Section, SectionProps } from "~/utils/scroll"
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
	return (
		<div id="streaming">
			<div className="relative max-w-7xl mx-2 xl:mx-auto my-8">
				<h2 className="ml-4 mb-2 text-2xl font-bold">Where to Watch</h2>
				<div className="rounded-xl bg-gray-700/50">
					<DetailsWatchability
						media={{ ...media.details, media_type: media.mediaType }}
						country={country}
					/>
				</div>
			</div>
		</div>
	)
}
