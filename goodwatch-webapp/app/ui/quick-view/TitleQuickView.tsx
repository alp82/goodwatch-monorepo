// The quick view a poster card opens on a touch screen (title-quick-view.tsx), loaded on first use: the card's list
// in the site's quick view, each title from /api/title-cards (fetched ahead for the cards in sight). The reason line
// is the title's tagline and the chips its taste reasons; there is no story (the cards carry none), so the view is
// SHORT.
import { useQuery } from "@tanstack/react-query"
import { QuickView, SHORT } from "./QuickView"
import { QuickViewCard } from "./QuickViewCard"
import {
	CARD_STALE_MS,
	type CardLoader,
	type OpenTitles,
	type PosterTitle,
	cardQueryKey,
	fetchTitleCards,
} from "./title-quick-view"

function Card({ title, loader }: { title: PosterTitle; loader: CardLoader }) {
	const query = useQuery({
		queryKey: cardQueryKey(loader.viewer, loader.language, title.key),
		queryFn: async () =>
			(await fetchTitleCards([title.key], loader.member, loader.language))[0] ??
			null,
		staleTime: CARD_STALE_MS,
	})
	const card = query.data
	return (
		<QuickViewCard
			title={{
				media: {
					mediaType: title.mediaType,
					details: {
						tmdb_id: title.tmdbId,
						title: title.title,
						poster_path: title.poster,
						release_year: title.year,
					},
				},
				href: title.href,
				meta: [
					title.year,
					title.mediaType === "show" ? "Show" : "Movie",
					title.mediaType === "movie" && card?.runtime
						? `${card.runtime} min`
						: null,
				]
					.filter(Boolean)
					.join(" · "),
				lang: card?.presentation?.title.language,
				poster: title.poster,
				backdrop: card?.backdrop_path,
				goodwatch:
					card?.goodwatch_overall_score_normalized_percent ?? title.goodwatch,
				match: card?.match ?? null,
				reason: card?.tagline ? (
					<p className="line-clamp-2 text-[14px] leading-5 text-gray-300 italic">
						{card.tagline}
					</p>
				) : undefined,
				chips: card?.reasons ?? [],
				services: query.isSuccess ? (card?.services ?? []) : null,
			}}
		/>
	)
}

export default function TitleQuickView({
	open,
	loader,
	onIndex,
	onClose,
}: {
	open: OpenTitles
	loader: CardLoader
	onIndex: (index: number) => void
	onClose: () => void
}) {
	const at = (i: number): PosterTitle | undefined => open.titles[i]
	return (
		<QuickView
			count={open.cards.length}
			index={open.index}
			onIndex={onIndex}
			onClose={onClose}
			ordered={open.cards.length > 1}
			wide={open.wide}
			// A card that left the page (its list reloaded) has no poster to scroll to or return focus to.
			anchorOf={(i) => (open.cards[i]?.isConnected ? open.cards[i] : null)}
			posterOf={(i) => ({
				path: at(i)?.poster ?? null,
				name: at(i)?.title ?? "",
			})}
			height={SHORT}
		>
			{(i) => {
				const title = at(i)
				return title ? <Card title={title} loader={loader} /> : null
			}}
		</QuickView>
	)
}
