/**
 * Every CrateDB table that holds a member's rows, keyed or filtered by `user_id` (#553). Account deletion empties each
 * of them for the member. A `user_*` table declared in goodwatch-flows/windmill/f/sync/models/crate_schemas.py and
 * missing here fails account-deletion-tables.test.ts.
 */
export const MEMBER_TABLES = [
	"user_score",
	"user_wishlist",
	"user_favorite",
	"user_skipped",
	"user_not_interested",
	"user_setting",
	"user_watch_log",
	"user_watch_state",
	"user_import",
	"user_import_item",
	"user_import_connection",
	"user_mcp_action",
	"user_list_exposure",
	"user_list",
	"user_profile",
	"user_handle",
] as const

export type MemberTable = (typeof MEMBER_TABLES)[number]
