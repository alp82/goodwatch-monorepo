// Which side of the person's taste the Taste page shows, by its address: `/taste?side=<id>` opens on that side, as
// the TV's Expand key on a side's screen has it (ui/living-room/tv). The ids are the portrait's (`Side.id`), the
// same on the TV and the page. A side the person picks on the page takes the address's place without a history
// entry of its own, so Back leaves the page in one step; an id that names no side is the page as without one.

export const SIDE_PARAM = "side"

/** The side the address asks for, or null. */
export function requestedSide(params: URLSearchParams): string | null {
	return params.get(SIDE_PARAM) || null
}

/** The side the page opens on: the one asked for when the person has it, else the view's own first. */
export function openingSide(
	sides: readonly { id: string }[],
	requested: string | null,
	openFirst: string | null,
): string {
	if (requested && sides.some((side) => side.id === requested)) return requested
	return openFirst ?? sides[0]?.id ?? ""
}

/** The address's parameters with `side` set to `id`, or without it. The other parameters stay as they are. */
export function withSide(
	params: URLSearchParams,
	id: string | null,
): URLSearchParams {
	const next = new URLSearchParams(params)
	if (id) next.set(SIDE_PARAM, id)
	else next.delete(SIDE_PARAM)
	return next
}

/** Only the side changed between two addresses of the page: its data stays as it is. */
export function onlySideChanged(current: URL, next: URL): boolean {
	if (current.pathname !== next.pathname) return false
	const strip = (url: URL) => {
		const params = withSide(url.searchParams, null)
		params.sort()
		return params.toString()
	}
	return strip(current) === strip(next)
}
