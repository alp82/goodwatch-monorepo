// At a glance's rows, in order: Facts, Content, Starring, Made by. Each row has a closed line that already answers
// (its value, and a quieter teaser of what opening it gives you); its opened content is GlanceDetail.tsx's. The title
// page's section (AtAGlance.tsx) opens one row at a time; the sub-page (AtAGlancePage.tsx) shows every row opened. A
// row shows only when the title has its data.
import type { ReactNode } from "react"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { useSectionNear } from "~/ui/details/below-fold"
import { CAPTION, initials } from "~/ui/details/page-ui"
import { usePeople } from "~/ui/details/people/usePeople"
import { ageWord, countryName } from "~/ui/details/title-words"
import type { TitleQuestion } from "~/ui/details/titleQuestions"
import { contentSummary } from "./content"
import { factsLine, numbersTeaser } from "./facts"
import {
	CREW_PAGE_SIZE,
	GLANCE_LABEL,
	type GlanceRowId,
	glanceRowIds,
} from "./rows"

export type { GlanceRowId } from "./rows"

type Media = MovieResult | ShowResult

export interface GlanceRow {
	/** The row's element id on the title page and its part's on the sub-page. */
	id: GlanceRowId
	label: string
	/** The closed line: the answer itself. */
	value: ReactNode
	/** Under the value: what opening the row gives you. */
	teaser?: ReactNode
}

const TEASE = "mt-1 block text-[13px] leading-snug text-gray-500"
const SEP = <span className="px-1.5 text-gray-700">·</span>

export function useGlanceRows({
	media,
	country,
	questions,
}: {
	media: Media
	country: string
	questions: TitleQuestion[]
}): GlanceRow[] {
	const row = (id: GlanceRowId): GlanceRow => {
		const label = GLANCE_LABEL[id]
		if (id === "glance-facts") {
			const numbers = numbersTeaser(media)
			return {
				id,
				label,
				value: (
					<span className="text-white">
						{factsLine(media) ?? "Release, genres, language, where it's made"}
					</span>
				),
				teaser: numbers ? <span className={TEASE}>{numbers}</span> : undefined,
			}
		}
		if (id === "glance-content") {
			const content = contentSummary(media, country, questions)
			return {
				id,
				label,
				value: <span className="text-white">{content?.value}</span>,
				teaser: content?.verdict ? (
					<span className={TEASE}>{content.verdict}</span>
				) : undefined,
			}
		}
		if (id === "glance-cast")
			return {
				id,
				label,
				value: (
					<span className="font-semibold text-white">
						{(media.cast ?? [])
							.slice(0, 3)
							.map((s) => s.name)
							.join(", ")}
					</span>
				),
				teaser: <Faces media={media} />,
			}
		return {
			id,
			label,
			value: <MakersValue media={media} />,
			teaser: <MakersTeaser media={media} />,
		}
	}
	return glanceRowIds(media, country, questions).map(row)
}

// --- Starring -----------------------------------------------------------------------------------------------------

/** The first faces of the cast and how many more there are. */
function Faces({ media }: { media: Media }) {
	const cast = (media.cast ?? []).slice(0, 8)
	const total = media.cast_total || media.cast?.length || 0
	return (
		<span className="mt-1.5 flex items-center gap-2.5">
			<span className="flex -space-x-2">
				{cast.map((c) => (
					<span
						key={c.id}
						className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gray-800 text-[10px] font-semibold text-gray-400 ring-2 ring-gray-950"
					>
						{c.profile_path ? (
							<TmdbImage
								kind="profile"
								path={c.profile_path}
								width={36}
								ratio={1}
								alt=""
								className="h-full w-full object-cover"
							/>
						) : (
							initials(c.name)
						)}
					</span>
				))}
			</span>
			{total > 3 && (
				<span className="text-[13px] text-gray-500">and {total - 3} more</span>
			)}
		</span>
	)
}

// --- Made by ------------------------------------------------------------------------------------------------------

/**
 * "Directed by Denis Villeneuve, written with Jon Spaihts, Frank Herbert". A show's creators come with a small
 * request once the section is near; until then the line names its writers, as a movie's does.
 */
function MakersValue({ media }: { media: Media }) {
	const show = media.mediaType === "show"
	const near = useSectionNear()
	const creators = usePeople({
		mediaType: media.mediaType,
		tmdbId: media.details.tmdb_id,
		kind: "crew",
		q: "creator",
		pageSize: 6,
		enabled: show && near,
	})
	const lead = show
		? creators.rows
				.filter((r) => r.roles.includes("Creator"))
				.map((r) => ({ id: r.id, name: r.name }))
		: media.crew.directors
	const seen = new Set(lead.map((p) => p.id))
	const writers = media.crew.writers
		.filter((w) => !seen.has(w.id))
		.slice(0, 2)
		.map((w) => w.name)
		.join(", ")
	return (
		<span className="text-white">
			{lead.length > 0 && (
				<>
					<span className="text-gray-400">
						{show ? "Created by " : "Directed by "}
					</span>
					<span className="font-semibold">
						{lead.map((p) => p.name).join(", ")}
					</span>
				</>
			)}
			{writers && (
				<>
					<span className="text-gray-400">
						{lead.length ? ", written with " : "Written by "}
					</span>
					<span className="font-semibold">{writers}</span>
				</>
			)}
			{!lead.length && !writers && (
				<span className="text-gray-400">Everyone behind the camera</span>
			)}
		</span>
	)
}

/** Key jobs worth naming in the teaser, with the word the line uses. */
const TEASE_JOBS: [string, string][] = [
	["Director of Photography", "camera"],
	["Original Music Composer", "music"],
	["Editor", "editing"],
]

function MakersTeaser({ media }: { media: Media }) {
	const near = useSectionNear()
	const crew = usePeople({
		mediaType: media.mediaType,
		tmdbId: media.details.tmdb_id,
		kind: "crew",
		pageSize: CREW_PAGE_SIZE,
		enabled: near,
	})
	if (!crew.ready)
		return <span className={TEASE}>The whole crew by department</span>
	const named = TEASE_JOBS.map(([job, word]) => {
		const p = crew.rows.find((r) => r.roles.includes(job))
		return p ? `${p.name} (${word})` : null
	}).filter(Boolean)
	return (
		<span className={TEASE}>
			{named.join(", ")}
			{named.length > 0 && SEP}
			{crew.total} people in {crew.groups.length} departments
		</span>
	)
}
