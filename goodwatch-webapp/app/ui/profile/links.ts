// The profile's addresses and the other profiles a member can link: each service's name, official logo where the app
// has one (the import sources' marks, used unchanged), the part of the address before the username, and the address.
import imdbLogo from "~/img/import-sources/imdb.svg?no-inline"
import letterboxdLogo from "~/img/import-sources/letterboxd.svg?no-inline"
import myanimelistLogo from "~/img/import-sources/myanimelist.svg?no-inline"
import tmdbLogo from "~/img/import-sources/tmdb.svg?no-inline"
import traktLogo from "~/img/import-sources/trakt.svg?no-inline"
import tvtimeLogo from "~/img/import-sources/tvtime.svg?no-inline"
import type { LinkService, ProfileLink } from "~/domain/profile"

export type ProfileTab = "overview" | "seen" | "scores" | "wishlist" | "shows" | "lists" | "taste"

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

export const LINK_SERVICE_INFO: Record<LinkService, ServiceInfo> = {
	letterboxd: { name: "Letterboxd", logo: letterboxdLogo, letter: "L", prefix: "letterboxd.com/", placeholder: "username", url: (v) => `https://letterboxd.com/${v}/` },
	imdb: { name: "IMDb", logo: imdbLogo, letter: "I", prefix: "imdb.com/user/", placeholder: "ur12345678", url: (v) => `https://www.imdb.com/user/${v}/` },
	myanimelist: { name: "MyAnimeList", logo: myanimelistLogo, letter: "M", prefix: "myanimelist.net/profile/", placeholder: "username", url: (v) => `https://myanimelist.net/profile/${v}` },
	trakt: { name: "Trakt", logo: traktLogo, letter: "T", prefix: "trakt.tv/users/", placeholder: "username", url: (v) => `https://trakt.tv/users/${v}` },
	tmdb: { name: "TMDB", logo: tmdbLogo, letter: "T", prefix: "themoviedb.org/u/", placeholder: "username", url: (v) => `https://www.themoviedb.org/u/${v}` },
	tvtime: { name: "TV Time", logo: tvtimeLogo, letter: "T", prefix: "tvtime.com/user/", placeholder: "user id", url: (v) => `https://www.tvtime.com/user/${v}` },
	simkl: { name: "Simkl", logo: null, letter: "S", prefix: "simkl.com/", placeholder: "user id", url: (v) => `https://simkl.com/${v}/` },
	anilist: { name: "AniList", logo: null, letter: "A", prefix: "anilist.co/user/", placeholder: "username", url: (v) => `https://anilist.co/user/${v}/` },
	serializd: { name: "Serializd", logo: null, letter: "S", prefix: "serializd.com/user/", placeholder: "username", url: (v) => `https://www.serializd.com/user/${v}` },
	instagram: { name: "Instagram", logo: null, letter: "I", prefix: "instagram.com/", placeholder: "username", url: (v) => `https://instagram.com/${v}` },
	website: { name: "Website", logo: null, letter: "W", prefix: "https://", placeholder: "example.com", url: (v) => `https://${v.replace(/^https?:\/\//, "")}` },
}

export const linkUrl = (link: ProfileLink) => LINK_SERVICE_INFO[link.service].url(link.value.trim())
