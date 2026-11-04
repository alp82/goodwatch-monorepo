// `?hl=`: the words a find pick was for, marked in the text of the page it lands on (the title page or a sub-page)
// with the CSS Custom Highlight API, so the DOM (and hydration) stays untouched. A pick sets it (`markHl`): on the
// current URL (replaceState, keeping the router's history state, so no loader runs) and on the link into a sub-page
// (`withHl`). Text that shows up later (sections below the fold, a trope opened) is marked as it appears. Browsers
// without the Highlight API show no marks; the ring still flashes.
import { useLocation } from "@remix-run/react"
import { useEffect, useState } from "react"
import { FLASH_EVENT, lastFlashed, visible } from "./highlight"
import { MARK, MARK_CURRENT, ensureMarkCss } from "./mark-style"

const EVENT = "find-marks-change"
let next: string | null = null

/** After a find pick: the words to mark, on this URL and the next one `withHl` builds. */
export function markHl(q: string) {
	const words = q.trim()
	next = words.length >= 2 ? words : null
	try {
		const url = new URL(window.location.href)
		if (next) url.searchParams.set("hl", next)
		else url.searchParams.delete("hl")
		window.history.replaceState(window.history.state, "", url)
		window.dispatchEvent(new Event(EVENT))
	} catch {}
}

let carry: { path: string; words: string } | null = null

/** Going back to the title page (a step back in the history, whose URL has no `hl`): mark the words once there. */
export function carryHl(path: string) {
	carry = next ? { path, words: next } : null
}

/** The href with the last pick's words as `hl`. */
export function withHl(href: string) {
	if (!next) return href
	const url = new URL(href, window.location.href)
	url.searchParams.set("hl", next)
	return url.pathname + url.search + url.hash
}

type Registry = Map<string, unknown>
type HighlightLike = { priority: number }

/** Text find's own lists and fields hold, which is never marked. */
const SKIP =
	"input, textarea, script, style, [data-find-results], [role=listbox]"

/** Every text match of `words` under <main>; the one inside the element find last rang is the current one. */
function mark(words: string) {
	const registry = (CSS as unknown as { highlights?: Registry }).highlights
	const Highlight = (
		window as unknown as {
			Highlight?: new (...r: Range[]) => HighlightLike
		}
	).Highlight
	if (!registry || !Highlight) return
	const needle = words.toLowerCase()
	const root = document.querySelector("main") ?? document.body
	const ranges: Range[] = []
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (n) =>
			n.parentElement?.closest(SKIP)
				? NodeFilter.FILTER_REJECT
				: NodeFilter.FILTER_ACCEPT,
	})
	for (
		let node = walker.nextNode();
		node && ranges.length < 400;
		node = walker.nextNode()
	) {
		const text = (node.textContent ?? "").toLowerCase()
		for (
			let i = text.indexOf(needle);
			i !== -1;
			i = text.indexOf(needle, i + needle.length)
		) {
			const r = new Range()
			r.setStart(node, i)
			r.setEnd(node, i + needle.length)
			ranges.push(r)
		}
	}
	// The landed match stands out; without a landing, the first one shown.
	const ringed = lastFlashed?.isConnected ? lastFlashed : null
	let at = ringed
		? ranges.findIndex((r) => ringed.contains(r.startContainer))
		: -1
	if (at < 0)
		at = ranges.findIndex((r) => {
			const el = r.startContainer.parentElement
			return !!el && visible(el)
		})
	const rest = at >= 0 ? ranges.filter((_, i) => i !== at) : ranges
	registry.set(MARK, new Highlight(...rest))
	if (at >= 0) {
		const current = new Highlight(ranges[at])
		current.priority = 1
		registry.set(MARK_CURRENT, current)
	} else registry.delete(MARK_CURRENT)
}

function clear() {
	const registry = (CSS as unknown as { highlights?: Registry }).highlights
	registry?.delete(MARK)
	registry?.delete(MARK_CURRENT)
}

/** Marks `?hl=` on the page; mount once per page (the title page, a sub-page's frame). Returns the words marked. */
export function useHlParam(): string | null {
	const location = useLocation()
	const [hl, setHl] = useState<string | null>(null)
	useEffect(() => {
		const read = () => {
			const own = new URLSearchParams(window.location.search).get("hl")
			if (!own && carry && carry.path === window.location.pathname) {
				const words = carry.words
				carry = null
				markHl(words)
				return
			}
			setHl(own)
		}
		read()
		window.addEventListener(EVENT, read)
		return () => window.removeEventListener(EVENT, read)
	}, [location.key, location.search])
	useEffect(() => {
		if (!hl || hl.trim().length < 2) {
			clear()
			return
		}
		ensureMarkCss()
		let t = 0
		const run = () => {
			window.clearTimeout(t)
			t = window.setTimeout(() => mark(hl.trim()), 120)
		}
		run()
		const mo = new MutationObserver(run)
		mo.observe(document.querySelector("main") ?? document.body, {
			childList: true,
			subtree: true,
			characterData: true,
		})
		window.addEventListener(FLASH_EVENT, run)
		return () => {
			window.clearTimeout(t)
			mo.disconnect()
			window.removeEventListener(FLASH_EVENT, run)
			clear()
		}
	}, [hl])
	return hl
}
