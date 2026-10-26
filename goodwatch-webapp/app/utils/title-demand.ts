import { canonicalTitleId } from "./title-identity.ts"

export interface TitleDemand {
	media_type: "movie" | "show"
	tmdb_id: number
	source_kind: "poster" | "opened"
}

export const DEMAND_DEDUPE_MS = 30 * 60 * 1000

/** Source-separated, expiring tab deduplication. A list impression cannot hide an open. */
export function createDemandDedupe() {
	const seen = new Map<string, number>()
	return (item: TitleDemand, now = Date.now()) => {
		for (const [key, expires] of seen) if (expires <= now) seen.delete(key)
		const key = demandKey(item)
		if (seen.has(key)) return false
		seen.set(key, now + DEMAND_DEDUPE_MS)
		return true
	}
}

function demandKey(item: TitleDemand) {
	return `${item.source_kind}:${item.media_type}:${canonicalTitleId(item.media_type, item.tmdb_id)}`
}

const accept = createDemandDedupe()
const pending = new Map<string, TitleDemand>()
let flushTimer: ReturnType<typeof setTimeout> | undefined
let visitorId: string | undefined
let listening = false

function flush() {
	clearTimeout(flushTimer)
	flushTimer = undefined
	if (!pending.size) return
	const items = [...pending.values()].slice(0, 50)
	for (const item of items) pending.delete(demandKey(item))
	void fetch("/api/poster-impressions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ visitorId, items }),
		keepalive: true,
	}).catch(() => {})
	if (pending.size) flushTimer = setTimeout(flush, 1000)
}

/** First-party demand is independent of analytics and must never interrupt browsing. */
export function enqueueDemand(item: TitleDemand) {
	try {
		if (!visitorId) {
			try {
				visitorId = sessionStorage.getItem("poster-impression-visitor") || crypto.randomUUID()
				sessionStorage.setItem("poster-impression-visitor", visitorId)
			} catch {
				visitorId = crypto.randomUUID()
			}
		}
		if (!accept(item)) return
		pending.set(demandKey(item), item)
		if (!listening) {
			listening = true
			window.addEventListener("pagehide", flush)
			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === "hidden") flush()
			})
		}
		if (!flushTimer) flushTimer = setTimeout(flush, 1000)
	} catch {} // Storage/crypto/network collection failures cannot disrupt a title view.
}

/** One continuous foreground second. TV views also require their screen in the viewport. */
export function observeTitleOpened(onOpened: () => void, selector?: string) {
	let timer: ReturnType<typeof setTimeout> | undefined
	let finished = false
	const visible = new Set<Element>()
	const schedule = () => {
		clearTimeout(timer)
		if (!finished && document.visibilityState === "visible" && (!selector || visible.size)) {
			timer = setTimeout(() => {
				finished = true
				onOpened()
			}, 1000)
		}
	}
	let observer: IntersectionObserver | undefined
	let mutations: MutationObserver | undefined
	if (selector && typeof IntersectionObserver !== "undefined") {
		observer = new IntersectionObserver(entries => {
			for (const entry of entries) {
				if (entry.isIntersecting && entry.intersectionRatio >= 0.5) visible.add(entry.target)
				else visible.delete(entry.target)
			}
			schedule()
		}, { threshold: 0.5 })
		const observed = new Set<Element>()
		const bind = () => {
			const elements = new Set(document.querySelectorAll(selector))
			let changed = false
			for (const element of observed) {
				if (elements.has(element)) continue
				observer!.unobserve(element)
				observed.delete(element)
				visible.delete(element)
				changed = true
			}
			for (const element of elements) {
				if (observed.has(element)) continue
				observed.add(element)
				observer!.observe(element)
				changed = true
			}
			if (changed) schedule()
		}
		bind()
		// The room can replace its phone/desktop canvas while the same title stays active.
		if (typeof MutationObserver !== "undefined") {
			mutations = new MutationObserver(bind)
			mutations.observe(document.body, { childList: true, subtree: true })
		}
	}
	document.addEventListener("visibilitychange", schedule)
	schedule()
	return () => {
		clearTimeout(timer)
		observer?.disconnect()
		mutations?.disconnect()
		document.removeEventListener("visibilitychange", schedule)
	}
}
