// What deleting an account removes from the webapp's own storage. There is no account-deletion flow yet and nothing
// calls this: it is the one place such a flow calls, so that a table added later is added here.
//
// Not covered yet, and for the flow to add: `user_score`, `user_wishlist`, `user_favorite`, `user_skipped`,
// `user_not_interested` and `user_setting` have no deletion (docs/implementation/tracking/data-model.md, section 8).
const defaults = {
	unlink: async (target: { byUserId: string }) =>
		(await import("./discord/link.server.ts")).unlink(target),
	deleteAccountData: async (id: string) =>
		(await import("./share-lists/store.server.ts")).deleteAccountData(id),
	deleteTrackingData: async (id: string) =>
		(await import("./tracking.server.ts")).deleteTrackingData(id),
	deleteAvatar: async (id: string) =>
		(await import("./profile/avatar.server.ts")).deleteAvatar(id),
}

/**
 * Soft-deletes the member's Discord link, share lists, profile and handle, and hard-deletes their watch log, watch states,
 * imports and profile photo. Each part can be run again after a failure.
 */
export async function deleteMemberData(
	userId: string,
	deps = defaults,
): Promise<void> {
	await deps.deleteAccountData(userId)
	await deps.deleteTrackingData(userId)
	await deps.deleteAvatar(userId)
	try {
		await deps.unlink({ byUserId: userId })
	} catch (error) {
		console.error("Account deletion: Discord unlink failed", error)
	}
}
