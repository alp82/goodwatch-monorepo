// What deleting an account (#553) removes from the webapp's own storage: every member table in CrateDB
// (account-deletion-tables.ts) and the member's caches. Better Auth's deleteUser calls it (server/auth/auth.server.ts)
// before it deletes the sign-in rows, and once more after, for rows a request that was already running wrote late.
// The sign-in rows, sessions and app grants are Better Auth's and the adapter's (#548): they keep a tombstone that
// holds only the row's id, which maintenance purges after 30 days (#565).
import {
	type MemberTable,
	MEMBER_TABLES,
} from "~/server/account-deletion-tables"
import { deleteMcpActions } from "~/server/mcp/actions.server"
import { deleteAccountData } from "~/server/share-lists/store.server"
import { markTasteChanged } from "~/server/taste/index.server"
import { deleteTrackingData } from "~/server/tracking.server"
import { resetUserSettingsCache } from "~/server/user-settings.server"
import { resetUserDataCache } from "~/server/userData.server"
import { execute, query } from "~/utils/crate"

// Deleted by their own writers above, which also reset the caches that hold them.
const OWN_WRITERS: readonly MemberTable[] = [
	"user_list",
	"user_profile",
	"user_handle",
	"user_watch_log",
	"user_watch_state",
	"user_import",
	"user_import_item",
	"user_mcp_action",
]
const REST = MEMBER_TABLES.filter((table) => !OWN_WRITERS.includes(table))

const isMissingTable = (error: unknown) =>
	/RelationUnknown|SchemaUnknown/.test(
		String((error as { message?: unknown } | null)?.message ?? error),
	)

/**
 * Removes the member's rows from every member table and starts their caches over. Hard deletes, except that a
 * share-list handle stays claimed without the member's id (share-lists/store.server.ts). Each part can run again
 * after a failure; a table that does not exist holds nothing to delete.
 */
export async function deleteMemberData(userId: string): Promise<void> {
	if (!userId) throw new Error("A member id is required")
	await deleteAccountData(userId)
	await deleteTrackingData(userId)
	await deleteMcpActions(userId)
	for (const table of REST)
		try {
			// A delete by member names no row by its whole key, so it works on the rows of the last refresh.
			await execute(`REFRESH TABLE ${table}`)
			await execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId])
		} catch (error) {
			if (!isMissingTable(error)) throw error
		}
	await Promise.all([
		resetUserDataCache({ user_id: userId }),
		resetUserSettingsCache({ user_id: userId }),
		// The taste rebuild finds no ratings and stores an empty taste; the Taste page's views are cleared.
		markTasteChanged(userId),
	])
}

/** How many rows each member table holds for the member, after a refresh: all zero once their account is deleted. */
export async function memberRowCounts(
	userId: string,
): Promise<Record<MemberTable, number>> {
	const counts = {} as Record<MemberTable, number>
	for (const table of MEMBER_TABLES)
		try {
			await execute(`REFRESH TABLE ${table}`)
			const [row] = await query<{ count: number }>(
				`SELECT count(*) AS count FROM ${table} WHERE user_id = ?`,
				[userId],
			)
			counts[table] = Number(row?.count ?? 0)
		} catch (error) {
			if (!isMissingTable(error)) throw error
			counts[table] = 0
		}
	return counts
}
