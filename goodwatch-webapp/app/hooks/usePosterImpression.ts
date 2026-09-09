import { useEffect, useRef } from "react"

interface Impression {
	media_type: "movie" | "show"
	tmdb_id: number
}

const seen = new Set<string>()
const pending = new Map<string, Impression>()
let flushTimer: ReturnType<typeof setTimeout> | undefined
let visitorId: string | undefined
let listening = false

function flush() {
	clearTimeout(flushTimer)
	flushTimer = undefined
	if (!pending.size) return
	const items = [...pending.values()].slice(0, 50)
	for (const item of items) pending.delete(`${item.media_type}:${item.tmdb_id}`)
	void fetch("/api/poster-impressions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ visitorId, items }),
		keepalive: true,
	}).catch(() => {}) // Impression collection must never interrupt browsing.
	if (pending.size) flushTimer = setTimeout(flush, 1000)
}

function enqueue(item: Impression) {
	if (!visitorId) {
		try {
			visitorId = sessionStorage.getItem("poster-impression-visitor") || crypto.randomUUID()
			sessionStorage.setItem("poster-impression-visitor", visitorId)
		} catch {
			visitorId = crypto.randomUUID()
		}
	}
	const key = `${item.media_type}:${item.tmdb_id}`
	if (seen.has(key)) return
	seen.add(key)
	pending.set(key, item)
	if (!listening) {
		listening = true
		window.addEventListener("pagehide", flush)
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "hidden") flush()
		})
	}
	if (!flushTimer) flushTimer = setTimeout(flush, 1000)
}

/** Count a poster after one continuous second with at least half visible. */
export function usePosterImpression(mediaType?: "movie" | "show", tmdbId?: number) {
	const ref = useRef<HTMLImageElement>(null)
	useEffect(() => {
		const element = ref.current
		if (!element || !mediaType || !Number.isSafeInteger(tmdbId) || !tmdbId || tmdbId <= 0 || tmdbId > 2_147_483_647 || typeof IntersectionObserver === "undefined") return
		let timer: ReturnType<typeof setTimeout> | undefined
		let visible = false
		const schedule = () => {
			clearTimeout(timer)
			if (visible && document.visibilityState === "visible") {
				timer = setTimeout(() => {
					enqueue({ media_type: mediaType, tmdb_id: tmdbId })
					observer.disconnect()
				}, 1000)
			}
		}
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting && entry.intersectionRatio >= 0.5
			schedule()
		}, { threshold: 0.5 })
		observer.observe(element)
		document.addEventListener("visibilitychange", schedule)
		return () => {
			observer.disconnect()
			clearTimeout(timer)
			document.removeEventListener("visibilitychange", schedule)
		}
	}, [mediaType, tmdbId])
	return ref
}
