// Where "Talked about now" (#557) goes: the top of the section below the room (BelowRoom.tsx). The start page's
// first view is the room, so nothing of the row is in it: not in the HTML, not in the scripts, not in the
// stylesheet. Once the page is open below the room (`<html data-lr="open">`, use-below-room.ts) and the slot comes
// within half a window of the screen, the row's chunk and its data are asked for together; the row then takes
// the space it needs.
import { useQueryClient } from "@tanstack/react-query"
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react"
import useLocale from "~/utils/locale"
import { talkedRowQuery } from "~/utils/talked-row-query"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

export type TalkedQuery = ReturnType<typeof talkedRowQuery>

const loadRow = () => import("./StartRow")
const StartRow = lazy(reloadOnStaleChunk(loadRow))

export function StartRowSlot() {
	const { locale } = useLocale()
	const query = useMemo(
		() => talkedRowQuery(locale.language),
		[locale.language],
	)
	const slot = useRef<HTMLDivElement>(null)
	const [wanted, setWanted] = useState(false)
	const client = useQueryClient()

	useEffect(() => {
		const el = slot.current
		if (!el || typeof IntersectionObserver === "undefined") return
		const html = document.documentElement
		let near: IntersectionObserver | null = null
		const watch = () => {
			if (near || html.dataset.lr !== "open") return
			near = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return
					stop()
					client.prefetchQuery(query)
					setWanted(true)
				},
				{ rootMargin: "0px 0px 50% 0px" },
			)
			near.observe(el)
		}
		const opened = new MutationObserver(watch)
		const stop = () => {
			opened.disconnect()
			near?.disconnect()
		}
		opened.observe(html, { attributes: true, attributeFilter: ["data-lr"] })
		watch()
		return stop
	}, [client, query])

	return (
		<div ref={slot}>
			{wanted && (
				<Suspense fallback={null}>
					<StartRow query={query} />
				</Suspense>
			)}
		</div>
	)
}
