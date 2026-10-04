import { Link } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import type { Swiper as SwiperClass } from "swiper"
import { SwiperSlide } from "swiper/react"
import "swiper/css"
import "swiper/css/navigation"
import type { CastMember } from "~/server/types/details-types"
import ListSwiper from "~/ui/ListSwiper"
import { TmdbImage } from "~/ui/TmdbImage"
import { personPath } from "~/utils/helpers"
import {
	CAST_FIRST_OFFSET,
	type TitleCastPage,
	remainingCast,
	titleCastUrl,
} from "~/utils/title-cast"

export interface CastProps {
	/** The top-billed cast, which is in the document. */
	cast: CastMember[]
	/** How many people with a photo the title's cast has. */
	total: number
	mediaType: "movie" | "show"
	tmdbId: number
}

/**
 * The cast carousel. The document holds the top-billed cast. When the title has more, the last
 * slide is a button that loads the next part of the cast into the same carousel.
 */
export default function Actors({ cast, total, mediaType, tmdbId }: CastProps) {
	// Nothing is requested until the visitor asks for more. Each part of the cast is one entry in
	// the query cache, so coming back to a title doesn't request it again.
	const queryClient = useQueryClient()
	const title = `${mediaType}-${tmdbId}`
	const [more, setMore] = useState<{
		title: string
		pages: TitleCastPage[]
		status: "idle" | "loading" | "error"
	}>({ title, pages: [], status: "idle" })
	// Navigating to another title keeps this component mounted: start over for the new cast.
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
		// The last page says whether another one exists; before any request, the total does.
		hasMore: lastPage ? lastPage.nextOffset != null : undefined,
	})

	// After a load, the keyboard focus moves from the button to the first new actor.
	const list = useRef<HTMLDivElement>(null)
	const focusFrom = useRef<number | null>(null)
	useEffect(() => {
		if (focusFrom.current === null || isFetching) return
		const index = focusFrom.current
		focusFrom.current = null
		list.current
			?.querySelector<HTMLElement>(`[data-cast-index="${index}"]`)
			?.focus({ preventScroll: true })
	}, [isFetching])

	// A browser scrolls the clipped carousel sideways to show a slide that gets the keyboard focus,
	// which pushes the arrows and the slide grid out of place. Undo that, and move the carousel.
	const showFocusedSlide = (event: React.FocusEvent<HTMLDivElement>) => {
		const target = event.target as HTMLElement
		if (!target.matches(":focus-visible")) return
		const slide = target.closest<HTMLElement>(".swiper-slide")
		const carousel = target.closest<HTMLElement & { swiper?: SwiperClass }>(
			".swiper",
		)
		if (!slide || !carousel) return
		const reset = () => {
			carousel.scrollLeft = 0
		}
		reset()
		requestAnimationFrame(reset)
		const swiper = carousel.swiper
		if (!swiper || swiper.destroyed) return
		// In loop mode a slide knows its place by this attribute, not by its position in the DOM.
		const looped = slide.dataset.swiperSlideIndex
		if (looped !== undefined) swiper.slideToLoop(Number(looped))
		else swiper.slideTo(Array.from(swiper.slides).indexOf(slide))
	}

	if (!actors.length) return null
	const loadMore = async () => {
		if (isFetching) return
		// Only a keyboard activation moves the focus: a pointer click leaves the carousel where it is.
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
			<div ref={list} onFocusCapture={showFocusedSlide}>
				<ListSwiper>
					{actors.map((actor, index) => {
						const characterText = actor.characters.join(", ") || undefined
						return (
							<SwiperSlide key={actor.id}>
								<Link
									to={personPath(actor.id, actor.name)}
									prefetch="intent"
									data-cast-index={index}
									className="flex flex-col items-center group px-2"
								>
									<div className="w-36 h-36 mb-2 rounded-full overflow-hidden border-2 border-stone-400 shadow-lg group-hover:border-slate-200 transition-all">
										<TmdbImage
											kind="profile"
											path={actor.profile_path}
											width={144}
											className="w-full h-full object-cover"
											alt={`${actor.name} profile`}
										/>
									</div>
									<p
										className="text-sm font-semibold text-center truncate w-36"
										title={actor.name}
									>
										{actor.name}
									</p>
									{characterText && (
										<p
											className="text-xs text-center text-gray-400 truncate w-36"
											title={characterText}
										>
											{characterText}
										</p>
									)}
								</Link>
							</SwiperSlide>
						)
					})}
					{remaining > 0 && (
						<SwiperSlide key="more">
							<button
								type="button"
								onClick={loadMore}
								aria-disabled={isFetching}
								aria-label={`${moreLabel}: ${remaining} more ${remaining === 1 ? "actor" : "actors"}`}
								className="flex flex-col items-center group px-2 cursor-pointer"
							>
								<span className="flex w-36 h-36 mb-2 items-center justify-center rounded-full border-2 border-stone-400 bg-white/5 text-2xl font-bold shadow-lg group-hover:border-slate-200 group-focus-visible:border-slate-200 transition-all">
									+{remaining.toLocaleString("en-US")}
								</span>
								<span className="text-sm font-semibold text-center truncate w-36">
									{moreLabel}
								</span>
							</button>
						</SwiperSlide>
					)}
				</ListSwiper>
			</div>
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
