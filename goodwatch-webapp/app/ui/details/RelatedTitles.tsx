import React, { useMemo } from "react"
import { useRelatedPanel } from "~/routes/api.related"
import type { DiscoverResults } from "~/server/discover.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import ListSwiperSkeleton from "~/ui/ListSwiperSkeleton"
import MovieTvSwiper from "~/ui/explore/MovieTvSwiper"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import { type RelatedCard, relatedPanelParams } from "~/utils/related-panel"

export interface RelatedTitlesProps {
	media: MovieResult | ShowResult
	/** "overall", or one of the title's fingerprint highlight keys. */
	panelKey: string
}

const NO_CARDS: RelatedCard[] = []

// Empty state with consistent height
function EmptyRelatedState() {
	return <div className="h-[170px] flex items-center justify-center" />
}

function RelatedSwiper({
	title,
	mediaType,
	cards,
	isLoading,
}: {
	title: string
	mediaType: "movie" | "show"
	cards: RelatedCard[]
	isLoading: boolean
}) {
	// A card reads the same few fields from a related title as from a discover result.
	const results = useMemo(
		() =>
			cards.map((card) => ({
				...card,
				media_type: mediaType,
			})) as unknown as DiscoverResults,
		[cards, mediaType],
	)
	const hasResults = !isLoading && results.length > 0
	const isEmpty = !isLoading && results.length === 0

	return (
		<div className="mt-6">
			<h3 className="flex items-center gap-2 text-xl font-bold">{title}</h3>
			<div>
				{/* The skeleton has the height of a row of cards, so the page doesn't move when the cards arrive. */}
				{isLoading && <ListSwiperSkeleton />}
				{isEmpty && <EmptyRelatedState />}
				{hasResults && <MovieTvSwiper results={results} />}
			</div>
		</div>
	)
}

/** The selected panel of the related titles section: its description, and a row each of movies and shows. */
export default function RelatedTitles({ media, panelKey }: RelatedTitlesProps) {
	const { mediaType } = media

	// The default panel's data comes with the document. Any other panel is one request, made
	// when its tab shows intent or gets selected, and kept for the rest of the visit.
	const panel = useRelatedPanel(relatedPanelParams(media, panelKey))
	const isLoading = panel.isPending

	const meta = getFingerprintMeta(panelKey)

	const movieSwiper = (
		<RelatedSwiper
			key="movies"
			title="Movies"
			mediaType="movie"
			cards={panel.data?.movies ?? NO_CARDS}
			isLoading={isLoading}
		/>
	)
	const showSwiper = (
		<RelatedSwiper
			key="shows"
			title="Shows"
			mediaType="show"
			cards={panel.data?.shows ?? NO_CARDS}
			isLoading={isLoading}
		/>
	)

	return (
		<div className="flex flex-col gap-4" aria-busy={isLoading}>
			<div className="my-1">
				<p className="mt-2 text-xl text-gray-300">
					<span className="flex items-center gap-2 text-xl">
						<span aria-hidden>{meta.emoji}</span>
						<span className="font-bold">{meta.label}: </span>
						{meta.description}
					</span>
				</p>
			</div>
			{mediaType === "movie"
				? [movieSwiper, showSwiper]
				: [showSwiper, movieSwiper]}
		</div>
	)
}
