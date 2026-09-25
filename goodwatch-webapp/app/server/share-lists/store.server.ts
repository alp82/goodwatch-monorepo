// Share lists and public profiles in Crate (doc.user_list, doc.user_profile, doc.user_handle).
// Every write validates its input and checks ownership; reads right after a write refresh the table first,
// because Crate makes writes visible to reads about once a second.
// Deletes are soft: rows get deleted_at, and every read filters them out.
// A handle is chosen once and never changes. The list card and link preview print it, so nobody signs as someone else.
// The signature and display_name columns are no longer read or written.
import { createHash, randomBytes } from "node:crypto"
import { entryKey, type ListEntry, parseTitleKey, resolveCardTitles } from "~/server/share-lists/titles.server"
import { isDesignKey } from "~/ui/share-card/designs"
import { isPromptId, isThemeKey, LIST_SIZE, type ThemeKey, TITLE_MAX_LENGTH } from "~/ui/share-card/model"
import { execute, query } from "~/utils/crate"
import { HANDLE_MAX, handleFromText, handleProblem, normalizeHandle } from "~/utils/handles"

export { HANDLE_MAX, HANDLE_MIN, handleProblem, normalizeHandle } from "~/utils/handles"

export type Visibility = "public" | "unlisted"

export interface ShareList {
	id: string
	userId: string
	title: string
	promptId: string | null
	design: string
	theme: ThemeKey
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
	items: string[] // title keys, like "movie:603", in rank order
	visibility?: Visibility
	remixedFrom?: string | null
}

export interface Profile {
	userId: string
	handle: string
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
export function contentHash(list: Pick<ShareList, "design" | "theme" | "title" | "items">) {
	const content = JSON.stringify([list.design, list.theme, list.title, list.items.map(entryKey)])
	return createHash("sha256").update(content).digest("base64url").slice(0, 12)
}

const clean = (text: unknown) => (typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "")

/** Checks and normalizes a list, including that every title exists in the catalog. */
export async function validateList(input: ShareListInput) {
	const title = clean(input.title)
	if (!title) throw new ShareListError(400, "Give the list a title.")
	if (title.length > TITLE_MAX_LENGTH) throw new ShareListError(400, `Titles can be up to ${TITLE_MAX_LENGTH} characters.`)
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

	return { title, design: input.design, theme: input.theme, promptId, visibility, items: entries }
}

type ListRow = {
	id: string
	user_id: string
	title: string
	prompt_id: string | null
	design: string
	theme: string
	items: ListEntry[]
	visibility: Visibility
	remixed_from: string | null
	content_hash: string
	created_at: number
	updated_at: number
}
const LIST_COLUMNS = "id, user_id, title, prompt_id, design, theme, items, visibility, remixed_from, content_hash, created_at, updated_at"

const fromRow = (r: ListRow): ShareList => ({
	id: r.id,
	userId: r.user_id,
	title: r.title,
	promptId: r.prompt_id,
	design: r.design,
	theme: (isThemeKey(r.theme) ? r.theme : "ember") as ThemeKey,
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
		`INSERT INTO doc.user_list (${LIST_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[id, userId, valid.title, valid.promptId, valid.design, valid.theme, valid.items, valid.visibility, remixedFrom, hash, now, now],
	)
	await refreshLists()
	return (await getList(id)) as ShareList
}

export async function updateList(userId: string, id: string, input: ShareListInput): Promise<ShareList> {
	const current = await ownedList(userId, id)
	const valid = await validateList({ ...input, visibility: input.visibility ?? current.visibility })
	await run(
		`UPDATE doc.user_list SET title = ?, prompt_id = ?, design = ?, theme = ?, items = ?, visibility = ?,
		 content_hash = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
		[valid.title, valid.promptId, valid.design, valid.theme, valid.items, valid.visibility, contentHash(valid), new Date(), id, userId],
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

/** How long after a delete its owner can still undo it. Older deletes are restored by hand only. */
export const UNDO_DELETE_MS = 10 * 60 * 1000

/** Undoes a recent delete. Only the owner can, and only within UNDO_DELETE_MS. */
export async function restoreList(userId: string, id: string): Promise<ShareList> {
	if (!/^[0-9A-Za-z]{10}$/.test(id)) throw new ShareListError(404, "This list doesn't exist.")
	await run(
		"UPDATE doc.user_list SET deleted_at = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at >= ?",
		[new Date(), id, userId, new Date(Date.now() - UNDO_DELETE_MS)],
	)
	await refreshLists()
	const list = await getList(id)
	if (!list || list.userId !== userId) throw new ShareListError(404, "This list can't be restored anymore.")
	return list
}

// --- Handles and profiles ---

// A handle is claimed once, when someone first needs one, and never changes. Uniqueness comes from doc.user_handle,
// keyed by the handle: an insert with ON CONFLICT DO NOTHING lets exactly one person claim it. A deleted account's
// handle stays claimed for good, so nobody can take over someone else's name and links.

type ProfileRow = { user_id: string; handle: string }
const toProfile = (r: ProfileRow): Profile => ({ userId: r.user_id, handle: r.handle })

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
	const [row] = await select<ProfileRow>("SELECT user_id, handle FROM doc.user_profile WHERE user_id = ? AND deleted_at IS NULL", [userId])
	return row ? toProfile(row) : null
}

/** The profile a handle belongs to, or null when the handle is invalid, unclaimed, or its account is deleted. */
export async function getProfileByHandle(handle: string): Promise<Profile | null> {
	const normalized = normalizeHandle(handle)
	if (handleProblem(normalized)) return null
	const [row] = await select<ProfileRow>("SELECT user_id, handle FROM doc.user_profile WHERE handle = ? AND deleted_at IS NULL", [normalized])
	return row ? toProfile(row) : null
}

// Reads by primary key are real-time in Crate, so this sees a claim made a moment ago.
async function handleOwner(handle: string): Promise<string | null> {
	const [row] = await select<{ user_id: string }>("SELECT user_id FROM doc.user_handle WHERE handle = ?", [handle])
	return row?.user_id ?? null
}

/** Whether someone else has the handle. Deleted accounts keep theirs. */
export async function isHandleTaken(handle: string, userId?: string): Promise<boolean> {
	const owner = await handleOwner(handle)
	return owner !== null && owner !== userId
}

/**
 * The first free handle among the candidates, trying each as is and then with 2 to 9 appended. Candidates are free
 * text (an account name, the name part of an email address); unusable ones are skipped. Null when none is free.
 */
export async function suggestHandle(userId: string, candidates: (string | null | undefined)[]): Promise<string | null> {
	const bases = [...new Set(candidates.map(handleFromText).filter((h): h is string => !!h))]
	for (const base of bases) {
		for (const suffix of ["", "2", "3", "4", "5", "6", "7", "8", "9"]) {
			const handle = `${base.slice(0, HANDLE_MAX - suffix.length)}${suffix}`
			if (handleProblem(handle)) continue
			if (!(await isHandleTaken(handle, userId))) return handle
		}
	}
	return null
}

/**
 * Claims the person's handle. It can be claimed once: someone who already has a handle gets 409, unless they claim
 * the same one again. Exactly one of two people claiming the same handle at once succeeds.
 */
export async function claimHandle(userId: string, rawHandle: string): Promise<Profile> {
	const handle = normalizeHandle(rawHandle)
	const problem = handleProblem(handle)
	if (problem) throw new ShareListError(400, problem)

	const current = await getProfileByUserId(userId)
	if (current) {
		if (current.handle === handle) return current
		throw new ShareListError(409, "Your handle is already set and can't be changed.")
	}

	const now = new Date()
	await run("INSERT INTO doc.user_handle (handle, user_id, claimed_at) VALUES (?, ?, ?) ON CONFLICT (handle) DO NOTHING", [handle, userId, now])
	await run("REFRESH TABLE doc.user_handle", [])
	if ((await handleOwner(handle)) !== userId) throw new ShareListError(409, "That handle is taken.")

	await run("INSERT INTO doc.user_profile (user_id, handle, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (user_id) DO NOTHING", [
		userId,
		handle,
		now,
		now,
	])
	await run("REFRESH TABLE doc.user_profile", [])
	return (await getProfileByUserId(userId)) as Profile
}

/**
 * Soft-deletes everything share lists store for a person: their lists, profile, and handle. The handle stays claimed,
 * so nobody else can take over their name or links. Call it from the account-deletion flow.
 */
export async function deleteAccountData(userId: string): Promise<void> {
	const now = new Date()
	await run("UPDATE doc.user_list SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL", [now, now, userId])
	await run("UPDATE doc.user_profile SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND deleted_at IS NULL", [now, now, userId])
	await run("UPDATE doc.user_handle SET deleted_at = ? WHERE user_id = ? AND deleted_at IS NULL", [now, userId])
	await run("REFRESH TABLE doc.user_list, doc.user_profile, doc.user_handle", [])
}
