// The paging of the phone's lists (480 x 270 canvas, nothing scrolls). Pure, so the tests run it as it is.

/**
 * A phone list's arrows where the list pages on the screen and on the server too: within the titles the server
 * sent, an arrow moves the focus a page on (`jump:`); at either end of them it is the key that asks the server for
 * the page before or after (`browse:prev`, `browse:next`), where the screen has it.
 */
export function listArrows(
	page: { prev: string | null; next: string | null },
	items: readonly string[],
): { prev: string | null; next: string | null } {
	return {
		prev: page.prev ?? (items.includes("browse:prev") ? "browse:prev" : null),
		next: page.next ?? (items.includes("browse:next") ? "browse:next" : null),
	}
}

/**
 * The page a phone list shows (kit.tsx, `usePage`): the one that holds `by`, the item that set the page (the focus,
 * the focus on this mount before it left the list, or the anchor the screen's navigation state names), else the
 * first. Its arrows move the focus to the first item of the next page or the last of the one before.
 */
export function pageAt(ids: readonly string[], per: number, by: string | null | undefined) {
	const at = by ? Math.max(0, ids.indexOf(by)) : 0
	const pages = Math.max(1, Math.ceil(ids.length / per))
	const page = Math.min(Math.floor(at / per), pages - 1)
	const from = page * per
	return {
		page,
		pages,
		shown: ids.slice(from, from + per),
		prev: page > 0 ? `jump:${ids[from - 1]}` : null,
		next: page < pages - 1 ? `jump:${ids[from + per]}` : null,
	}
}

/**
 * How many of a phone row's items show (kit.tsx, `phoneFit`): `base` on the upright canvas (480 wide), one more for
 * every `step` canvas px a phone's wide canvas has more, at most `most`.
 */
export function fitCount(width: number, base: number, step: number, most: number, upright = 480) {
	return Math.max(base, Math.min(most, base + Math.floor(Math.max(0, width - upright) / step)))
}
