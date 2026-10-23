// A member's uploaded profile photo: checked by its first bytes (JPEG, PNG or WebP), re-encoded by sharp to a 512 px
// square WebP without metadata, and kept base64 in Crate `doc.user_avatar`, as doc.social_image keeps its images. Each
// upload gets a new version, which is part of the photo's URL, so the photo can be cached for a year.
// Spec: docs/implementation/member-profile/README.md
import { randomBytes } from "node:crypto"
import { withBackendTimeout } from "~/utils/backend-timeout"
import { execute, query } from "~/utils/crate"

export { encodeAvatar, sniffImageType } from "./image-type"

/** What the browser may send: already cropped square, at most this many bytes. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024

/** Uploads a member may make in an hour. */
const UPLOADS_PER_HOUR = 10

/** Counts an upload against the member's hourly allowance; false when it's used up. When Valkey can't answer, allows. */
export async function allowUpload(userId: string): Promise<boolean> {
	try {
		const { getRedisCluster } = await import("~/utils/cache")
		const redis = getRedisCluster()
		if (!redis) return true
		const key = `profile-photo-uploads:v1:${userId}`
		const count = await withBackendTimeout("valkey", 800, async () => {
			const n = await redis.incr(key)
			if (n === 1) await redis.expire(key, 60 * 60)
			return n
		})
		return count <= UPLOADS_PER_HOUR
	} catch (error) {
		console.warn("[profile] upload allowance check failed", error)
		return true
	}
}

export async function saveAvatar(
	userId: string,
	webp: Buffer,
): Promise<string> {
	const version = randomBytes(6).toString("hex")
	await execute(
		`INSERT INTO doc.user_avatar (user_id, data, bytes, version, created_at)
		 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, bytes = excluded.bytes,
		   version = excluded.version, created_at = excluded.created_at`,
		[userId, webp.toString("base64"), webp.length, version],
	)
	await execute("REFRESH TABLE doc.user_avatar")
	versions.delete(userId)
	return version
}

export async function deleteAvatar(userId: string): Promise<boolean> {
	const result = await execute(
		"DELETE FROM doc.user_avatar WHERE user_id = ?",
		[userId],
	)
	await execute("REFRESH TABLE doc.user_avatar")
	versions.delete(userId)
	return Number((result as { rowcount?: number })?.rowcount ?? 0) > 0
}

// The version of each member's photo, kept briefly so every profile view doesn't read Crate.
const VERSION_MS = 60_000
const versions = new Map<string, { at: number; version: string | null }>()

/** The current photo's version; null without a photo. A missing table counts as no photo. */
export async function avatarVersion(userId: string): Promise<string | null> {
	const hit = versions.get(userId)
	if (hit && Date.now() - hit.at < VERSION_MS) return hit.version
	let version: string | null = null
	try {
		const [row] = await query<{ version: string }>(
			"SELECT version FROM doc.user_avatar WHERE user_id = ?",
			[userId],
		)
		version = row?.version ?? null
	} catch (error) {
		console.error("[profile] reading the photo version failed:", error)
	}
	if (versions.size > 10_000) versions.clear()
	versions.set(userId, { at: Date.now(), version })
	return version
}

export async function readAvatar(
	userId: string,
): Promise<{ data: Buffer; version: string } | null> {
	const [row] = await query<{ data: string; version: string }>(
		"SELECT data, version FROM doc.user_avatar WHERE user_id = ?",
		[userId],
	)
	return row?.data
		? { data: Buffer.from(row.data, "base64"), version: row.version }
		: null
}

export const avatarPath = (handle: string, version: string) =>
	`/api/avatar/${handle}?v=${version}`
