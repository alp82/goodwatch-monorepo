// PROTOTYPE for "Prototype native-scroll carousels on title pages". Throwaway code: not for production.
//
// The cast row with the browser's own scrolling in place of Swiper. Same data and "Show more" step as
// ui/details/Actors.tsx. Differences to judge: no endless loop, no mouse drag on a desktop, and the photos keep
// their size (the next one peeks in at the edge) in place of a fixed number per screen.
import { Link } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { TmdbImage } from "~/ui/TmdbImage"
import type { CastProps } from "~/ui/details/Actors"
import { NativeRow } from "~/ui/prototype-carousels/NativeRow"
import { personPath } from "~/utils/helpers"
import {
	CAST_FIRST_OFFSET,
	type TitleCastPage,
	remainingCast,
	titleCastUrl,
} from "~/utils/title-cast"

export default function ActorsNative({
	cast,
	total,
	mediaType,
	tmdbId,
}: CastProps) {
	const queryClient = useQueryClient()
	const title = `${mediaType}-${tmdbId}`
	const [more, setMore] = useState<{
		title: string
		pages: TitleCastPage[]
		status: "idle" | "loading" | "error"
	}>({ title, pages: [], status: "idle" })
	const current =
		more.title === title ? more : { title, pages: [], status: "idle" as const }
	const { pages, status } = current
	const isFetching = status === "loading"
	const isError = status === "error"
	const lastPage = pages.length ? pages[pages.length - 1] : undefined
	const seen = new Set(cast.map((actor) => actor.id))
	const loaded = pages
		.flatMap((page) => page.cast)
		.filter((actor) => !seen.has(actor.id) && seen.add(actor.id))
	const actors = [...cast, ...loaded]
	const remaining = remainingCast({
		shown: actors.length,
		total: lastPage?.total ?? total,
		hasMore: lastPage ? lastPage.nextOffset != null : undefined,
	})

	// After a load the new actors are where the button was: the row stays put, and the arrows learn the new length.
	// A keyboard activation moves the focus to the first new actor; the browser scrolls it into view by itself.
	const track = useRef<HTMLDivElement>(null)
	const focusFrom = useRef<number | null>(null)
	const shown = actors.length
	useEffect(() => {
		track.current?.dispatchEvent(new Event("scroll"))
		if (focusFrom.current === null || isFetching) return
		const index = focusFrom.current
		focusFrom.current = null
		track.current
			?.querySelector<HTMLElement>(`[data-cast-index="${index}"]`)
			?.focus()
	}, [isFetching, shown])
	// Another title in the same mounted page starts at the first actor.
	useEffect(() => {
		track.current?.scrollTo({ left: 0 })
	}, [title])

	if (!actors.length) return null
	const loadMore = async () => {
		if (isFetching) return
		focusFrom.current =
			document.activeElement instanceof HTMLElement &&
			document.activeElement.matches(":focus-visible")
				? actors.length
				: null
		const offset = lastPage?.nextOffset ?? CAST_FIRST_OFFSET
		setMore({ title, pages, status: "loading" })
		try {
			const page = await queryClient.fetchQuery<TitleCastPage>({
				queryKey: ["title-cast", mediaType, tmdbId, offset],
				queryFn: async () => {
					const response = await fetch(
						titleCastUrl({ mediaType, tmdbId: String(tmdbId), offset }),
					)
					if (!response.ok)
						throw new Error(`Cast request failed: ${response.status}`)
					return response.json()
				},
			})
			setMore((latest) =>
				latest.title === title
					? { title, pages: [...pages, page], status: "idle" }
					: latest,
			)
		} catch {
			focusFrom.current = null
			setMore((latest) =>
				latest.title === title ? { title, pages, status: "error" } : latest,
			)
		}
	}
	const moreLabel = isFetching ? "Loading" : isError ? "Try again" : "Show more"

	return (
		<>
			<h2 className="text-2xl font-bold mb-4">Actors</h2>
			<NativeRow label="Actors" trackRef={track} trackClassName="py-1">
				{actors.map((actor, index) => {
					const characterText = actor.characters.join(", ") || undefined
					return (
						<Link
							key={actor.id}
							to={personPath(actor.id, actor.name)}
							prefetch="intent"
							data-cast-index={index}
							className="flex flex-col items-center group px-2"
						>
							<div className="w-28 h-28 sm:w-36 sm:h-36 mb-2 rounded-full overflow-hidden border-2 border-stone-400 shadow-lg group-hover:border-slate-200 transition-all">
								<TmdbImage
									kind="profile"
									path={actor.profile_path}
									width={144}
									className="w-full h-full object-cover"
									alt={`${actor.name} profile`}
								/>
							</div>
							<p
								className="text-sm font-semibold text-center truncate w-28 sm:w-36"
								title={actor.name}
							>
								{actor.name}
							</p>
							{characterText && (
								<p
									className="text-xs text-center text-gray-400 truncate w-28 sm:w-36"
									title={characterText}
								>
									{characterText}
								</p>
							)}
						</Link>
					)
				})}
				{remaining > 0 && (
					<button
						key="more"
						type="button"
						onClick={loadMore}
						aria-disabled={isFetching}
						aria-label={`${moreLabel}: ${remaining} more ${remaining === 1 ? "actor" : "actors"}`}
						className="flex flex-col items-center group px-2 cursor-pointer"
					>
						<span className="flex w-28 h-28 sm:w-36 sm:h-36 mb-2 items-center justify-center rounded-full border-2 border-stone-400 bg-white/5 text-2xl font-bold shadow-lg group-hover:border-slate-200 group-focus-visible:border-slate-200 transition-all">
							+{remaining.toLocaleString("en-US")}
						</span>
						<span className="text-sm font-semibold text-center truncate w-28 sm:w-36">
							{moreLabel}
						</span>
					</button>
				)}
			</NativeRow>
			<output className="sr-only">
				{isError
					? "The rest of the cast could not be loaded."
					: loaded.length
						? `${actors.length} of ${actors.length + remaining} actors shown.`
						: ""}
			</output>
		</>
	)
}
