import { LINK_SERVICES, type LinkService } from "~/domain/profile"
import { LINK_RULES, profileLinkUrl } from "~/domain/profile-settings"
// The profile's addresses and the other profiles a member can link: each service's name, official logo where the app
// has one (the import sources' marks, used unchanged), the part of the address before the username, and the address.
import imdbLogo from "~/img/import-sources/imdb.svg?no-inline"
import letterboxdLogo from "~/img/import-sources/letterboxd.svg?no-inline"
import myanimelistLogo from "~/img/import-sources/myanimelist.svg?no-inline"
import tmdbLogo from "~/img/import-sources/tmdb.svg?no-inline"
import traktLogo from "~/img/import-sources/trakt.svg?no-inline"
import tvtimeLogo from "~/img/import-sources/tvtime.svg?no-inline"

export type ProfileTab =
	| "overview"
	| "seen"
	| "scores"
	| "wishlist"
	| "shows"
	| "lists"
	| "taste"

export const profileTabPath = (handle: string, tab: ProfileTab = "overview") =>
	tab === "overview" ? `/u/${handle}` : `/u/${handle}/${tab}`

export const EDIT_PROFILE_PATH = "/settings/profile"

interface ServiceInfo {
	name: string
	logo: string | null
	/** The letter on the tile of a service without a logo here. */
	letter: string
	prefix: string
	placeholder: string
	url: (value: string) => string
}

const LOGOS: Partial<Record<LinkService, string>> = {
	letterboxd: letterboxdLogo,
	imdb: imdbLogo,
	myanimelist: myanimelistLogo,
	trakt: traktLogo,
	tmdb: tmdbLogo,
	tvtime: tvtimeLogo,
}

/** Each service's rules (domain/profile-settings) with its logo, or the letter for its tile. */
export const LINK_SERVICE_INFO = Object.fromEntries(
	LINK_SERVICES.map((service) => {
		const rule = LINK_RULES[service]
		return [
			service,
			{
				name: rule.name,
				logo: LOGOS[service] ?? null,
				letter: rule.name.charAt(0),
				prefix: rule.prefix,
				placeholder: rule.placeholder,
				url: rule.url,
			},
		]
	}),
) as Record<LinkService, ServiceInfo>

export const linkUrl = profileLinkUrl
