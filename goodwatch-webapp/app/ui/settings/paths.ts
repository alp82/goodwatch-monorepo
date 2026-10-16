// The addresses of the Settings sheets that other pages link to.
export const SETTINGS_PATH = "/settings"
export const WHERE_YOU_WATCH_PATH = "/settings/where-you-watch"
export const TITLE_LANGUAGE_PATH = "/settings/language"
export const PROFILE_PATH = "/settings/profile"
export const HIDDEN_PATH = "/settings/hidden"
export const ACCOUNT_PATH = "/settings/account"

/** The state a tile's link gives its sheet: closing it goes back to the tiles rather than add another entry. */
export const OPENED_FROM_TILES = { openedFromTiles: true }

/** A permanent redirect to `to` that keeps the request's query: for an address that moved. */
export function movedTo(request: Request, to: string) {
	const { search } = new URL(request.url)
	return new Response(null, {
		status: 301,
		headers: { Location: `${to}${search}` },
	})
}
