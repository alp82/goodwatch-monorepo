// The signed-in member's handle and resolved profile picture, for the account menu (and the link-preview card).
import type { AvatarChoice, AvatarColor } from "~/domain/profile"
import { avatarPath, avatarVersion } from "~/server/profile/avatar.server"
import { getProfileSettings } from "~/server/profile/settings.server"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { titleDisplays } from "~/server/taste-portrait/display.server"
import { getUserSettings } from "~/server/user-settings.server"
import { titleKey } from "~/utils/title-key"

export interface ResolvedAvatar {
	/** An image URL (photo, the sign-in provider's photo, or a poster); null for the initial on a colour. */
	url: string | null
	color: AvatarColor
}

const posterUrl = (path: string) => `https://image.tmdb.org/t/p/w185${path}`

/** Turns a picture choice into what to draw. A choice that can't be drawn (no photo, no provider photo, an unknown
 * title) falls back to the initial on amber. */
export async function resolveAvatar(
	userId: string,
	handle: string | null,
	choice: AvatarChoice,
	providerPhoto: string | null,
): Promise<ResolvedAvatar> {
	const initial = (color: AvatarColor = "amber"): ResolvedAvatar => ({
		url: null,
		color,
	})
	if (choice.kind === "initial") return initial(choice.color)
	if (choice.kind === "provider")
		return providerPhoto ? { url: providerPhoto, color: "amber" } : initial()
	if (choice.kind === "photo") {
		if (!handle) return initial()
		const version = await avatarVersion(userId)
		return version
			? { url: avatarPath(handle, version), color: "amber" }
			: initial()
	}
	const match = /^(movie|show)-(\d+)$/.exec(choice.title)
	if (!match) return initial()
	const key = titleKey(match[1] as "movie" | "show", Number(match[2]))
	const poster = (await titleDisplays([key])).get(key)?.poster
	return poster ? { url: posterUrl(poster), color: "amber" } : initial()
}

export interface AccountSummary {
	handle: string | null
	avatar: ResolvedAvatar
}

/** `sessionPhoto` is the sign-in provider's photo from the session, used when none was stored with the settings. */
export async function getAccountSummary(
	userId: string,
	sessionPhoto: string | null,
): Promise<AccountSummary> {
	const [profile, settings, stored] = await Promise.all([
		getCachedProfileByUserId(userId),
		getProfileSettings(userId),
		getUserSettings({ userId }),
	])
	const handle = profile?.handle ?? null
	const providerPhoto = settings.providerPhoto ?? sessionPhoto
	// Until a member picks a picture, the menu (theirs alone) keeps their provider's photo, as the old menu did; the
	// public profile shows the initial until they choose.
	const chosen = Boolean(stored.profile_avatar)
	const choice: AvatarChoice =
		chosen || !providerPhoto ? settings.avatar : { kind: "provider" }
	const avatar = await resolveAvatar(userId, handle, choice, providerPhoto)
	return { handle, avatar }
}
