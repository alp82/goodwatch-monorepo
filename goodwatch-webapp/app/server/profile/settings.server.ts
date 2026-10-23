// A member's profile settings (bio, links, picture, cover, who sees what), kept as user_setting keys: no table of their
// own, and the settings cache (5 minutes, reset on write) serves every profile view.
// Spec: docs/implementation/member-profile/README.md
import {
	DEFAULT_PROFILE_SETTINGS,
	LINK_SERVICES,
	type LinkService,
	type ProfileLink,
	type ProfileSettings,
	parseVisibility,
} from "~/domain/profile"
import { LINK_RULES, parseAvatarChoice } from "~/domain/profile-settings"
import type { UserSettingsMap } from "~/routes/api.user-settings.get"
import { resetPageCache } from "~/server/page-cache.server"
import {
	getCachedProfileByUserId,
	resetProfileViews,
} from "~/server/share-lists/view.server"
import { getUserSettings, setUserSettings } from "~/server/user-settings.server"

export const PROFILE_KEYS = {
	bio: "profile_bio",
	links: "profile_links",
	avatar: "profile_avatar",
	cover: "profile_cover",
	visibility: "profile_visibility",
	noticeSeen: "profile_public_notice_seen",
	providerPhoto: "profile_provider_photo",
} as const satisfies Record<string, keyof UserSettingsMap>

const parseJson = (raw: string | undefined): unknown => {
	if (!raw) return undefined
	try {
		return JSON.parse(raw)
	} catch {
		return undefined
	}
}

/** Stored links, dropping any that no longer pass their service's rule. */
function parseLinks(raw: unknown): ProfileLink[] {
	if (!Array.isArray(raw)) return []
	return raw.flatMap((link): ProfileLink[] => {
		const service = link?.service as LinkService
		const value = link?.value
		return LINK_SERVICES.includes(service) &&
			typeof value === "string" &&
			LINK_RULES[service].pattern.test(value)
			? [{ service, value }]
			: []
	})
}

export interface StoredProfileSettings extends ProfileSettings {
	noticeSeen: boolean
	providerPhoto: string | null
	/** Whether the member chose a cover (or none); until then the profile uses their latest favorite's backdrop. */
	coverChosen: boolean
}

/** The member's profile settings, with the defaults for anything not saved. */
export async function getProfileSettings(
	userId: string,
): Promise<StoredProfileSettings> {
	const stored = await getUserSettings({ userId })
	const cover = stored.profile_cover ?? ""
	return {
		bio: stored.profile_bio ?? DEFAULT_PROFILE_SETTINGS.bio,
		links: parseLinks(parseJson(stored.profile_links)),
		avatar:
			parseAvatarChoice(parseJson(stored.profile_avatar)) ??
			DEFAULT_PROFILE_SETTINGS.avatar,
		cover: /^(movie|show)-\d+$/.test(cover) ? cover : null,
		visibility: parseVisibility(parseJson(stored.profile_visibility)),
		noticeSeen: stored.profile_public_notice_seen === "yes",
		providerPhoto: isHttpsUrl(stored.profile_provider_photo)
			? (stored.profile_provider_photo as string)
			: null,
		coverChosen: stored.profile_cover !== undefined,
	}
}

export const isHttpsUrl = (value: unknown): value is string => {
	if (typeof value !== "string" || value.length > 1000) return false
	try {
		return new URL(value).protocol === "https:"
	} catch {
		return false
	}
}

/**
 * Saves settings already checked by validateProfileSettings. `providerPhoto` is the sign-in provider's photo URL when
 * the member picked it (read from their own session), kept so other people's views can show it.
 */
export async function saveProfileSettings(
	userId: string,
	settings: ProfileSettings,
	providerPhoto: string | null,
): Promise<boolean> {
	const values: Partial<UserSettingsMap> = {
		[PROFILE_KEYS.bio]: settings.bio,
		[PROFILE_KEYS.links]: JSON.stringify(settings.links),
		[PROFILE_KEYS.avatar]: JSON.stringify(settings.avatar),
		[PROFILE_KEYS.cover]: settings.cover ?? "",
		[PROFILE_KEYS.visibility]: JSON.stringify(settings.visibility),
		// Saving Edit profile is choosing what's shown: the "your profile is public now" notice has done its job.
		[PROFILE_KEYS.noticeSeen]: "yes",
	}
	if (settings.avatar.kind === "provider" && providerPhoto)
		values[PROFILE_KEYS.providerPhoto] = providerPhoto
	const result = await setUserSettings({ user_id: userId, settings: values })
	return result !== null
}

export async function markProfileNoticeSeen(userId: string): Promise<void> {
	await setUserSettings({
		user_id: userId,
		settings: { [PROFILE_KEYS.noticeSeen]: "yes" },
	})
}

/** Clears the bio (the admin script's removal). */
export async function clearProfileBio(userId: string): Promise<void> {
	await setUserSettings({
		user_id: userId,
		settings: { [PROFILE_KEYS.bio]: "" },
	})
}

/** After the photo is removed, a picture choice of "photo" falls back to the initial. */
export async function dropPhotoChoice(userId: string): Promise<void> {
	const current = await getProfileSettings(userId)
	if (current.avatar.kind !== "photo") return
	await setUserSettings({
		user_id: userId,
		settings: {
			[PROFILE_KEYS.avatar]: JSON.stringify(DEFAULT_PROFILE_SETTINGS.avatar),
		},
	})
}

/** Drops this process's cached pages of the member's profile and its tabs, after a settings or photo change. */
export async function resetProfilePages(userId: string): Promise<void> {
	await resetProfileViews(userId)
	const profile = await getCachedProfileByUserId(userId)
	if (!profile) return
	const base = `/u/${profile.handle}`
	resetPageCache((path) => {
		const p = path.toLowerCase()
		return p === base || p.startsWith(`${base}/`) || p.startsWith(`${base}?`)
	})
}
