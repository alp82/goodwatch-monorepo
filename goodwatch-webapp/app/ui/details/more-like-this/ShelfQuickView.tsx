// A shelf's titles in the site's quick view, stepping through the shelf; the reason line is the shelf's own reason.
// Cards from /api/title-cards (members GET, guests POST), a dozen at a time.
import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import type { TitleCardsAnswer } from "~/server/title-cards-request.server"
import { QuickView, SHORT } from "~/ui/quick-view/QuickView"
import { QuickViewCard } from "~/ui/quick-view/QuickViewCard"
import { useUser } from "~/utils/auth"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import { titlePath } from "~/utils/helpers"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { titleKey } from "~/utils/title-key"
import { type ShelfTitle, shelfAnchor } from "./shelf-data"

const CHUNK = 12

async function fetchCards(
	keys: number[],
	member: boolean,
	language: string,
): Promise<TitleCardsAnswer> {
	const response = await fetch(
		mediaLanguageUrl(`/api/title-cards?keys=${keys.join(",")}`, language),
		member
			? undefined
			: {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ guest: snapshotGuestProgress() }),
				},
	)
	if (!response.ok) throw new Error(`Title cards: ${response.status}`)
	return response.json()
}

function useCards(list: ShelfTitle[], chunk: number) {
	const { user } = useUser()
	const { locale } = useLocale()
	const keys = list
		.slice(chunk * CHUNK, (chunk + 1) * CHUNK)
		.map((t) => titleKey(t.type, t.tmdbId))
	return useQuery({
		queryKey: [
			"more-like-this-cards",
			user?.id ?? "guest",
			locale.language,
			keys.join(","),
		],
		queryFn: () => fetchCards(keys, Boolean(user), locale.language),
		enabled: keys.length > 0,
	})
}

function Card({
	list,
	index,
	reason,
}: { list: ShelfTitle[]; index: number; reason: ReactNode }) {
	const t = list[index]
	const cards = useCards(list, Math.floor(index / CHUNK))
	const card = cards.data?.cards.find(
		(c) => c.key === titleKey(t.type, t.tmdbId),
	)
	return (
		<QuickViewCard
			title={{
				media: {
					mediaType: t.type,
					details: {
						tmdb_id: t.tmdbId,
						title: t.title,
						poster_path: t.poster,
						release_year: t.year,
					},
				},
				href: titlePath(t.type, t.tmdbId, t.title),
				meta: [
					t.year,
					t.type === "show" ? "Show" : "Movie",
					t.type === "movie" && card?.runtime ? `${card.runtime} min` : null,
				]
					.filter(Boolean)
					.join(" · "),
				lang: card?.presentation?.title.language,
				poster: t.poster,
				backdrop: card?.backdrop_path,
				goodwatch:
					card?.goodwatch_overall_score_normalized_percent ?? t.goodwatch,
				match: card?.match ?? null,
				reason: (
					<p className="line-clamp-2 text-[15px] leading-snug font-semibold text-gray-200">
						{reason}
					</p>
				),
				services: cards.isSuccess ? (card?.services ?? []) : null,
				details: "Open page",
			}}
		/>
	)
}

export function ShelfQuickView({
	shelf,
	list,
	reason,
	index,
	onIndex,
	onClose,
}: {
	shelf: string
	list: ShelfTitle[]
	reason: ReactNode
	index: number
	onIndex: (index: number) => void
	onClose: () => void
}) {
	const [wide] = useState(() => window.matchMedia("(min-width: 768px)").matches)
	const near = Math.floor(index / CHUNK) + (index % CHUNK >= CHUNK - 3 ? 1 : 0)
	useCards(list, near)
	return (
		<QuickView
			count={list.length}
			index={index}
			onIndex={onIndex}
			onClose={onClose}
			ordered={list.length > 1}
			wide={wide}
			anchorOf={(i) =>
				list[i]
					? document.querySelector<HTMLElement>(
							`[data-pop-id="${shelfAnchor(shelf, list[i])}"]`,
						)
					: null
			}
			posterOf={(i) => ({
				path: list[i]?.poster ?? null,
				name: list[i]?.title ?? "",
			})}
			height={SHORT}
		>
			{(i) => <Card list={list} index={i} reason={reason} />}
		</QuickView>
	)
}
