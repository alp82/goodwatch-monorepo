// The title page's sections in reading order, quick answers first. Sections without content are left out. Each has
// a name, an icon, a one-line gist for "On this page" (and as the header's muted line where the section doesn't show
// the same), the words find also knows it by, and its body. A new topic later is one more entry here.
import {
	BookOpenIcon,
	FingerPrintIcon,
	InformationCircleIcon,
	QuestionMarkCircleIcon,
	SparklesIcon,
	Squares2X2Icon,
	StarIcon,
	TagIcon,
	TvIcon,
	UserGroupIcon,
	VideoCameraIcon,
} from "@heroicons/react/24/outline"
import type { ComponentType, ReactNode } from "react"
import type { EpisodeLayout } from "~/domain/tracking/episode-layout"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { GenreRow } from "~/server/genre-row/genre-row.server"
import type { NewPagesHere } from "~/server/new-on-services-page.server"
import type { TitleSides } from "~/server/title-sides.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import DetailsQuestions from "~/ui/details/DetailsQuestions"
import { EpisodesSection } from "~/ui/details/EpisodesSection"
import { FactsList, TropesList } from "~/ui/details/FactsSection"
import { FingerprintSection } from "~/ui/details/fingerprint-section/FingerprintSection"
import { RelatedSection } from "~/ui/details/RelatedSection"
import { StorySection } from "~/ui/details/StorySection"
import { WatchSection } from "~/ui/details/WatchSection"
import { CastSection } from "~/ui/details/people/CastSection"
import { CrewSection } from "~/ui/details/people/CrewSection"
import { useStreamNames } from "~/ui/details/streaming"
import {
	countryName,
	fingerprintInput,
	lengthWords,
	scoreLines,
	shortList,
	titleFacts,
	tropeNames,
} from "~/ui/details/title-words"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import { summary } from "~/ui/fingerprint/fingerprintText"
import { useRelatedMap } from "~/ui/related-map/RelatedMap"
import { useEpisodeTracking } from "~/ui/tracking/gate"

type Media = MovieResult | ShowResult

export interface TitleSection {
	/** The section element's id (an address with #id lands on it). */
	id: string
	label: string
	icon: ComponentType<{ className?: string }>
	/** The gist in one line, for "On this page". */
	peek: string | null
	/** The header's muted line; none where the section shows the same. */
	subtitle?: string | null
	/** More words find knows the section by. */
	aliases: string
	body: () => ReactNode
	/** Classes for the body wrapper. */
	bodyClass?: string
}

/** Headings of a section's own component become subheadings under the section's header. */
const DEMOTE = "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-200"

export interface TitleSectionsInput {
	media: Media
	country: string
	shownCountry: string
	offersPreview: "loading" | "failed" | null
	episodeGrid: EpisodeGrid | null
	episodeLayout?: EpisodeLayout | null
	questions: TitleQuestion[]
	genreRow?: GenreRow
	newPages?: NewPagesHere
	sides: TitleSides | null
	/** Goes to the Crew section (offered by a cast search that finds no one). */
	onCrew: () => void
}

/** The verdict under the opener: in "On this page" and find, but not a section of its own. */
export function scoresEntry(media: Media) {
	const scores = scoreLines(media)
	return {
		id: "scores",
		label: "Scores",
		icon: StarIcon,
		peek: scores.map((s) => `${s.label} ${s.value}`).join(" · ") || null,
		aliases: "rating watch",
	}
}

export function useTitleSections(input: TitleSectionsInput): TitleSection[] {
	const { media, country, questions, genreRow, episodeGrid } = input
	const d = media.details
	const { stream, rentBuy } = useStreamNames(media, country)
	const relatedMap = Boolean(useRelatedMap())
	const tracking = useEpisodeTracking(media)
	const t = fingerprintInput(media)

	const watchPeek = stream.length
		? `Stream on ${shortList(
				stream.map((s) => s.name),
				3,
			)}`
		: rentBuy.length
			? `Rent or buy on ${shortList(
					rentBuy.map((s) => s.name),
					3,
				)}`
			: `Not available in ${countryName(country)}`

	const best = media.mediaType === "show" ? media.season_summary?.best : null
	const episodesPeek = [
		lengthWords(media),
		best
			? `best: S${best.season}E${best.episode} "${best.name}" ${best.score.toFixed(1)}`
			: null,
	]
		.filter(Boolean)
		.join(" · ")

	const castNames = (media.cast || []).slice(0, 3).map((c) => c.name)
	const director = media.crew.directors[0]?.name
	const writer = media.crew.writers[0]?.name
	const crewPeek = [
		director
			? `${media.mediaType === "movie" ? "Directed by" : "Directors"} ${director}`
			: null,
		writer ? `written by ${writer}` : null,
	]
		.filter(Boolean)
		.join(", ")

	const firstSentence = (d.synopsis || "").split(/(?<=[.!?])\s/)[0]
	const tropes = tropeNames(media).names
	const facts = titleFacts(media, country)
	const series = media.mediaType === "movie" && Boolean(media.movie_series)

	const sections: (TitleSection | null)[] = [
		{
			id: "watch",
			label: "Where to watch",
			icon: TvIcon,
			peek: watchPeek,
			aliases: "watch stream",
			body: () => (
				<WatchSection
					media={media}
					country={country}
					shownCountry={input.shownCountry}
					preview={input.offersPreview}
					newPages={input.newPages}
				/>
			),
		},
		t
			? {
					id: "fingerprint",
					label: "Fingerprint",
					icon: FingerPrintIcon,
					peek: summary(t),
					aliases: "about title analysis",
					body: () => <FingerprintSection media={media} sides={input.sides} />,
				}
			: null,
		media.mediaType === "show" && (episodeGrid || tracking)
			? {
					id: "episodes",
					label: "Episodes",
					icon: Squares2X2Icon,
					peek: episodesPeek || null,
					subtitle: episodesPeek || null,
					aliases: "seasons",
					body: () => (
						<EpisodesSection
							media={media}
							episodeGrid={episodeGrid}
							episodeLayout={input.episodeLayout}
						/>
					),
					// The grid's and the list's own titles repeat the section's.
					bodyClass: `${DEMOTE} [&_#episode-grid-title]:sr-only [&_#episode-list-title]:sr-only`,
				}
			: null,
		d.synopsis
			? {
					id: "story",
					label: "Story",
					icon: BookOpenIcon,
					peek: d.tagline || firstSentence,
					aliases: "about plot synopsis",
					body: () => <StorySection media={media} />,
				}
			: null,
		media.cast?.length
			? {
					id: "cast",
					label: "Cast",
					icon: UserGroupIcon,
					peek: castNames.length ? `With ${castNames.join(", ")}` : null,
					aliases: "people actors",
					body: () => <CastSection media={media} onCrew={input.onCrew} />,
				}
			: null,
		media.cast?.length
			? {
					id: "crew",
					label: "Crew",
					icon: VideoCameraIcon,
					peek: crewPeek || "Everyone behind the camera",
					aliases: "people director writer",
					body: () => <CrewSection media={media} />,
				}
			: null,
		relatedMap || genreRow || series
			? {
					id: "related",
					label: "Related",
					icon: SparklesIcon,
					peek: [`Titles like ${d.title}`, genreRow?.heading]
						.filter(Boolean)
						.join(" · "),
					aliases: "similar",
					body: () => <RelatedSection media={media} genreRow={genreRow} />,
				}
			: null,
		facts.length
			? {
					id: "facts",
					label: "Facts",
					icon: InformationCircleIcon,
					peek: facts
						.slice(0, 3)
						.map((f) => f.value)
						.join(" · "),
					subtitle: facts
						.slice(0, 3)
						.map((f) => f.value)
						.join(" · "),
					aliases: "details",
					body: () => <FactsList media={media} country={country} />,
				}
			: null,
		tropes.length
			? {
					id: "tropes",
					label: "Tropes",
					icon: TagIcon,
					peek: shortList(tropes, 3),
					subtitle: shortList(tropes, 3),
					aliases: "about",
					body: () => <TropesList media={media} />,
				}
			: null,
		questions.length
			? {
					id: "faq",
					label: "Q&A",
					icon: QuestionMarkCircleIcon,
					peek: `${questions.length} questions, like "${questions[0].q}"`,
					subtitle: `${questions.length} questions, like "${questions[0].q}"`,
					aliases: "questions details",
					body: () => (
						<DetailsQuestions
							media={media}
							country={country}
							questions={questions}
						/>
					),
					// Its own first heading repeats the section's.
					bodyClass: `${DEMOTE} [&>section>h2:first-child]:hidden`,
				}
			: null,
	]
	return sections.filter((s): s is TitleSection => Boolean(s))
}
