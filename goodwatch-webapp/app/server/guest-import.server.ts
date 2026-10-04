import { markTasteChanged } from "~/server/taste/index.server"
import { resetUserSettingsCache } from "~/server/user-settings.server"
import { resetUserDataCache } from "~/server/userData.server"

/** After a guest progress transfer wrote ratings, Want to See, or settings: the member's caches start over. */
export async function resetGuestImportCaches(userId: string) {
	await Promise.all([
		resetUserDataCache({ user_id: userId }),
		resetUserSettingsCache({ user_id: userId }),
		markTasteChanged(userId),
	])
}
