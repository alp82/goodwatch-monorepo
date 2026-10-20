// Release snapshots and acknowledgments are immutable settings, separate from show status.
// A stale tab can acknowledge only the snapshot it displayed, never a later release.
import { z } from "zod"
import type { NewShow } from "~/domain/new-episodes"
import { execute, query, upsert } from "~/utils/crate"

const PREFIX = "show_release:"
const BASELINE = "show_release_since"
const snapshot = z.object({
	id: z.number().int().positive(),
	pass: z.number().int().positive(),
	season: z.number().int().positive(),
	number: z.number().int().positive(),
	through: z.number().int().positive(),
	airDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	episodes: z.number().int().positive(),
	aired: z.array(z.number().int().positive()).min(1),
})
export type Release = z.infer<typeof snapshot>
export const sequence = (episode: { season: number; number: number }) =>
	episode.season * 100000 + episode.number
export const releaseKey = (release: Release) =>
	`${PREFIX}${release.id}:${release.pass}:${sequence(release)}`
const ackKey = (key: string) => `show_release_ack:${key.slice(PREFIX.length)}`

async function setting(userId: string, key: string): Promise<string | null> {
	const [row] = await query<{ value: string }>(
		"SELECT value FROM user_setting WHERE user_id = ? AND key = ?",
		[userId, key],
	)
	return row?.value ?? null
}
async function insert(userId: string, key: string, value: string) {
	return await upsert({
		table: "user_setting",
		data: [{ user_id: userId, key, value }],
		conflictColumns: ["user_id", "key"],
		ignoreUpdate: true,
	})
}

/** Freeze the initial seven-day window; page visits never advance it. */
export async function announcementBaseline(
	userId: string,
	now: number,
): Promise<number> {
	let value = await setting(userId, BASELINE)
	if (value === null) {
		await insert(userId, BASELINE, new Date(now - 7 * 86400000).toISOString())
		value = await setting(userId, BASELINE)
	}
	const at = Date.parse(value ?? "")
	if (!Number.isFinite(at))
		throw new Error("Invalid show announcement baseline")
	return at
}

export async function readReleases(userId: string): Promise<Release[]> {
	const rows = await query<{ value: string }>(
		"SELECT value FROM user_setting WHERE user_id = ? AND key >= ? AND key < ? LIMIT 10000",
		[userId, PREFIX, "show_release;"],
	)
	return rows.flatMap((row) => {
		try {
			const parsed = snapshot.safeParse(JSON.parse(row.value))
			return parsed.success ? [parsed.data] : []
		} catch {
			return []
		}
	})
}

export async function rememberRelease(
	userId: string,
	release: Release,
): Promise<Release> {
	const saved = await insert(
		userId,
		releaseKey(release),
		JSON.stringify(release),
	)
	// Subsequent reads discover snapshots by prefix, so publish new snapshots before
	// returning. Acknowledgments themselves use real-time primary-key reads.
	if (saved.rowcount > 0) await execute("REFRESH TABLE user_setting")
	// Another reader may have discovered this same first episode moments earlier.
	// Always return the immutable batch that won the insert.
	const value = await setting(userId, releaseKey(release))
	return snapshot.parse(JSON.parse(value ?? "null"))
}

export async function acknowledgedReleases(
	userId: string,
	releases: Release[],
): Promise<Set<string>> {
	if (!releases.length) return new Set()
	const keys = releases.map((release) => ackKey(releaseKey(release)))
	const rows = await query<{ key: string }>(
		`SELECT key FROM user_setting WHERE user_id = ? AND key IN (${keys.map(() => "?").join(", ")})`,
		[userId, ...keys],
	)
	return new Set(
		rows.map((row) => row.key.replace("show_release_ack:", PREFIX)),
	)
}

/** The full snapshot token is validated against this member's stored release. */
export async function acknowledgeRelease(
	userId: string,
	token: string,
): Promise<boolean> {
	if (!/^show_release:\d+:\d+:\d+$/.test(token)) return false
	const value = await setting(userId, token)
	if (!value) return false
	const parsed = snapshot.safeParse(JSON.parse(value))
	if (!parsed.success || releaseKey(parsed.data) !== token) return false
	await insert(userId, ackKey(token), "acknowledged")
	return true
}

export type AnnouncedShow = NewShow & { token: string }
