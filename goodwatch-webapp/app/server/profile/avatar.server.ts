// A member's uploaded profile photo: checked by its first bytes (JPEG, PNG or WebP), re-encoded by sharp to a 512 px
// square WebP without metadata, and kept base64 in Crate `doc.user_avatar`, as doc.social_image keeps its images. Each
// upload gets a new version, which is part of the photo's URL, so the photo can be cached for a year.
// Spec: docs/implementation/member-profile/README.md
import { randomBytes } from "node:crypto"
import { execute, query } from "~/utils/crate"

/** What the browser may send: already cropped square, at most this many bytes. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_SIZE = 512

export type ImageType = "jpeg" | "png" | "webp"

/** The image type its first bytes declare; null for anything else (the declared content type is not trusted). */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg"
	if (
		bytes.length >= 8 &&
		[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)
	)
		return "png"
	if (
		bytes.length >= 12 &&
		String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
		String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
	)
		return "webp"
	return null
}

/** Re-encodes to a 512 px square WebP. sharp drops EXIF, GPS and other metadata unless asked to keep it. */
export async function encodeAvatar(bytes: Uint8Array): Promise<Buffer> {
	const { default: sharp } = await import("sharp")
	return await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" })
		.rotate() // honour the photo's orientation before its metadata goes
		.resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
		.webp({ quality: 82, effort: 4 })
		.toBuffer()
}

export async function saveAvatar(userId: string, webp: Buffer): Promise<string> {
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
	const result = await execute("DELETE FROM doc.user_avatar WHERE user_id = ?", [userId])
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
		const [row] = await query<{ version: string }>("SELECT version FROM doc.user_avatar WHERE user_id = ?", [userId])
		version = row?.version ?? null
	} catch (error) {
		console.error("[profile] reading the photo version failed:", error)
	}
	if (versions.size > 10_000) versions.clear()
	versions.set(userId, { at: Date.now(), version })
	return version
}

export async function readAvatar(userId: string): Promise<{ data: Buffer; version: string } | null> {
	const [row] = await query<{ data: string; version: string }>(
		"SELECT data, version FROM doc.user_avatar WHERE user_id = ?",
		[userId],
	)
	return row?.data ? { data: Buffer.from(row.data, "base64"), version: row.version } : null
}

export const avatarPath = (handle: string, version: string) => `/api/avatar/${handle}?v=${version}`
