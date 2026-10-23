// A member's picture choice turned into what to draw: one place for the profile header, the account menu and the
// link-preview card, so the three always agree.
import type { AvatarChoice, AvatarColor } from "~/domain/profile"
import { asMediaKey } from "~/domain/profile-settings"
import { titleDisplays } from "~/server/taste-portrait/display.server"
import { parseMediaKey } from "~/types/user-data"
import { titleKey } from "~/utils/title-key"
import { avatarPath, avatarVersion } from "./avatar.server"

export interface ResolvedAvatar {
	/** An image URL (photo, the sign-in provider's photo, or a poster); null for the initial on a colour. */
	url: string | null
	color: AvatarColor
}

export const TMDB_POSTER_W185 = "https://image.tmdb.org/t/p/w185"

/** A choice that can't be drawn (no photo, no provider photo, an unknown title) falls back to the initial on amber. */
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
	const key = asMediaKey(choice.title)
	if (!key) return initial()
	const { mediaType, tmdbId } = parseMediaKey(key)
	const tk = titleKey(mediaType, tmdbId)
	const poster = (await titleDisplays([tk])).get(tk)?.poster
	return poster
		? { url: `${TMDB_POSTER_W185}${poster}`, color: "amber" }
		: initial()
}
