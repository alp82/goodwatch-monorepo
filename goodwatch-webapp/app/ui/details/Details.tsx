import React from "react"
import DetailsContent from "~/ui/details/DetailsContent"
import DetailsSideNav from "~/ui/details/DetailsSideNav"
import { sections } from "~/ui/details/sections"
import DetailsHeader from "~/ui/details/DetailsHeader"
import DetailsFingerprint from "~/ui/details/DetailsFingerprint"
import DetailsHero from "~/ui/details/hero/DetailsHero"
// PROTOTYPE - throwaway (seen-score): ?variant= swaps the hero for a variant.
import PrototypeHero, { SEEN_SCORE_VARIANTS, type SeenScoreVariant } from "~/ui/details/hero/prototype-seen-score/PrototypeHero"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { useSearchParams } from "@remix-run/react"
import { useScrollSections } from "~/utils/scroll"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { hasEpisodeGrid } from "~/ui/details/episode-grid/scale"
import { BelowFoldProvider, useBelowFold } from "~/ui/details/below-fold"
import type { Section } from "~/utils/scroll"
import { REPLAY_TAP_SCRIPT } from "~/utils/replay-tap"
import {
	MediaPreferenceProvider,
	useMediaPreference,
} from "~/ui/media-preference/MediaPreference"
import type { TitleSides } from "~/server/title-sides.server"
import { useTitlePreview } from "~/ui/media-preference/useTitlePreview"
import { TalkedAboutNowSlot } from "~/ui/talked-about-now/TalkedAboutNowSlot"

export interface DetailsProps {
	media: MovieResult | ShowResult
	country: string
	episodeGrid?: EpisodeGrid | null
	/** Whether the viewer gets the "Talked about now" section. */
	talkedAboutNow?: boolean
	/** Where the title sits in the signed-in member's taste (taste groups). */
	sides?: TitleSides | null
}

export default function Details(props: DetailsProps) {
	const { details } = props.media
	return (
		<BelowFoldProvider titleKey={`${props.media.mediaType}-${details.tmdb_id}`}>
			{/* One per title: a preview and its question never carry over to the next title. */}
			<MediaPreferenceProvider
				key={`${props.media.mediaType}-${details.tmdb_id}`}
				country={props.country}
			>
				<DetailsPage {...props} />
			</MediaPreferenceProvider>
		</BelowFoldProvider>
	)
}

function DetailsPage({
	media: loadedMedia,
	country: loadedCountry,
	episodeGrid,
	talkedAboutNow,
	sides,
}: DetailsProps) {
	// The header pair's country and language, picked or saved, over the ones the page loaded with. Until their data
	// is in (or when it fails), the page keeps the loaded title and offers, and where-to-watch says so; a picked
	// language swaps the title, poster, description and tagline when its text is in.
	const preference = useMediaPreference()
	const [protoParams] = useSearchParams()
	const protoKey = protoParams.get("variant") ?? "live"
	const protoVariant = (protoKey in SEEN_SCORE_VARIANTS ? protoKey : "live") as SeenScoreVariant | "live"
	const preview = useTitlePreview({
		media: loadedMedia,
		loadedCountry,
		want: preference.shown,
	})
	const media = preview.media
	const country = preview.offers ? loadedCountry : preference.shown.country
	const { details } = media
	const { backdrop_path } = details
	// Blurred by 64 px across the whole page, so the smallest backdrop is enough.
	const backdropUrl = backdrop_path ? tmdbImageUrl(backdrop_path, "w300") : ""

	// Scroll Sections. Which sections are on screen is not state of this component, so that the observer's reports
	// render the two navigations and not the whole page.
	const {
		activeSections,
		sectionProps,
		navigateToSection: scrollToSection,
	} = useScrollSections({
		sections,
	})
	// A section's place is exact only when every section above it is laid out.
	const { layOutAll } = useBelowFold()
	const navigateToSection = (section: Section) => {
		layOutAll()
		scrollToSection(section)
	}

	const content = (
		<>
			{/* Remembers a tap on a control that comes before the app's script. Before every control it serves. */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script, see utils/replay-tap.ts */}
			<script dangerouslySetInnerHTML={{ __html: REPLAY_TAP_SCRIPT }} />
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
				media={media}
				country={country}
				activeSections={activeSections}
				navigateToSection={navigateToSection}
				textPreview={preview.text}
			/>

			<DetailsSideNav
				activeSections={activeSections}
				navigateToSection={navigateToSection}
			/>

			{protoVariant !== "live" && (
				<PrototypeHero
					variant={protoVariant}
					media={media}
					country={country}
					shownCountry={preference.shown.country}
					preview={preview.offers}
					episodeGrid={hasEpisodeGrid(episodeGrid) ? episodeGrid : null}
					sectionProps={sectionProps}
					sides={sides}
				/>
			)}
			<PrototypeSwitcher variants={SEEN_SCORE_VARIANTS} position="bottom-[calc(var(--nav-dock-height,0px)+0.75rem)] left-1/2 -translate-x-1/2 max-md:scale-90 lg:bottom-6" />
			{protoVariant === "live" && <DetailsHero
				media={media}
				country={country}
				shownCountry={preference.shown.country}
				preview={preview.offers}
				episodeGrid={hasEpisodeGrid(episodeGrid) ? episodeGrid : null}
				sectionProps={sectionProps}
				sides={sides}
			/>}

			<div className="isolate">
				<DetailsFingerprint
					media={media}
					sectionProps={sectionProps.fingerprint}
				/>
			</div>

			{talkedAboutNow && <TalkedAboutNowSlot media={media} />}

			<div className="isolate flex flex-col items-center">
				<div className="px-4 sm:px-6 lg:px-8 w-full max-w-7xl">
					<DetailsContent
						media={media}
						country={country}
						episodeGrid={episodeGrid}
						sectionProps={sectionProps}
						navigateToSection={navigateToSection}
					/>
				</div>
			</div>
		</>
	)
	return content
}
