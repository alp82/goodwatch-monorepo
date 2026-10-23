// What deleting an account removes from the webapp's own storage. There is no account-deletion flow yet and nothing
// calls this: it is the one place such a flow calls, so that a table added later is added here.
//
// Not covered yet, and for the flow to add: `user_score`, `user_episode_score`, `user_wishlist`, `user_favorite`,
// `user_skipped`, `user_not_interested` and `user_setting` have no deletion
// (docs/implementation/tracking/data-model.md, section 8).
const defaults = {
	unlink: async (target: { byUserId: string }) =>
		(await import("./discord/link.server.ts")).unlink(target),
	deleteAccountData: async (id: string) =>
		(await import("./share-lists/store.server.ts")).deleteAccountData(id),
	deleteTrackingData: async (id: string) =>
		(await import("./tracking.server.ts")).deleteTrackingData(id),
	deleteAvatar: async (id: string) =>
		(await import("./profile/avatar.server.ts")).deleteAvatar(id),
	handleOf: async (id: string) =>
		(
			await (
				await import("./share-lists/view.server.ts")
			).getProfileByUserId(id)
		)?.handle ?? null,
	/** The profile's cached pages and its link-preview card, which may show the photo and favorites. */
	forgetProfile: async (id: string, handle: string) =>
		(await import("./profile/settings.server.ts")).resetProfilePages(
			id,
			handle,
		),
}

/**
 * Soft-deletes the member's Discord link, share lists, profile and handle, and hard-deletes their watch log, watch states,
 * imports and profile photo, then drops their profile's cached pages and link-preview card. Each part can be run again
 * after a failure.
 */
export async function deleteMemberData(
	userId: string,
	deps = defaults,
): Promise<void> {
	// Read before the profile is soft-deleted: the caches are keyed by the handle.
	const handle = await deps.handleOf(userId)
	await deps.deleteAccountData(userId)
	await deps.deleteTrackingData(userId)
	await deps.deleteAvatar(userId)
	try {
		await deps.unlink({ byUserId: userId })
	} catch (error) {
		console.error("Account deletion: Discord unlink failed", error)
	}
	if (handle)
		try {
			await deps.forgetProfile(userId, handle)
		} catch (error) {
			console.error(
				"Account deletion: forgetting the profile's caches failed",
				error,
			)
		}
}
