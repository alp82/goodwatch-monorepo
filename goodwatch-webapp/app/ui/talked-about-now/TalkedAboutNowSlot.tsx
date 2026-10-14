// The place of "Talked about now" on a title page (#558), the only part of the section in the page's first view: an
// empty element. When a visitor comes near it, the section's posts are requested and its code loads; the section
// appears only if the title has posts. A visitor who doesn't scroll, and a crawler, request neither, so the page's
// first view is the same with the section on or off.
import { useQueryClient } from "@tanstack/react-query"
import { Suspense, lazy, useEffect, useRef, useState } from "react"
import { onFirstInteraction } from "~/utils/first-interaction"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { type SocialTitleRef, titleSocialQuery } from "./query"

const loadSection = reloadOnStaleChunk(() => import("./TitleSocialSection"))
const TitleSocialSection = lazy(loadSection)

export interface TalkedAboutNowMedia {
	mediaType: "movie" | "show"
	details: { tmdb_id: number; title: string; backdrop_path?: string | null }
}

export function TalkedAboutNowSlot({ media }: { media: TalkedAboutNowMedia }) {
	const slot = useRef<HTMLDivElement>(null)
	const [near, setNear] = useState(false)
	const queryClient = useQueryClient()
	const title: SocialTitleRef = { mediaType: media.mediaType, tmdbId: media.details.tmdb_id }

	useEffect(() => {
		setNear(false)
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return
				observer.disconnect()
				// The posts and the code load side by side.
				void queryClient.prefetchQuery(titleSocialQuery(title))
				setNear(true)
			},
			{ rootMargin: "800px 0px" },
		)
		if (slot.current) observer.observe(slot.current)
		// The code is fetched at the first sign of use, so the section is there when the visitor reaches it.
		onFirstInteraction(() => void loadSection().catch(() => {}))
		return () => observer.disconnect()
	}, [queryClient, title.mediaType, title.tmdbId])

	return (
		<div ref={slot} data-talked-about-now-slot>
			{near && (
				<Suspense fallback={null}>
					<TitleSocialSection title={title} name={media.details.title} backdrop={media.details.backdrop_path ?? null} />
				</Suspense>
			)}
		</div>
	)
}
