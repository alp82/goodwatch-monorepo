// Where "Talked about now" (#557) goes: the top of the section below the room (BelowRoom.tsx). The start page's
// first view is the room, so nothing of the row is in it: not in the HTML, not in the scripts, not in the
// stylesheet. Once the page is open below the room (`<html data-lr="open">`, use-below-room.ts) and the slot comes
// within half a window of the screen, the row's chunk and its data are asked for together; the row then takes
// the space it needs.
import { useQueryClient } from "@tanstack/react-query"
import { Suspense, lazy, useEffect, useRef, useState } from "react"
import type { TalkedRow } from "~/domain/talked-about-now"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

// The row's one request. The slot starts it early and hands it to the row: a module both import would go into the
// shell chunk every page loads (rule 3 in vite.config.js).
const TALKED_QUERY = {
	queryKey: ["talked-about-now"],
	queryFn: async (): Promise<TalkedRow | null> => {
		const response = await fetch("/api/talked-about-now")
		if (response.status === 404) return null
		if (!response.ok) throw new Error(`Talked about now: ${response.status}`)
		return ((await response.json()) as { row: TalkedRow | null }).row
	},
}
export type TalkedQuery = typeof TALKED_QUERY

const loadRow = () => import("./StartRow")
const StartRow = lazy(reloadOnStaleChunk(loadRow))

export function StartRowSlot() {
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
					client.prefetchQuery(TALKED_QUERY)
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
	}, [client])

	return (
		<div ref={slot}>
			{wanted && (
				<Suspense fallback={null}>
					<StartRow query={TALKED_QUERY} />
				</Suspense>
			)}
		</div>
	)
}
