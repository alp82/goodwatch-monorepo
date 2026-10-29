import type { EpisodeLayout } from "~/domain/tracking/episode-layout"
import { useTitleOpened } from "~/hooks/useTitleOpened"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { GenreRow } from "~/server/genre-row/genre-row.server"
import type { NewPagesHere } from "~/server/new-on-services-page.server"
import type { TitleSides } from "~/server/title-sides.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TitlePage } from "~/ui/details/TitlePage"
import { BelowFoldProvider } from "~/ui/details/below-fold"
import { hasEpisodeGrid } from "~/ui/details/episode-grid/scale"
import { useTitleQuestions } from "~/ui/details/useTitleQuestions"
import { usePublishTitleSubject } from "~/ui/feedback/subject"
import {
	MediaPreferenceProvider,
	useMediaPreference,
} from "~/ui/media-preference/MediaPreference"
import { useTitlePreview } from "~/ui/media-preference/useTitlePreview"
import { type Crumb, titleTrail } from "~/ui/nav/breadcrumb-trail"
import { titlePath } from "~/utils/helpers"
import { canonicalMediaTitle } from "~/utils/media-presentation"
import { REPLAY_TAP_SCRIPT } from "~/utils/replay-tap"

export interface DetailsProps {
	episodeLayout?: EpisodeLayout | null
	media: MovieResult | ShowResult
	country: string
	episodeGrid?: EpisodeGrid | null
	/** Whether the viewer gets the "Talked about now" section. */
	talkedAboutNow?: boolean
	/** Where the title sits in the signed-in member's taste (taste groups). */
	sides?: TitleSides | null
	/** The hub and genre page above the title; the breadcrumb adds the title. */
	breadcrumb?: readonly Crumb[]
	/** Eight titles of the breadcrumb's genre, after the related titles. */
	genreRow?: GenreRow
	/** The brands with a page of new arrivals in the loaded country, for where to watch (#489). */
	newPages?: NewPagesHere
}

export default function Details(props: DetailsProps) {
	useTitleOpened(props.media.mediaType, props.media.details.tmdb_id)
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
	episodeLayout,
	media: loadedMedia,
	country: loadedCountry,
	episodeGrid,
	talkedAboutNow,
	sides,
	breadcrumb = [],
	genreRow,
	newPages,
}: DetailsProps) {
	// The header pair's country and language, picked or saved, over the ones the page loaded with. Until their data
	// is in (or when it fails), the page keeps the loaded title and offers, and where-to-watch says so; a picked
	// language swaps the title, poster, description and tagline when its text is in.
	const preference = useMediaPreference()
	const preview = useTitlePreview({
		media: loadedMedia,
		loadedCountry,
		want: preference.shown,
	})
	const media = preview.media
	const country = preview.offers ? loadedCountry : preference.shown.country
	// Fix mode's questions read the page as shown (ui/feedback).
	usePublishTitleSubject(media, country, episodeGrid)
	const { details } = media
	// Q&A is listed when the title has questions.
	const questions = useTitleQuestions(media, country)

	const trail = titleTrail(
		breadcrumb,
		details.title,
		titlePath(media.mediaType, details.tmdb_id, canonicalMediaTitle(details)),
	)

	return (
		<>
			{/* Remembers a tap on a control that comes before the app's script. Before every control it serves. */}
			{/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant script, see utils/replay-tap.ts */}
			<script dangerouslySetInnerHTML={{ __html: REPLAY_TAP_SCRIPT }} />
			<TitlePage
				media={media}
				country={country}
				shownCountry={preference.shown.country}
				offersPreview={preview.offers ?? null}
				textPreview={preview.text ?? null}
				episodeGrid={hasEpisodeGrid(episodeGrid) ? episodeGrid : null}
				episodeLayout={episodeLayout}
				questions={questions}
				genreRow={genreRow}
				newPages={newPages}
				sides={sides ?? null}
				talkedAboutNow={Boolean(talkedAboutNow)}
				trail={trail}
			/>
		</>
	)
}
