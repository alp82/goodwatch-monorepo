// Share lists and public profiles in Crate (doc.user_list, doc.user_profile, doc.user_handle).
// Every write validates its input and checks ownership; reads right after a write refresh the table first,
// because Crate makes writes visible to reads about once a second.
// Deletes are soft: rows get deleted_at (renamed handles get released_at), and every read filters them out.
import { createHash, randomBytes } from "node:crypto"
import { entryKey, type ListEntry, parseTitleKey, resolveCardTitles } from "~/server/share-lists/titles.server"
import { isDesignKey } from "~/ui/share-card/designs"
import { isPromptId, isThemeKey, LIST_SIZE, SIGNATURE_MAX_LENGTH, type ThemeKey, TITLE_MAX_LENGTH } from "~/ui/share-card/model"
import { execute, query } from "~/utils/crate"

export type Visibility = "public" | "unlisted"

export interface ShareList {
	id: string
	userId: string
	title: string
	promptId: string | null
	design: string
	theme: ThemeKey
	signature: string
	items: ListEntry[]
	visibility: Visibility
	remixedFrom: string | null
	contentHash: string
	createdAt: string
	updatedAt: string
}

export interface ShareListInput {
	title: string
	promptId: string | null
	design: string
	theme: string
	signature: string
	items: string[] // title keys, like "movie:603", in rank order
	visibility?: Visibility
	remixedFrom?: string | null
}

export interface Profile {
	userId: string
	handle: string
	displayName: string | null
}

/** A rejected request, with the HTTP status to answer. */
export class ShareListError extends Error {
	constructor(
		readonly status: 400 | 403 | 404 | 409,
		message: string,
	) {
		super(message)
	}
}

// Crate's client types its parameters narrowly; list items are objects.
const run = (sql: string, params: unknown[]) => execute(sql, params as (string | number | Date)[])
const select = <T extends {}>(sql: string, params: unknown[]) => query<T>(sql, params as (string | number | Date)[])

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
export function newListId(length = 10) {
	let id = ""
	while (id.length < length) {
		for (const byte of randomBytes(length * 2)) {
			// 248 is the largest multiple of 62 below 256, so every character is equally likely.
			if (byte < 248 && id.length < length) id += BASE62[byte % 62]
		}
	}
	return id
}

/** Identifies what a list's card shows. The card image URL carries it. */
export function contentHash(list: Pick<ShareList, "design" | "theme" | "title" | "signature" | "items">) {
	const content = JSON.stringify([list.design, list.theme, list.title, list.signature, list.items.map(entryKey)])
	return createHash("sha256").update(content).digest("base64url").slice(0, 12)
}

const clean = (text: unknown) => (typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "")

/** Checks and normalizes a list, including that every title exists in the catalog. */
export async function validateList(input: ShareListInput) {
	const title = clean(input.title)
	if (!title) throw new ShareListError(400, "Give the list a title.")
	if (title.length > TITLE_MAX_LENGTH) throw new ShareListError(400, `Titles can be up to ${TITLE_MAX_LENGTH} characters.`)
	const signature = clean(input.signature)
	if (signature.length > SIGNATURE_MAX_LENGTH) throw new ShareListError(400, `Signatures can be up to ${SIGNATURE_MAX_LENGTH} characters.`)
	if (!isDesignKey(input.design)) throw new ShareListError(400, "Unknown card design.")
	if (!isThemeKey(input.theme)) throw new ShareListError(400, "Unknown color theme.")
	const promptId = input.promptId && isPromptId(input.promptId) ? input.promptId : null
	const visibility = input.visibility ?? "public"
	if (visibility !== "public" && visibility !== "unlisted") throw new ShareListError(400, "Unknown visibility.")

	if (!Array.isArray(input.items) || input.items.length !== LIST_SIZE) throw new ShareListError(400, `A list has exactly ${LIST_SIZE} titles.`)
	const items = input.items.map((key) => parseTitleKey(String(key)))
	if (items.some((item) => !item)) throw new ShareListError(400, "Unknown title.")
	const entries = items as ListEntry[]
	if (new Set(entries.map(entryKey)).size !== entries.length) throw new ShareListError(400, "Each title can appear once.")
	const found = await resolveCardTitles(entries)
	if (found.length !== entries.length) throw new ShareListError(400, "Some titles aren't in the catalog.")

	return { title, signature, design: input.design, theme: input.theme, promptId, visibility, items: entries }
}

type ListRow = {
	id: string
	user_id: string
	title: string
	prompt_id: string | null
	design: string
	theme: string
	signature: string | null
	items: ListEntry[]
	visibility: Visibility
	remixed_from: string | null
	content_hash: string
	created_at: number
	updated_at: number
}
const LIST_COLUMNS = "id, user_id, title, prompt_id, design, theme, signature, items, visibility, remixed_from, content_hash, created_at, updated_at"

const fromRow = (r: ListRow): ShareList => ({
	id: r.id,
	userId: r.user_id,
	title: r.title,
	promptId: r.prompt_id,
	design: r.design,
	theme: (isThemeKey(r.theme) ? r.theme : "ember") as ThemeKey,
	signature: r.signature ?? "",
	items: (r.items ?? []).map((i) => ({ media_type: i.media_type, tmdb_id: Number(i.tmdb_id) })),
	visibility: r.visibility,
	remixedFrom: r.remixed_from,
	contentHash: r.content_hash,
	createdAt: new Date(r.created_at).toISOString(),
	updatedAt: new Date(r.updated_at).toISOString(),
})

const refreshLists = () => run("REFRESH TABLE doc.user_list", [])

export async function getList(id: string): Promise<ShareList | null> {
	if (!/^[0-9A-Za-z]{10}$/.test(id)) return null
	const [row] = await select<ListRow>(`SELECT ${LIST_COLUMNS} FROM doc.user_list WHERE id = ? AND deleted_at IS NULL`, [id])
	return row ? fromRow(row) : null
}

async function ownedList(userId: string, id: string) {
	const list = await getList(id)
	if (!list) throw new ShareListError(404, "This list doesn't exist.")
	if (list.userId !== userId) throw new ShareListError(403, "Only the list's owner can change it.")
	return list
}

export async function listsByUser(userId: string): Promise<ShareList[]> {
	const rows = await select<ListRow>(`SELECT ${LIST_COLUMNS} FROM doc.user_list WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200`, [userId])
	return rows.map(fromRow)
}

export async function publicListsByUser(userId: string): Promise<ShareList[]> {
	const rows = await select<ListRow>(
		`SELECT ${LIST_COLUMNS} FROM doc.user_list WHERE user_id = ? AND visibility = 'public' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200`,
		[userId],
	)
	return rows.map(fromRow)
}

export async function createList(userId: string, input: ShareListInput): Promise<ShareList> {
	const valid = await validateList(input)
	const remixedFrom = input.remixedFrom ? ((await getList(input.remixedFrom))?.id ?? null) : null
	const now = new Date()
	const id = newListId()
	const hash = contentHash(valid)
	await run(
		`INSERT INTO doc.user_list (${LIST_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[id, userId, valid.title, valid.promptId, valid.design, valid.theme, valid.signature, valid.items, valid.visibility, remixedFrom, hash, now, now],
	)
	await refreshLists()
	return (await getList(id)) as ShareList
}

export async function updateList(userId: string, id: string, input: ShareListInput): Promise<ShareList> {
	const current = await ownedList(userId, id)
	const valid = await validateList({ ...input, visibility: input.visibility ?? current.visibility })
	await run(
		`UPDATE doc.user_list SET title = ?, prompt_id = ?, design = ?, theme = ?, signature = ?, items = ?, visibility = ?,
		 content_hash = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
		[valid.title, valid.promptId, valid.design, valid.theme, valid.signature, valid.items, valid.visibility, contentHash(valid), new Date(), id, userId],
	)
	await refreshLists()
	return (await getList(id)) as ShareList
}

export async function setListVisibility(userId: string, id: string, visibility: Visibility): Promise<ShareList> {
	if (visibility !== "public" && visibility !== "unlisted") throw new ShareListError(400, "Unknown visibility.")
	await ownedList(userId, id)
	await run("UPDATE doc.user_list SET visibility = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL", [
		visibility,
		new Date(),
		id,
		userId,
	])
	await refreshLists()
	return (await getList(id)) as ShareList
}

/** Soft-deletes a list: it keeps its row with deleted_at set, and every read treats it as gone. */
export async function deleteList(userId: string, id: string): Promise<void> {
	await ownedList(userId, id)
	const now = new Date()
	await run("UPDATE doc.user_list SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL", [now, now, id, userId])
	await refreshLists()
}

// --- Handles and profiles ---

export const HANDLE_MIN = 3
export const HANDLE_MAX = 30
const HANDLE = /^[a-z][a-z0-9_]*$/
// Route names, brand words, and roles people could use to impersonate the site.
const RESERVED_HANDLES = new Set([
	"about", "account", "admin", "administrator", "api", "app", "auth", "discover", "disclaimer", "explore", "forgot_password",
	"goodwatch", "good_watch", "help", "how_it_works", "landing", "list", "lists", "login", "logout", "me", "moderator", "movie",
	"movies", "new", "og", "person", "privacy", "profile", "prototype", "reset_password", "root", "search", "settings", "share",
	"show", "shows", "sign_in", "sign_up", "signin", "signup", "staff", "support", "system", "taste", "tv", "u", "user", "users",
	"wishlist",
])

export const normalizeHandle = (handle: unknown) => (typeof handle === "string" ? handle.trim().replace(/^@/, "").toLowerCase() : "")

/** Null when the handle is valid, otherwise why not. */
export function handleProblem(handle: string): string | null {
	if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) return `Handles have ${HANDLE_MIN} to ${HANDLE_MAX} characters.`
	if (!HANDLE.test(handle)) return "Use lowercase letters, digits, and underscores, starting with a letter."
	if (RESERVED_HANDLES.has(handle)) return "That handle is reserved."
	return null
}

// A handle renamed away from, or of a deleted account, stays on hold this long before anyone else can claim it.
// During the hold, the person who renamed away can switch back, and their old profile URL redirects.
export const HANDLE_HOLD_DAYS = 90
const HOLD_MS = HANDLE_HOLD_DAYS * 24 * 60 * 60 * 1000

type ProfileRow = { user_id: string; handle: string; display_name: string | null }
const toProfile = (r: ProfileRow): Profile => ({ userId: r.user_id, handle: r.handle, displayName: r.display_name })

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
	const [row] = await select<ProfileRow>("SELECT user_id, handle, display_name FROM doc.user_profile WHERE user_id = ? AND deleted_at IS NULL", [userId])
	return row ? toProfile(row) : null
}

export async function getProfileByHandle(handle: string): Promise<Profile | null> {
	const normalized = normalizeHandle(handle)
	if (handleProblem(normalized)) return null
	const [row] = await select<ProfileRow>("SELECT user_id, handle, display_name FROM doc.user_profile WHERE handle = ? AND deleted_at IS NULL", [
		normalized,
	])
	return row ? toProfile(row) : null
}

/**
 * The profile a handle in a URL points to. A handle its owner renamed away from, still on hold, redirects to their
 * current handle. Unknown, expired, and deleted handles resolve to null.
 */
export async function findProfileByHandle(handle: string): Promise<{ profile: Profile } | { redirectTo: string } | null> {
	const normalized = normalizeHandle(handle)
	if (handleProblem(normalized)) return null
	const profile = await getProfileByHandle(normalized)
	if (profile) return { profile }
	const row = await getHandleRow(normalized)
	if (!row || row.deleted_at != null || row.released_at == null || row.released_at + HOLD_MS < Date.now()) return null
	const current = await getProfileByUserId(row.user_id)
	return current && current.handle !== normalized ? { redirectTo: current.handle } : null
}

type HandleRow = {
	handle: string
	user_id: string
	released_at: number | null
	deleted_at: number | null
	_seq_no: number
	_primary_term: number
}

// Reads by primary key are real-time in Crate, so this sees a claim made a moment ago. The timestamps are cast to
// epoch milliseconds because the Crate client turns a NULL timestamp into a Date at 1970-01-01.
async function getHandleRow(handle: string): Promise<HandleRow | null> {
	const [row] = await select<HandleRow>(
		`SELECT handle, user_id, CAST(released_at AS BIGINT) AS released_at, CAST(deleted_at AS BIGINT) AS deleted_at, _seq_no, _primary_term
		 FROM doc.user_handle WHERE handle = ?`,
		[handle],
	)
	return row ?? null
}

type Claim = "free" | "yours" | "reclaim" | "take-over" | "taken"

// What claiming this handle means for the person: a new row, already theirs, switching back to a handle they renamed
// away from, taking over a row whose hold has expired, or not possible.
function claimFor(row: HandleRow | null, userId: string, now: number): Claim {
	if (!row) return "free"
	const active = row.released_at == null && row.deleted_at == null
	if (active) return row.user_id === userId ? "yours" : "taken"
	const heldUntil = (row.deleted_at ?? row.released_at ?? 0) + HOLD_MS
	if (heldUntil <= now) return "take-over"
	return row.user_id === userId && row.deleted_at == null ? "reclaim" : "taken"
}

/** Whether the person can't have the handle: someone holds it, or it's on hold for someone else. */
export async function isHandleTaken(handle: string, userId?: string): Promise<boolean> {
	return claimFor(await getHandleRow(handle), userId ?? "", Date.now()) === "taken"
}

/**
 * Claims a handle for the person, or changes theirs. Exactly one of two people claiming the same handle at once
 * succeeds: a new handle is an insert keyed by the handle, and taking over an expired one is an update guarded by the
 * row's sequence number. Changing a handle releases the old one, which then stays on hold.
 */
export async function claimHandle(userId: string, rawHandle: string, displayName?: string | null): Promise<Profile> {
	const handle = normalizeHandle(rawHandle)
	const problem = handleProblem(handle)
	if (problem) throw new ShareListError(400, problem)
	const name = displayName === undefined ? undefined : clean(displayName).slice(0, 50) || null
	const now = new Date()

	const row = await getHandleRow(handle)
	const claim = claimFor(row, userId, now.getTime())
	if (claim === "taken") throw new ShareListError(409, "That handle is taken.")
	if (claim === "free") {
		await run("INSERT INTO doc.user_handle (handle, user_id, claimed_at) VALUES (?, ?, ?) ON CONFLICT (handle) DO NOTHING", [handle, userId, now])
	} else if (claim === "reclaim" || claim === "take-over") {
		const current = row as HandleRow
		const result = await run(
			`UPDATE doc.user_handle SET user_id = ?, claimed_at = ?, released_at = NULL, deleted_at = NULL
			 WHERE handle = ? AND _seq_no = ? AND _primary_term = ?`,
			[userId, now, handle, current._seq_no, current._primary_term],
		)
		if (!result?.rowcount) throw new ShareListError(409, "That handle is taken.")
	}
	await run("REFRESH TABLE doc.user_handle", [])
	const holder = await getHandleRow(handle)
	if (holder?.user_id !== userId || holder.released_at != null || holder.deleted_at != null) {
		throw new ShareListError(409, "That handle is taken.")
	}

	const current = await getProfileByUserId(userId)
	await run(
		`INSERT INTO doc.user_profile (user_id, handle, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT (user_id) DO UPDATE SET handle = excluded.handle, display_name = excluded.display_name, updated_at = excluded.updated_at`,
		[userId, handle, name === undefined ? (current?.displayName ?? null) : name, now, now],
	)
	if (current && current.handle !== handle) {
		await run("UPDATE doc.user_handle SET released_at = ? WHERE handle = ? AND user_id = ? AND released_at IS NULL AND deleted_at IS NULL", [
			now,
			current.handle,
			userId,
		])
		await run("REFRESH TABLE doc.user_handle", [])
	}
	await run("REFRESH TABLE doc.user_profile", [])
	return (await getProfileByUserId(userId)) as Profile
}

export async function setDisplayName(userId: string, displayName: string | null): Promise<Profile> {
	const current = await getProfileByUserId(userId)
	if (!current) throw new ShareListError(400, "Choose a handle first.")
	return claimHandle(userId, current.handle, displayName)
}

/**
 * Soft-deletes everything share lists store for a person: their lists, profile, and handles. The handles stay on hold,
 * so nobody else takes over their links right away. Call it from the account-deletion flow.
 */
export async function deleteAccountData(userId: string): Promise<void> {
	const now = new Date()
	await run("UPDATE doc.user_list SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL", [now, now, userId])
	await run("UPDATE doc.user_profile SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL", [now, now, userId])
	await run("UPDATE doc.user_handle SET deleted_at = ? WHERE user_id = ? AND deleted_at IS NULL", [now, userId])
	await run("REFRESH TABLE doc.user_list, doc.user_profile, doc.user_handle", [])
}
