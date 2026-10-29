// The fingerprint grid's titles in the quick view (ui/quick-view): previous / next step through the grid. The reason
// line is the selection the title was found for; its chips are the title's own strongest ingredients of it. The card
// from /api/title-cards (members GET, guests POST their browser's progress) adds the backdrop, runtime, match and
// services, a dozen titles at a time. Title cards carry no story, so the view is the short one.
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { EffectReading } from "~/domain/fingerprint-effects/effects"
import type { TitleCardsAnswer } from "~/server/title-cards-request.server"
import { QuickView, SHORT } from "~/ui/quick-view/QuickView"
import { QuickViewCard } from "~/ui/quick-view/QuickViewCard"
import { useUser } from "~/utils/auth"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import { titleToDashed } from "~/utils/helpers"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { titleKey } from "~/utils/title-key"
import { anchorId } from "./SharedGrid"
import type { SharedTitle } from "./population"
import { effectColor, shortName } from "./reading"

/** Cards are asked for a dozen titles at a time: the open one's dozen, and the next one near its end. */
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

function useCards(type: "movie" | "show", list: SharedTitle[], chunk: number) {
	const { user } = useUser()
	const { locale } = useLocale()
	const keys = list
		.slice(chunk * CHUNK, (chunk + 1) * CHUNK)
		.map((p) => titleKey(type, p.tmdbId))
	return useQuery({
		queryKey: [
			"fingerprint-cards",
			user?.id ?? "guest",
			locale.language,
			keys.join(","),
		],
		queryFn: () => fetchCards(keys, Boolean(user), locale.language),
		enabled: keys.length > 0,
	})
}

const hrefOf = (type: "movie" | "show", p: SharedTitle) =>
	`/${type}/${p.tmdbId}-${titleToDashed(p.title)}`

function Card({
	list,
	index,
	type,
	effects,
}: {
	list: SharedTitle[]
	index: number
	type: "movie" | "show"
	effects: EffectReading[]
}) {
	const p = list[index]
	const cards = useCards(type, list, Math.floor(index / CHUNK))
	const card = cards.data?.cards.find((c) => c.key === titleKey(type, p.tmdbId))
	return (
		<QuickViewCard
			title={{
				media: {
					mediaType: type,
					details: {
						tmdb_id: p.tmdbId,
						title: p.title,
						poster_path: p.poster,
						release_year: p.year,
					},
				},
				href: hrefOf(type, p),
				meta: [
					p.year,
					type === "show" ? "Show" : "Movie",
					type === "movie" && card?.runtime ? `${card.runtime} min` : null,
				]
					.filter(Boolean)
					.join(" · "),
				lang: card?.presentation?.title.language,
				poster: p.poster,
				backdrop: card?.backdrop_path,
				goodwatch:
					card?.goodwatch_overall_score_normalized_percent ?? p.goodwatch,
				match: card?.match ?? null,
				reason: effects.length ? (
					<p className="truncate text-[15px] leading-snug font-semibold">
						{effects.map((r, i) => (
							<span key={r.effect.id}>
								{i > 0 && <span className="text-gray-500"> + </span>}
								<span style={{ color: effectColor(r) }}>{shortName(r)}</span>
							</span>
						))}
					</p>
				) : null,
				chips: p.keys,
				services: cards.isSuccess ? (card?.services ?? []) : null,
				details: "Open page",
			}}
		/>
	)
}

export function SharedQuickView({
	list,
	type,
	effects,
	index,
	onIndex,
	onClose,
}: {
	list: SharedTitle[]
	type: "movie" | "show"
	effects: EffectReading[]
	index: number
	onIndex: (index: number) => void
	onClose: () => void
}) {
	const [wide] = useState(() => window.matchMedia("(min-width: 768px)").matches)
	// The next dozen's cards, once the open title is near the end of its own.
	const near = Math.floor(index / CHUNK) + (index % CHUNK >= CHUNK - 3 ? 1 : 0)
	useCards(type, list, near)
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
							`[data-pop-id="${anchorId(list[i])}"]`,
						)
					: null
			}
			posterOf={(i) => ({
				path: list[i]?.poster ?? null,
				name: list[i]?.title ?? "",
			})}
			height={SHORT}
		>
			{(i) => <Card list={list} index={i} type={type} effects={effects} />}
		</QuickView>
	)
}
