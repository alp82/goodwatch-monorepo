// Which links a phone prefetches when a list stops scrolling (link-intent.ts). No browser imports, so
// `node --test` runs its tests directly.

export const VIEWPORT_LINKS = 4

interface Rect {
	top: number
	bottom: number
	left: number
	right: number
	width: number
	height: number
}

/** Picks the links to prefetch on a phone: fully visible, nearest the viewport's center, one per URL. */
export function nearestLinks(
	links: { href: string; rect: Rect }[],
	viewport: { width: number; height: number },
	limit = VIEWPORT_LINKS,
): string[] {
	const cx = viewport.width / 2
	const cy = viewport.height / 2
	const seen = new Set<string>()
	return links
		.filter(
			({ rect }) =>
				rect.width > 0 &&
				rect.height > 0 &&
				rect.top >= 0 &&
				rect.left >= 0 &&
				rect.bottom <= viewport.height &&
				rect.right <= viewport.width,
		)
		.map(({ href, rect }) => ({
			href,
			distance: Math.hypot(
				(rect.left + rect.right) / 2 - cx,
				(rect.top + rect.bottom) / 2 - cy,
			),
		}))
		.sort((a, b) => a.distance - b.distance)
		.filter(({ href }) => !seen.has(href) && Boolean(seen.add(href)))
		.slice(0, limit)
		.map(({ href }) => href)
}
