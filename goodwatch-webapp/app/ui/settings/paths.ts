// The addresses of the Settings pages that other pages link to. Each tile on /settings opens one of them.
export const SETTINGS_PATH = "/settings"
export const COUNTRY_PATH = "/settings/country"
export const SERVICES_PATH = "/settings/services"
export const TITLE_LANGUAGE_PATH = "/settings/language"
export const DISCOVER_PRIVACY_PATH = "/settings/discover-privacy"
export const PROFILE_PATH = "/settings/profile"
export const ACCOUNT_PATH = "/settings/account"
/** Hidden titles live in My library now; /settings/hidden redirects there. */
export const HIDDEN_PATH = "/my-library/hidden"

/** A permanent redirect to `to` that keeps the request's query: for an address that moved. */
export function movedTo(request: Request, to: string) {
	const { search } = new URL(request.url)
	return new Response(null, {
		status: 301,
		headers: { Location: `${to}${search}` },
	})
}
