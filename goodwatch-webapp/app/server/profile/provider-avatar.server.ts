import { createHash } from "node:crypto"
import { execute, query } from "~/utils/crate"
import { AVATAR_MAX_BYTES } from "./avatar.server"
import { googlePhotoUrl } from "./google-photo"
import { encodeAvatar, sniffImageType } from "./image-type"
import { readLimited } from "./request.server"

const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex")
interface Choice {
	source: string
	consent: string
}
interface Photo {
	data: Buffer
	version: string
}

async function chosen(userId: string): Promise<Choice | null> {
	const rows = await query<{ key: string; value: string }>(
		"SELECT key, value FROM doc.user_setting WHERE user_id = ? AND key IN ('profile_avatar', 'profile_provider_photo')",
		[userId],
	)
	const choice = rows.find((row) => row.key === "profile_avatar")
	const source = googlePhotoUrl(rows.find((row) => row.key === "profile_provider_photo")?.value)
	if (!choice || !source) return null
	try {
		if (JSON.parse(choice.value)?.kind !== "provider") return null
	} catch {
		return null
	}
	return { source, consent: digest(source) }
}

async function download(source: string): Promise<Photo> {
	if (!googlePhotoUrl(source)) throw new Error("Invalid Google profile image")
	const response = await fetch(source, {
		redirect: "error",
		credentials: "omit",
		signal: AbortSignal.timeout(5000),
		headers: { Accept: "image/jpeg, image/png, image/webp" },
	})
	const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase()
	if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(mime ?? "")) {
		await response.body?.cancel()
		throw new Error("Invalid Google profile image response")
	}
	const bytes = await readLimited(response, AVATAR_MAX_BYTES)
	const type = bytes && sniffImageType(bytes)
	if (!bytes || !type || mime !== `image/${type}`)
		throw new Error("Invalid Google profile image bytes")
	const data = await encodeAvatar(bytes)
	return { data, version: digest(data) }
}

interface Row {
	consent: string
	source: string
	signed_in_at: number
	retry_at: number
	data: string | null
	version: string | null
	_seq_no: number
	_primary_term: number
}
const table = "doc.user_provider_avatar"
const matchVersion = "WHERE user_id = ? AND _seq_no = ? AND _primary_term = ?"
const revision = (userId: string, row: Row) => [userId, row._seq_no, row._primary_term]

// Exact primary-key reads and versioned writes see the latest document before Crate's search-index refresh.
async function current(userId: string): Promise<Row | undefined> {
	const [row] = await query<Row>(
		`SELECT consent, source, signed_in_at, retry_at, data, version, _seq_no, _primary_term FROM ${table} WHERE user_id = ?`,
		[userId],
	)
	return row
}

const inFlight = new Map<string, Promise<void>>()
async function fill(userId: string, row: Row) {
	const args = revision(userId, row)
	const key = JSON.stringify(args)
	const pending = inFlight.get(key)
	if (pending) return pending
	if (inFlight.size >= 16) return
	const task = (async () => {
		let photo: Photo
		try {
			photo = await download(row.source)
		} catch {
			// Preserve a previous normalized image during a provider outage and bound further attempts.
			await execute(`UPDATE ${table} SET retry_at = ? ${matchVersion}`, [
				Date.now() + 60_000,
				...args,
			])
			return
		}
		if ((await chosen(userId))?.consent !== row.consent) {
			await execute(`DELETE FROM ${table} ${matchVersion}`, args)
			return
		}
		await execute(`UPDATE ${table} SET data = ?, version = ?, retry_at = -1 ${matchVersion}`, [
			photo.data.toString("base64"),
			photo.version,
			...args,
		])
	})().finally(() => inFlight.delete(key))
	inFlight.set(key, task)
	return task
}

export async function readProviderAvatar(
	userId: string,
	signIn?: { at: number; photo?: string | null },
	onRefresh?: () => Promise<void>,
): Promise<Photo | null> {
	let oldVersion: string | null | undefined
	for (let attempt = 0; attempt < 6; attempt++) {
		const choice = await chosen(userId)
		if (!choice) {
			if (attempt) await pruneProviderAvatars(userId)
			return null
		}
		const row = await current(userId)
		if (!row) {
			await execute(
				`INSERT INTO ${table} (user_id, consent, source, signed_in_at, retry_at) VALUES (?, ?, ?, 0, 0) ON CONFLICT DO NOTHING`,
				[userId, choice.consent, choice.source],
			)
			continue
		}
		const args = revision(userId, row)
		if (row.consent !== choice.consent) {
			await execute(`DELETE FROM ${table} ${matchVersion}`, args)
			continue
		}
		if (signIn && signIn.at > row.signed_in_at) {
			oldVersion ??= row.version
			const source = signIn.photo === undefined ? row.source : (googlePhotoUrl(signIn.photo) ?? "")
			// New source or a removed Google photo must never serve the previous account's image.
			const clear = source === row.source ? "" : ", data = NULL, version = NULL"
			await execute(
				`UPDATE ${table} SET signed_in_at = ?, source = ?, retry_at = 0 ${clear} ${matchVersion}`,
				[signIn.at, source, ...args],
			)
			continue
		}
		if (!row.source) {
			if (oldVersion) await onRefresh?.()
			return null
		}
		if (row.retry_at >= 0 && row.retry_at <= Date.now()) {
			await fill(userId, row)
			const latest = await current(userId)
			if (!latest) return null
			if (latest._seq_no !== row._seq_no) continue
		}
		if (oldVersion !== undefined && oldVersion !== row.version) await onRefresh?.()
		return row.data && row.version
			? { data: Buffer.from(row.data, "base64"), version: row.version }
			: null
	}
	return null
}

// In-flight downloads can update only the exact document they read. Revoking and subsequently
// reselecting the same provider URL still creates a new document revision.
export async function pruneProviderAvatars(userId: string) {
	for (let attempt = 0; attempt < 6; attempt++) {
		const row = await current(userId)
		if (!row || row.consent === (await chosen(userId))?.consent) return
		const result = await execute(`DELETE FROM ${table} ${matchVersion}`, revision(userId, row))
		if (result.rowcount) return
	}
	throw new Error("Concurrent profile photo changes prevented removal")
}
export async function deleteProviderAvatars(userId: string) {
	await execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId])
}
