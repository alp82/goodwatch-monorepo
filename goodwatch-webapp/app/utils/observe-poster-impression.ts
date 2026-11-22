// Every card on a page uses the same viewport and half-visible threshold.
type Update = (halfVisible?: boolean) => void

function createPool(doc: Document) {
	const cards = new Map<Element, Update>()
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries)
				cards.get(entry.target)?.(entry.isIntersecting && entry.intersectionRatio >= 0.5)
		},
		{ threshold: 0.5 },
	)
	const onVisibility = () => {
		for (const update of cards.values()) update()
	}
	doc.addEventListener("visibilitychange", onVisibility)
	return {
		add(element: Element, update: Update) {
			cards.set(element, update)
			observer.observe(element)
		},
		remove(element: Element, update: Update) {
			if (cards.get(element) !== update) return
			observer.unobserve(element)
			cards.delete(element)
			if (!cards.size) {
				observer.disconnect()
				doc.removeEventListener("visibilitychange", onVisibility)
				pools.delete(doc)
			}
		},
	}
}
const pools = new WeakMap<Document, ReturnType<typeof createPool>>()

/** Count once after one continuous second at least half in view while the tab is visible. */
export function observePosterImpression(element: Element, onImpression: () => void) {
	const doc = element.ownerDocument
	const pool = pools.get(doc) ?? createPool(doc)
	pools.set(doc, pool)
	let visible = false
	let timer: ReturnType<typeof setTimeout> | undefined
	function stop() {
		clearTimeout(timer)
		pool.remove(element, update)
	}
	function update(halfVisible = visible) {
		visible = halfVisible
		clearTimeout(timer)
		if (visible && doc.visibilityState === "visible") {
			timer = setTimeout(() => {
				stop()
				onImpression()
			}, 1000)
		}
	}
	pool.add(element, update)
	return stop
}
