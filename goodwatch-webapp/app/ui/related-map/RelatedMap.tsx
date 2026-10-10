// The related titles section of a title page as a map: one title in the middle, the related titles on rings around
// it by similarity, trait chips that bend who is on the map, and a walk from poster to poster that never leaves the
// page. Three layers, by weight:
// 1. The server's HTML: the picture of the page's title, drawn by the engine itself, and the plain title links.
// 2. The inline script: the engine (engine.ts). Taps work before hydration. The script and the style come from the
//    server only, so neither is part of the title route's own script.
// 3. Nothing else. A page opened by a navigation inside the app has no inline script: it loads the engine and the
//    style as a lazy chunk when the section mounts.
//
// A walk is forgotten when the page is left.
import { useMatches, useNavigate } from "@remix-run/react"
import { useEffect, useState } from "react"
import type { RelatedMapData } from "~/server/related-map.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const loadClient = reloadOnStaleChunk(() => import("~/ui/related-map/client"))

interface MapWindow {
	__gwRelatedMap?: { boot: () => void; nav: ((href: string) => void) | null }
}
/** Set by server/related-map.server.ts. Not there in the browser. */
const serverHead = () =>
	typeof document === "undefined"
		? (
				globalThis as {
					__gwRelatedMapHead?: { css: string; script: string }
				}
			).__gwRelatedMapHead
		: undefined

const STYLE = "style[data-related-map-css]"
/** The map's style is in the document: the server's, or the lazy chunk's. */
const styled = () =>
	typeof document === "undefined" ||
	Array.from(document.querySelectorAll(STYLE)).some(
		(style) => style.textContent,
	)

/** The section's markup from the title route's loader, or undefined when the page shows the related titles carousel. */
export function useRelatedMap(): RelatedMapData | undefined {
	for (const match of useMatches()) {
		const data = match.data as { relatedMap?: RelatedMapData } | undefined
		if (data?.relatedMap) return data.relatedMap
	}
	return undefined
}

export default function RelatedMap({
	media,
}: {
	media: MovieResult | ShowResult
}) {
	const map = useRelatedMap()
	const navigate = useNavigate()
	const rootKey = `${media.mediaType === "movie" ? "m" : "s"}${media.details.tmdb_id}`
	const shown = Boolean(map)
	// False only on a page that was opened inside the app before the style arrived: the picture waits for it.
	const [ready, setReady] = useState(styled)
	useEffect(() => {
		if (!shown) return
		// The server's style leaves the document with the page it came with. A copy in the head stays for the pages
		// that are opened from here.
		const own = Array.from(document.querySelectorAll(STYLE)).find(
			(style) => style.textContent,
		)
		if (own && !document.head.querySelector(STYLE)) {
			const copy = document.createElement("style")
			copy.setAttribute("data-related-map-css", "")
			copy.textContent = own.textContent
			document.head.appendChild(copy)
		}
		if (own) setReady(true)
		else
			loadClient().then((chunk) => {
				chunk.style()
				setReady(true)
			})
	}, [shown])
	// The engine starts once the picture is in the document, and hears about every title this section shows.
	useEffect(() => {
		if (!shown || !ready) return
		const w = window as MapWindow
		let gone = false
		const start = () => {
			if (gone || !w.__gwRelatedMap) return
			w.__gwRelatedMap.nav = (href) => navigate(href)
			w.__gwRelatedMap.boot()
		}
		if (w.__gwRelatedMap) start()
		else
			loadClient().then((chunk) => {
				if (gone) return
				chunk.start()
				start()
			})
		return () => {
			gone = true
			if (w.__gwRelatedMap) w.__gwRelatedMap.nav = null
		}
	}, [shown, ready, navigate, rootKey])
	if (!map) return null
	const head = serverHead()
	return (
		<>
			<style
				data-related-map-css=""
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: a constant of styles.ts, from the server.
				dangerouslySetInnerHTML={{ __html: head?.css ?? "" }}
			/>
			<section
				// Until the style is there the section holds its place: 602 px on a phone, 576 px on a wide screen.
				className={
					ready ? "pl pl-map" : "pl pl-map min-h-[602px] lg:min-h-[576px]"
				}
				data-related-map=""
				data-pl-root={rootKey}
				data-pl-title={media.details.title}
				tabIndex={-1}
				aria-label={`Titles like ${media.details.title}`}
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: markup drawn by the engine on the server.
				dangerouslySetInnerHTML={{ __html: ready ? map.html : "" }}
			/>
			{/* After the section, so that it finds it while the document is parsed. */}
			<script
				suppressHydrationWarning={true}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: the engine's own source, from the server.
				dangerouslySetInnerHTML={{ __html: head?.script ?? "" }}
			/>
		</>
	)
}
