// The addresses of the Settings pages that other pages link to, from the member navigation's address map
// (~/domain/member-paths). Each row of the Settings column opens one of them.
import { NOT_INTERESTED_PATH, SETTINGS_PATHS } from "~/domain/member-paths"

export { EXPORT_PATH, NOT_INTERESTED_PATH } from "~/domain/member-paths"
export const SETTINGS_PATH = SETTINGS_PATHS.home
export const COUNTRY_PATH = SETTINGS_PATHS.country
export const SERVICES_PATH = SETTINGS_PATHS.services
export const TITLE_LANGUAGE_PATH = SETTINGS_PATHS.language
export const DISCOVER_PRIVACY_PATH = SETTINGS_PATHS.privacy
export const PROFILE_PATH = SETTINGS_PATHS.profile
export const ACCOUNT_PATH = SETTINGS_PATHS.account
/** Not interested: the titles you hid. /settings/hidden and /my-library/hidden redirect here. */
export const HIDDEN_PATH = NOT_INTERESTED_PATH

/** A permanent redirect to `to` that keeps the request's query: for an address that moved. */
export function movedTo(request: Request, to: string) {
	const { search } = new URL(request.url)
	return new Response(null, {
		status: 301,
		headers: { Location: `${to}${search}` },
	})
}
