// What deleting an account removes from the webapp's own storage. There is no account-deletion flow yet and nothing
// calls this: it is the one place such a flow calls, so that a table added later is added here.
//
// Not covered yet, and for the flow to add: `user_score`, `user_wishlist`, `user_favorite`, `user_skipped`,
// `user_not_interested` and `user_setting` have no deletion (docs/implementation/tracking/data-model.md, section 8).
import { deleteAccountData } from "~/server/share-lists/store.server"
import { deleteTrackingData } from "~/server/tracking.server"

/**
 * Soft-deletes the member's share lists, profile and handle, and hard-deletes their watch log, watch states and
 * imports. Each part can be run again after a failure.
 */
export async function deleteMemberData(userId: string): Promise<void> {
	await deleteAccountData(userId)
	await deleteTrackingData(userId)
}
