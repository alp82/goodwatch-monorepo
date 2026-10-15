// PROTOTYPE - throwaway (#659). Watch next needs a Wishlist: #657's members are picked by ratings alone, and the small
// ones may have none. Here: the owner as #657 finds them, then members with at least MIN_MOVIES movies on their
// Wishlist: first the one of personal order's test group with the most ratings (so personal order ranks a second
// list), then by how many ratings they have, so the variants meet a big, a middling and a small history. No ids
// are kept in files; the page names members only as "Member 1", "Member 2", and so on.
import { personalOrderMembers, protoMembers, type ProtoMember } from "~/server/prototype-better-sides/members.server"
import { query } from "~/utils/crate"

const TARGETS = [450, 250, 120, 60, 30]
const MIN_MOVIES = 15
let picked: { at: number; members: ProtoMember[] } | null = null
/** How the members were picked, for the data bar. */
export let membersNote = ""

export async function swnMembers(): Promise<ProtoMember[]> {
	if (picked && Date.now() - picked.at < 30 * 60_000) return picked.members
	const [base, withOrder, wishlists, ratings] = await Promise.all([
		protoMembers(),
		personalOrderMembers(),
		query<{ user_id: string; n: number }>(
			"SELECT user_id, count(*) AS n FROM user_wishlist WHERE media_type = 'movie' GROUP BY user_id HAVING count(*) >= ? ORDER BY n DESC LIMIT 2000",
			[MIN_MOVIES],
			{ timeoutMs: 60_000 },
		),
		query<{ user_id: string; n: number }>("SELECT user_id, count(*) AS n FROM user_score WHERE score > 0 GROUP BY user_id ORDER BY n DESC LIMIT 2000", [], {
			timeoutMs: 60_000,
		}),
	])
	const owner = base.find((m) => m.slot === "owner")
	const listed = new Set(wishlists.map((r) => r.user_id))
	const pool = ratings.filter((r) => listed.has(r.user_id) && r.user_id !== owner?.userId).map((r) => ({ userId: r.user_id, ratings: Number(r.n) }))
	const used = new Set<string>()
	const members: ProtoMember[] = owner ? [owner] : []
	const ordered = new Set(withOrder)
	const tester = pool.find((p) => ordered.has(p.userId))
	if (tester) {
		used.add(tester.userId)
		members.push({ slot: "m1", label: "Member 1", userId: tester.userId, ratings: tester.ratings })
	}
	for (const target of TARGETS) {
		if (members.length > TARGETS.length) break
		const best = pool.filter((p) => !used.has(p.userId)).sort((a, b) => Math.abs(a.ratings - target) - Math.abs(b.ratings - target))[0]
		if (!best) break
		used.add(best.userId)
		const n = members.length - (owner ? 0 : -1)
		members.push({ slot: `m${n}`, label: `Member ${n}`, userId: best.userId, ratings: best.ratings })
	}
	membersNote = `${ordered.size} members have a personal order; ${pool.filter((p) => ordered.has(p.userId)).length} of them (besides the owner) have ${MIN_MOVIES}+ movies on their Wishlist`
	picked = { at: Date.now(), members }
	return members
}
