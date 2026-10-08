// DEVELOPMENT HARNESS (issue #385): which sample member /prototype/my-library-real shows, shared by its route and
// its server side (server/prototype-my-library.server.ts).

/** The member who does not exist. */
export const HARNESS_MEMBER = "harness-member"

/** The sample members of round 3 of the prototypes: 6, 1 and 25 Watching shows, none, and nothing marked at all. */
export const MEMBERS = ["six", "one", "many", "none", "empty"] as const
export type MemberKey = (typeof MEMBERS)[number]

/** The Seen histories: 30 titles, 1,500 (an importer), or none. */
export const SEEN_SIZES = ["30", "1500", "0"] as const
export type SeenSize = (typeof SEEN_SIZES)[number]

export const memberOf = (value: string | null): MemberKey =>
	(MEMBERS as readonly string[]).includes(value ?? "")
		? (value as MemberKey)
		: "six"

export const seenOf = (value: string | null): SeenSize =>
	(SEEN_SIZES as readonly string[]).includes(value ?? "")
		? (value as SeenSize)
		: "30"
