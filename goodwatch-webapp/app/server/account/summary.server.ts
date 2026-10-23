// The signed-in member's handle and resolved profile picture, for the account menu.
import type { AvatarChoice } from "~/domain/profile"
import {
	type ResolvedAvatar,
	resolveAvatar,
} from "~/server/profile/avatar-choice.server"
import { getProfileSettings } from "~/server/profile/settings.server"
import { getCachedProfileByUserId } from "~/server/share-lists/view.server"
import { getUserSettings } from "~/server/user-settings.server"

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
