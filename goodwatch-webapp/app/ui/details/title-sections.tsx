// The title page's sections after the Summary, in reading order: Where to watch, Fingerprint, At a glance, Tropes,
// Episodes (shows), More like this. Sections without content are left out. Each has a name, an icon, a one-line gist
// for "On this page" (and as the header's muted line where the section doesn't show the same), the words find also
// knows it by, and its body. The sub-pages' find builds the title page's index from the same list, without bodies.
import {
	DocumentTextIcon,
	FingerPrintIcon,
	SparklesIcon,
	Squares2X2Icon,
	StarIcon,
	TagIcon,
	TvIcon,
} from "@heroicons/react/24/outline"
import type { ComponentType, ReactNode } from "react"
import type { EpisodeLayout } from "~/domain/tracking/episode-layout"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { GenreRow } from "~/server/genre-row/genre-row.server"
import type { NewPagesHere } from "~/server/new-on-services-page.server"
import type { TitleSides } from "~/server/title-sides.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { EpisodesSection } from "~/ui/details/EpisodesSection"
import { WatchSection } from "~/ui/details/WatchSection"
import { AtAGlance, glanceRowLabels } from "~/ui/details/at-a-glance/AtAGlance"
import { EpisodeViewToggle } from "~/ui/details/episode-grid/episode-view"
import { FingerprintSection } from "~/ui/details/fingerprint-section/FingerprintSection"
import { MoreLikeThis } from "~/ui/details/more-like-this/MoreLikeThis"
import type { ShelfTitle } from "~/ui/details/more-like-this/shelf-data"
import { useStreamNames } from "~/ui/details/streaming"
import { AT_A_GLANCE, subPagePath } from "~/ui/details/sub-page/paths"
import { splitLead } from "~/ui/details/synopsis-fold"
import {
	countryName,
	fingerprintInput,
	lengthWords,
	scoreLines,
	shortList,
	tropeNames,
} from "~/ui/details/title-words"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import { TropesSection } from "~/ui/details/tropes/TropesSection"
import { useEpisodeTracking } from "~/ui/tracking/gate"

type Media = MovieResult | ShowResult

export interface TitleSection {
	/** The section element's id (an address with #id lands on it). */
	id: string
	/** The ids the section's content had on the page before, so old links still land on it. */
	oldIds?: string[]
	label: string
	icon: ComponentType<{ className?: string }>
	/** The gist in one line, for "On this page". */
	peek: string | null
	/** The header's muted line; none where the section shows the same. */
	subtitle?: string | null
	/** The section heading when it says more than the label (the index and nav keep the label). */
	heading?: string
	/** More words find knows the section by. */
	aliases: string
	body: () => ReactNode
	/** Classes for the body wrapper. */
	bodyClass?: string
	/** Controls at the right of the section header row. */
	aside?: ReactNode
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
	/** More like this's Similar shelf, when the loader had it in time. */
	similar?: ShelfTitle[]
	newPages?: NewPagesHere
	sides: TitleSides | null
	/** At a glance's open rows and how one opens or closes (the title page keeps them per history entry). */
	glance?: { open: string[]; onToggle: (id: string) => void }
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

/** The Summary under the opener, as "On this page" and find know it. */
export function summaryEntry(media: Media) {
	const lead = media.details.synopsis
		? splitLead(media.details.synopsis)[0]
		: null
	return {
		id: "summary",
		label: "Summary",
		icon: DocumentTextIcon,
		peek: lead || scoresEntry(media).peek,
		aliases: "synopsis plot story about essence tags good for skip",
	}
}

/**
 * Find's own sections that aren't sections of the page: the facts and the people, which are At a glance's rows (the
 * title page opens the row on the way).
 */
export const FIND_ONLY_SECTIONS = [
	{ id: "facts", label: "Facts", peek: null, aliases: "details" },
	{ id: "cast", label: "Cast", peek: null, aliases: "people actors" },
	{
		id: "crew",
		label: "Crew",
		peek: null,
		aliases: "people director writer",
	},
]

export function useTitleSections(input: TitleSectionsInput): TitleSection[] {
	const { media, country, questions, genreRow, episodeGrid, glance } = input
	const d = media.details
	const { stream, rentBuy } = useStreamNames(media, country)
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

	const episodesPeek = lengthWords(media) ?? ""
	const essence = media.fingerprint?.essenceTags ?? []
	const tropes = tropeNames(media)
	const glanceRows = glanceRowLabels(media, country, questions)

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
					peek: shortList(essence, 3) || null,
					aliases: "about title analysis feels effects",
					body: () => (
						<FingerprintSection
							media={media}
							href={subPagePath("fingerprint", media)}
						/>
					),
				}
			: null,
		glanceRows.length
			? {
					id: "at-a-glance",
					// Old links to the facts, the questions and the people land here.
					oldIds: ["facts", "faq", "actors_and_crew"],
					label: AT_A_GLANCE,
					icon: DocumentTextIcon,
					peek: glanceRows.join(", "),
					aliases:
						"facts awards content age rating cast crew starring made by director",
					body: () => (
						<AtAGlance
							media={media}
							country={country}
							questions={questions}
							open={glance?.open ?? []}
							onToggle={glance?.onToggle ?? (() => {})}
						/>
					),
				}
			: null,
		tropes.total
			? {
					id: "tropes",
					label: "Tropes",
					icon: TagIcon,
					peek: shortList(tropes.names, 3) || null,
					aliases: "about tv tropes",
					body: () => <TropesSection media={media} />,
				}
			: null,
		media.mediaType === "show" && (episodeGrid || tracking)
			? {
					id: "episodes",
					label: "Episodes",
					icon: Squares2X2Icon,
					heading: `${d.title} episodes`,
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
					// The Grid / Spread switch sits in the header row on every screen.
					aside: (
						<EpisodeViewToggle
							showId={media.details.tmdb_id}
							className="flex shrink-0"
						/>
					),
					// The grid's and the list's own titles repeat the section's.
					bodyClass: `${DEMOTE} [&_#episode-grid-title]:sr-only [&_#episode-list-title]:sr-only`,
				}
			: null,
		{
			id: "more-like-this",
			// Old links to the related titles land here.
			oldIds: ["related"],
			label: "More like this",
			icon: SparklesIcon,
			peek: `Titles like ${d.title}`,
			aliases: "similar related series sequel director genre",
			body: () => (
				<MoreLikeThis
					media={media}
					genreRow={genreRow}
					similar={input.similar}
				/>
			),
		},
	]
	return sections.filter((s): s is TitleSection => Boolean(s))
}
