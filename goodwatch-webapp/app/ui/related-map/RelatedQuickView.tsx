// The related map's titles in the quick view (ui/quick-view): a tap on the title in the middle opens it, and next /
// previous go through the titles on the map nearest first. Each title says how it stands to the middle one ("Closer
// in tone to …"); its card from /api/title-cards (members GET, guests POST their browser's progress) adds the
// backdrop, runtime, scores, taste reasons and services, a dozen titles at a time. Its code loads on the first tap.
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import type { TitleCardsAnswer } from "~/server/title-cards-request.server"
import { QuickView, SHORT } from "~/ui/quick-view/QuickView"
import { QuickViewCard } from "~/ui/quick-view/QuickViewCard"
import { useUser } from "~/utils/auth"
import { snapshotGuestProgress } from "~/utils/guest-progress"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { titleKey } from "~/utils/title-key"
import type { MapView, MapViewTitle } from "./engine"

/** Cards are asked for a dozen titles at a time: the open one's dozen, and the next one near its end. */
const CHUNK = 12

/** The map's poster paths have no leading slash. */
const posterPath = (t: MapViewTitle) =>
	t.p ? (t.p.startsWith("/") ? t.p : `/${t.p}`) : null

const mediaOf = (t: MapViewTitle) => ({
	mediaType: t.k.charAt(0) === "s" ? ("show" as const) : ("movie" as const),
	tmdbId: Number(t.k.slice(1)),
})

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

function useCards(titles: MapViewTitle[], chunk: number) {
	const { user } = useUser()
	const { locale } = useLocale()
	const keys = titles
		.slice(chunk * CHUNK, (chunk + 1) * CHUNK)
		.map((t) => titleKey(mediaOf(t).mediaType, mediaOf(t).tmdbId))
	return useQuery({
		queryKey: [
			"related-map-cards",
			user?.id ?? "guest",
			locale.language,
			keys.join(","),
		],
		queryFn: () => fetchCards(keys, Boolean(user), locale.language),
		enabled: keys.length > 0,
		staleTime: 5 * 60_000,
	})
}

function MapCard({
	titles,
	index,
}: { titles: MapViewTitle[]; index: number }) {
	const t = titles[index]
	const { mediaType, tmdbId } = mediaOf(t)
	const cards = useCards(titles, Math.floor(index / CHUNK))
	const key = titleKey(mediaType, tmdbId)
	const card = cards.data?.cards.find((c) => c.key === key)
	const loaded = cards.isSuccess
	const middle = titles[0]
	return (
		<QuickViewCard
			title={{
				media: {
					mediaType,
					details: {
						tmdb_id: tmdbId,
						title: card?.title ?? t.t,
						poster_path: posterPath(t),
						release_year: t.y || null,
					},
				},
				href: t.href,
				meta: [
					t.y,
					mediaType === "show" ? "Show" : "Movie",
					mediaType === "movie" && card?.runtime ? `${card.runtime} min` : null,
				]
					.filter(Boolean)
					.join(" · "),
				lang: t.language,
				poster: posterPath(t),
				backdrop: card?.backdrop_path,
				goodwatch: card?.goodwatch_overall_score_normalized_percent ?? null,
				match: card?.match ?? null,
				reason:
					index === 0 ? null : (
						<p className="truncate text-[15px] text-gray-300">
							Closer in tone to{" "}
							<span lang={middle.language} className="font-bold text-white">
								{middle.t}
							</span>
						</p>
					),
				chips: card?.reasons.slice(0, 3) ?? [],
				services: loaded ? (card?.services ?? []) : null,
				details: "Open page",
			}}
		/>
	)
}

export function RelatedQuickView({
	view,
	onClose,
}: { view: MapView; onClose: () => void }) {
	const { titles, section } = view
	const [index, setIndex] = useState(0)
	const [wide] = useState(() => window.matchMedia("(min-width: 768px)").matches)
	// The next dozen's cards, once the open title is near the end of its own.
	const near = Math.floor(index / CHUNK) + (index % CHUNK >= CHUNK - 3 ? 1 : 0)
	useCards(titles, near)
	// Leaving full screen (Escape, the browser's own control) puts the view in the wrong place: it closes with it.
	const [container] = useState(() => document.fullscreenElement)
	useEffect(() => {
		if (!container) return
		const off = () => {
			if (!document.fullscreenElement) onClose()
		}
		document.addEventListener("fullscreenchange", off)
		return () => document.removeEventListener("fullscreenchange", off)
	}, [container, onClose])
	const anchorOf = (i: number) => {
		const t = titles[i]
		if (!t) return null
		return section.querySelector<HTMLElement>(
			`[data-pl-stage] [data-r-k="${CSS.escape(t.k)}"]:not([data-r-x])`,
		)
	}
	return (
		<QuickView
			count={titles.length}
			index={index}
			onIndex={setIndex}
			onClose={onClose}
			ordered={titles.length > 1}
			wide={wide}
			anchorOf={anchorOf}
			posterOf={(i) => ({ path: posterPath(titles[i]), name: titles[i].t })}
			container={container}
			height={SHORT}
		>
			{(i) => <MapCard titles={titles} index={i} />}
		</QuickView>
	)
}
