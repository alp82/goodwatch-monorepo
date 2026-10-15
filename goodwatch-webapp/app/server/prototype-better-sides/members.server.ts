// PROTOTYPE - throwaway (#657). Picks the members the better-sides prototype shows, at runtime: the signed-in viewer
// ("me"), and members chosen by how many ratings they have, so the variants meet a big, a middling and a small
// history. No member ids are kept in files; the page names members only as "Member 1", "Member 2", and so on.
import { getRedisCluster } from "~/utils/cache"
import { query } from "~/utils/crate"

export interface ProtoMember {
	/** "m1".."m5": the address's `?as=`. */
	slot: string
	label: string
	userId: string
	ratings: number
}

// Ratings counts to look for: the most, then the members closest to these.
const TARGETS = [400, 150, 60, 25]
let picked: { at: number; members: ProtoMember[] } | null = null

export async function protoMembers(): Promise<ProtoMember[]> {
	if (picked && Date.now() - picked.at < 30 * 60_000) return picked.members
	const rows = await query<{ user_id: string; n: number }>(
		"SELECT user_id, count(*) AS n FROM user_score WHERE score > 0 GROUP BY user_id ORDER BY n DESC LIMIT 400",
		[],
		{ timeoutMs: 60_000 },
	)
	const used = new Set<string>()
	const take = (row: { user_id: string; n: number } | undefined) => {
		if (!row || used.has(row.user_id)) return null
		used.add(row.user_id)
		return row
	}
	// The owner: the member with a published personal order (the only member in its group today).
	const owner = (await personalOrderMembers())[0]
	const ownerRow = owner ? (rows.find((r) => r.user_id === owner) ?? { user_id: owner, n: 0 }) : undefined
	const chosen = ownerRow ? [take(ownerRow), take(rows.find((r) => r.user_id !== owner))] : [take(rows[0])]
	for (const target of TARGETS) {
		const row = [...rows]
			.filter((r) => !used.has(r.user_id))
			.sort((a, b) => Math.abs(a.n - target) - Math.abs(b.n - target))[0]
		chosen.push(take(row))
	}
	const members = chosen
		.filter((r): r is { user_id: string; n: number } => r !== null)
		.map((r, i) => ({
			slot: ownerRow && i === 0 ? "owner" : `m${ownerRow ? i : i + 1}`,
			label: ownerRow && i === 0 ? "Owner" : `Member ${ownerRow ? i : i + 1}`,
			userId: r.user_id,
			ratings: Number(r.n),
		}))
	picked = { at: Date.now(), members }
	return members
}

/** Members with a personal order payload, found by scanning the primaries for its keys. */
async function personalOrderMembers(): Promise<string[]> {
	const cluster = getRedisCluster() as unknown as { nodes(role: string): { scan(...args: unknown[]): Promise<[string, string[]]> }[] } | null
	if (!cluster) return []
	const found: string[] = []
	for (const node of cluster.nodes("master")) {
		let cursor = "0"
		do {
			const [next, keys] = await node.scan(cursor, "MATCH", "personal-order:v1:*", "COUNT", 5000)
			cursor = next
			for (const key of keys) found.push(key.slice("personal-order:v1:".length))
		} while (cursor !== "0")
	}
	return found
}
