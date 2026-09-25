import { useLocation } from "@remix-run/react"
import { useEffect } from "react"

// Only pages someone stays on for a moment are worth preparing a share card for.
const DELAY_MS = 3000
const SKIPPED_PREFIXES = ["/og/", "/api/", "/prototype"]

/**
 * After each page view, asks the server to prepare the page's Open Graph card, so sharing
 * the link right after shows a fast, current preview. Sends only the path, never the image.
 */
export function useOgImageWarmup() {
	const { pathname } = useLocation()
	useEffect(() => {
		if (SKIPPED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return
		const timer = window.setTimeout(() => {
			navigator.sendBeacon?.(
				"/api/og-image-warm",
				new Blob([pathname], { type: "text/plain" }),
			)
		}, DELAY_MS)
		return () => window.clearTimeout(timer)
	}, [pathname])
}
