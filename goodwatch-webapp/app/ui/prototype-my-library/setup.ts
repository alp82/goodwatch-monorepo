// DEVELOPMENT HARNESS (issue #385): which sample member /prototype/my-library-real shows, shared by its route and
// its server side (server/prototype-my-library.server.ts).

/** The member who does not exist. */
export const HARNESS_MEMBER = "harness-member"

/**
 * The sample members of round 3 of the prototypes: 6, 1 and 25 Watching shows, none, and nothing marked at all. And
 * `new` (#442): a member who opened My shows five days ago, with shows that returned since and shows waiting.
 */
export const MEMBERS = ["six", "one", "many", "none", "empty", "new"] as const
export type MemberKey = (typeof MEMBERS)[number]

/** The Seen histories: 30 titles, 1,500 (an importer), or none. */
export const SEEN_SIZES = ["30", "1500", "0"] as const
export type SeenSize = (typeof SEEN_SIZES)[number]

/**
 * What landed on the member's services (#456), for any sample member: nothing, one movie, one show, or four movies
 * and two shows on two services, 1 to 12 days ago. `episode` (#489) is for the member `new`: Slow Horses, whose new
 * episode aired since their visit, landed two days ago. `old` is one movie 12 days ago, which still counts, and
 * `gone` the same movie 15 days ago, which does not. Every offer is after the member's last visit of either page.
 */
export const LANDED = [
	"none",
	"movie",
	"show",
	"several",
	"episode",
	"old",
	"gone",
] as const
export type LandedKey = (typeof LANDED)[number]

export const landedOf = (value: string | null): LandedKey =>
	(LANDED as readonly string[]).includes(value ?? "")
		? (value as LandedKey)
		: "none"

export const memberOf = (value: string | null): MemberKey =>
	(MEMBERS as readonly string[]).includes(value ?? "")
		? (value as MemberKey)
		: "six"

export const seenOf = (value: string | null): SeenSize =>
	(SEEN_SIZES as readonly string[]).includes(value ?? "")
		? (value as SeenSize)
		: "30"
