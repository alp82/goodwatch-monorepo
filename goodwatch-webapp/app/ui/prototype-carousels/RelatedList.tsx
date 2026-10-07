// PROTOTYPE for "Prototype native-scroll carousels on title pages". Throwaway code: not for production.
//
// Variant "list": the related titles as a short list with a reason per title, no carousel and no tabs. The first
// titles show; the rest are in the document inside a closed <details>, so "more" works without script and search
// engines still read every link.
//
// Real: the titles (the overall panel the loader embeds) and the reasons (the attributes both fingerprints score 7
// or more, read on the server: see prototype-carousels.server.ts). Prototype: how the reasons are ranked and worded.
import { Link } from "@remix-run/react"
import { useRelatedPanel } from "~/routes/api.related"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { useCarouselPrototype } from "~/ui/prototype-carousels/variant"
import { titleToDashed } from "~/utils/helpers"
import {
	OVERALL_PANEL,
	type RelatedCard,
	relatedPanelParams,
} from "~/utils/related-panel"

type Media = MovieResult | ShowResult
type MediaType = "movie" | "show"

/** How many titles of the page's own type and of the other type show before "more". */
const FIRST_SAME = 6
const FIRST_OTHER = 4

export const titlePath = (mediaType: MediaType, card: RelatedCard) =>
	`/${mediaType}/${card.tmdb_id}-${titleToDashed(card.title)}`

function Item({
	mediaType,
	card,
	reasons,
}: {
	mediaType: MediaType
	card: RelatedCard
	reasons: string[] | undefined
}) {
	const score = Math.round(card.goodwatch_overall_score_normalized_percent)
	return (
		<li className="min-w-0">
			<Link
				to={titlePath(mediaType, card)}
				prefetch="intent"
				className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10"
			>
				<TmdbImage
					kind="poster"
					path={card.poster_path}
					width={56}
					className="w-14 shrink-0 rounded"
					alt=""
				/>
				<span className="min-w-0 flex-1">
					<span className="block truncate font-bold">
						{card.title}{" "}
						<span className="font-normal text-gray-400">
							{card.release_year}
						</span>
					</span>
					<span className="block text-sm text-gray-300">
						{reasons?.length
							? `Shares ${reasons
									.map((key) => {
										const meta = getFingerprintMeta(key)
										return `${meta.emoji} ${meta.label}`
									})
									.join(" · ")}`
							: "Similar overall fingerprint"}
					</span>
				</span>
				<span
					className={`shrink-0 rounded-md px-2 py-1 text-sm font-bold text-white bg-vibe-${Math.round(score / 10) * 10}`}
				>
					{score}
				</span>
			</Link>
		</li>
	)
}

function Group({
	heading,
	mediaType,
	cards,
	first,
	reasons,
}: {
	heading: string
	mediaType: MediaType
	cards: RelatedCard[]
	first: number
	reasons: Record<string, string[]>
}) {
	if (!cards.length) return null
	const item = (card: RelatedCard) => (
		<Item
			key={card.tmdb_id}
			mediaType={mediaType}
			card={card}
			reasons={reasons[`${mediaType}-${card.tmdb_id}`]}
		/>
	)
	const rest = cards.slice(first)
	return (
		<div>
			<h3 className="mb-3 text-xl font-bold">{heading}</h3>
			<ul className="grid gap-2 md:grid-cols-2">
				{cards.slice(0, first).map(item)}
			</ul>
			{rest.length > 0 && (
				<details className="group mt-3">
					<summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-semibold hover:bg-white/10 [&::-webkit-details-marker]:hidden">
						<span className="group-open:hidden">
							Show {rest.length} more{" "}
							{mediaType === "movie" ? "movies" : "shows"}
						</span>
						<span className="hidden group-open:inline">Show fewer</span>
					</summary>
					<ul className="mt-3 grid gap-2 md:grid-cols-2">{rest.map(item)}</ul>
				</details>
			)}
		</div>
	)
}

export default function RelatedList({ media }: { media: Media }) {
	const prototype = useCarouselPrototype()
	const panel = useRelatedPanel(relatedPanelParams(media, OVERALL_PANEL))
	if (!media.fingerprint) return null
	const reasons = prototype?.reasons ?? {}
	const hasReasons = Object.keys(reasons).length > 0
	const movies = panel.data?.movies ?? []
	const shows = panel.data?.shows ?? []
	const isMovie = media.mediaType === "movie"
	const group = (type: MediaType) => (
		<Group
			key={type}
			heading={type === "movie" ? "Movies" : "Shows"}
			mediaType={type}
			cards={type === "movie" ? movies : shows}
			first={(type === "movie") === isMovie ? FIRST_SAME : FIRST_OTHER}
			reasons={reasons}
		/>
	)
	return (
		<section
			className="flex flex-col gap-6 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6"
			aria-busy={panel.isPending}
		>
			<div>
				<h2 className="text-2xl font-extrabold tracking-tight">
					Movies and shows like {media.details.title}
				</h2>
				<p className="mt-1 text-gray-300">
					Closest by fingerprint, with what each one shares with{" "}
					{media.details.title}.
					{!hasReasons && !panel.isPending && (
						<span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-sm text-amber-200">
							Stub: the reasons could not be read on this server.
						</span>
					)}
				</p>
			</div>
			{isMovie
				? [group("movie"), group("show")]
				: [group("show"), group("movie")]}
		</section>
	)
}
