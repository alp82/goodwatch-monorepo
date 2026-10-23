import type { MediaKey } from "~/types/user-data"
// What a member may save as their profile: the bio, links to their other profiles, the picture, the cover and who sees
// which part. Pure, so Edit profile can check a value in the browser with the same rules the server applies.
// Spec: docs/implementation/member-profile/README.md
import {
	AUDIENCES,
	AVATAR_COLORS,
	type Audience,
	type AvatarChoice,
	type AvatarColor,
	BIO_MAX,
	LINK_SERVICES,
	type LinkService,
	MAX_LINKS,
	PROFILE_PARTS,
	type ProfileLink,
	type ProfileSettings,
	parseVisibility,
} from "./profile"

interface LinkRule {
	name: string
	/** Shown before the field: "letterboxd.com/". */
	prefix: string
	placeholder: string
	/** What the value may be, after a leading "@" and surrounding spaces are removed. */
	pattern: RegExp
	url: (value: string) => string
}

/** Each service's name, address and username rules. Website takes a domain with an optional path. */
export const LINK_RULES: Record<LinkService, LinkRule> = {
	letterboxd: {
		name: "Letterboxd",
		prefix: "letterboxd.com/",
		placeholder: "username",
		pattern: /^[A-Za-z0-9_]{2,15}$/,
		url: (v) => `https://letterboxd.com/${v}/`,
	},
	imdb: {
		name: "IMDb",
		prefix: "imdb.com/user/",
		placeholder: "ur12345678",
		pattern: /^ur\d{6,10}$/,
		url: (v) => `https://www.imdb.com/user/${v}/`,
	},
	myanimelist: {
		name: "MyAnimeList",
		prefix: "myanimelist.net/profile/",
		placeholder: "username",
		pattern: /^[A-Za-z0-9_-]{2,16}$/,
		url: (v) => `https://myanimelist.net/profile/${v}`,
	},
	trakt: {
		name: "Trakt",
		prefix: "trakt.tv/users/",
		placeholder: "username",
		pattern: /^[A-Za-z0-9_.-]{1,40}$/,
		url: (v) => `https://trakt.tv/users/${v}`,
	},
	tmdb: {
		name: "TMDB",
		prefix: "themoviedb.org/u/",
		placeholder: "username",
		pattern: /^[A-Za-z0-9_.-]{1,40}$/,
		url: (v) => `https://www.themoviedb.org/u/${v}`,
	},
	tvtime: {
		name: "TV Time",
		prefix: "tvtime.com/user/",
		placeholder: "user id",
		pattern: /^[A-Za-z0-9_-]{1,40}$/,
		url: (v) => `https://www.tvtime.com/user/${v}`,
	},
	simkl: {
		name: "Simkl",
		prefix: "simkl.com/",
		placeholder: "user id",
		pattern: /^[A-Za-z0-9_-]{1,40}$/,
		url: (v) => `https://simkl.com/${v}/`,
	},
	anilist: {
		name: "AniList",
		prefix: "anilist.co/user/",
		placeholder: "username",
		pattern: /^[A-Za-z0-9]{2,20}$/,
		url: (v) => `https://anilist.co/user/${v}/`,
	},
	serializd: {
		name: "Serializd",
		prefix: "serializd.com/user/",
		placeholder: "username",
		pattern: /^[A-Za-z0-9_.]{1,30}$/,
		url: (v) => `https://www.serializd.com/user/${v}`,
	},
	instagram: {
		name: "Instagram",
		prefix: "instagram.com/",
		placeholder: "username",
		pattern: /^[A-Za-z0-9_.]{1,30}$/,
		url: (v) => `https://www.instagram.com/${v}/`,
	},
	website: {
		name: "Website",
		prefix: "https://",
		placeholder: "example.com",
		// A domain with at least one dot, then an optional path; no spaces, quotes or angle brackets.
		pattern:
			/^(?=.{4,100}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/[A-Za-z0-9\-._~%/]*)?$/,
		url: (v) => `https://${v}`,
	},
}

/** A link's value as stored: without a leading "@", spaces, or (for a website) the scheme and a trailing slash. */
export function normalizeLinkValue(service: LinkService, raw: string): string {
	const value = raw.trim().replace(/^@/, "")
	if (service !== "website") return value
	return value
		.replace(/^https?:\/\//i, "")
		.replace(/\/+$/, "")
		.replace(/^[^/]+/, (host) => host.toLowerCase())
}

export const profileLinkUrl = (link: ProfileLink) =>
	LINK_RULES[link.service].url(link.value)

export type SettingsProblem = {
	field: "bio" | "links" | "avatar" | "cover" | "visibility"
	message: string
}

/** Removes control characters and keeps at most two line breaks in a row. */
export function cleanBio(raw: string): string {
	return (
		raw
			// biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the point
			.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
			.replace(/\n{3,}/g, "\n\n")
			.trim()
	)
}

const isAvatarColor = (value: unknown): value is AvatarColor =>
	AVATAR_COLORS.includes(value as AvatarColor)
const TITLE_KEY = /^(movie|show)-[1-9]\d{0,9}$/

/** A stored title key ("movie-550") as a MediaKey; null when it isn't one. */
export const asMediaKey = (
	value: string | null | undefined,
): MediaKey | null =>
	value && TITLE_KEY.test(value) ? (value as MediaKey) : null

/** Reads a stored or submitted picture choice; null when it isn't one. */
export function parseAvatarChoice(value: unknown): AvatarChoice | null {
	if (!value || typeof value !== "object") return null
	const v = value as Record<string, unknown>
	if (v.kind === "photo" || v.kind === "provider") return { kind: v.kind }
	if (v.kind === "initial" && isAvatarColor(v.color))
		return { kind: "initial", color: v.color }
	if (
		v.kind === "poster" &&
		typeof v.title === "string" &&
		TITLE_KEY.test(v.title)
	)
		return { kind: "poster", title: v.title }
	return null
}

/**
 * Checks and cleans submitted settings. `scored` tells whether the member scored a title (a poster or cover must be
 * one of theirs); `hasPhoto` whether they uploaded a photo; `hasProviderPhoto` whether their sign-in has one.
 */
export function validateProfileSettings(
	input: {
		bio?: unknown
		links?: unknown
		avatar?: unknown
		cover?: unknown
		visibility?: unknown
	},
	context: {
		scored: (key: string) => boolean
		hasPhoto: boolean
		hasProviderPhoto: boolean
	},
):
	| { ok: true; settings: ProfileSettings }
	| { ok: false; problems: SettingsProblem[] } {
	const problems: SettingsProblem[] = []

	const bio = typeof input.bio === "string" ? cleanBio(input.bio) : ""
	if (input.bio != null && typeof input.bio !== "string")
		problems.push({ field: "bio", message: "The bio must be text." })
	if (bio.length > BIO_MAX)
		problems.push({
			field: "bio",
			message: `The bio can be at most ${BIO_MAX} characters.`,
		})

	const links: ProfileLink[] = []
	if (input.links != null && !Array.isArray(input.links))
		problems.push({ field: "links", message: "Links must be a list." })
	for (const raw of Array.isArray(input.links) ? input.links : []) {
		const service = (raw as { service?: unknown })?.service
		const value = (raw as { value?: unknown })?.value
		if (
			!LINK_SERVICES.includes(service as LinkService) ||
			typeof value !== "string"
		) {
			problems.push({ field: "links", message: "Unknown link." })
			continue
		}
		const s = service as LinkService
		const clean = normalizeLinkValue(s, value)
		if (!clean) continue
		if (!LINK_RULES[s].pattern.test(clean)) {
			problems.push({
				field: "links",
				message: `That isn't a ${LINK_RULES[s].name} ${LINK_RULES[s].placeholder}.`,
			})
			continue
		}
		if (links.some((l) => l.service === s)) {
			problems.push({
				field: "links",
				message: `${LINK_RULES[s].name} is in the list twice.`,
			})
			continue
		}
		links.push({ service: s, value: clean })
	}
	if (links.length > MAX_LINKS)
		problems.push({ field: "links", message: `At most ${MAX_LINKS} links.` })

	const avatar = parseAvatarChoice(
		input.avatar ?? { kind: "initial", color: "amber" },
	)
	if (!avatar) problems.push({ field: "avatar", message: "Unknown picture." })
	else if (avatar.kind === "photo" && !context.hasPhoto)
		problems.push({ field: "avatar", message: "Upload a photo first." })
	else if (avatar.kind === "provider" && !context.hasProviderPhoto)
		problems.push({ field: "avatar", message: "Your sign-in has no photo." })
	else if (avatar.kind === "poster" && !context.scored(avatar.title))
		problems.push({
			field: "avatar",
			message: "Pick a poster of a title you scored.",
		})

	let cover: string | null = null
	if (input.cover != null && input.cover !== "") {
		if (
			typeof input.cover !== "string" ||
			!TITLE_KEY.test(input.cover) ||
			!context.scored(input.cover)
		)
			problems.push({
				field: "cover",
				message: "Pick a cover from a title you scored.",
			})
		else cover = input.cover
	}

	// The whole map, every time: a part left out must not quietly fall back to Everyone.
	const given = input.visibility as Record<string, unknown> | null | undefined
	if (
		!given ||
		typeof given !== "object" ||
		!PROFILE_PARTS.every((part) => AUDIENCES.includes(given[part] as Audience))
	)
		problems.push({
			field: "visibility",
			message: "Say who sees each part of your profile.",
		})
	const visibility = parseVisibility(input.visibility)

	if (problems.length) return { ok: false, problems }
	return {
		ok: true,
		settings: { bio, links, avatar: avatar as AvatarChoice, cover, visibility },
	}
}
