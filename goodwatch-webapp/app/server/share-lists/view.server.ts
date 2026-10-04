// Viewer-independent share-list reads. Store writes invalidate the combined view after refreshing Crate.
import { resetPageCache } from "~/server/page-cache.server"
import {
	type CardTitle,
	type ThemeKey,
	isThemeKey,
} from "~/ui/share-card/model"
import {
	cached,
	declareResettableCache,
	resetCacheConfirmed,
} from "~/utils/cache"
import { query } from "~/utils/crate"
import { handleProblem, normalizeHandle } from "~/utils/handles"
import type { Profile, ShareList, Visibility } from "./store.server"
import { type ListEntry, resolveCardTitles } from "./titles.server"

const select = <T extends {}>(sql: string, params: unknown[]) =>
	query<T>(sql, params as (string | number | Date)[])

export type ListRow = {
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
export const LIST_COLUMNS =
	"id, user_id, title, prompt_id, design, theme, items, visibility, remixed_from, content_hash, created_at, updated_at"

export const fromRow = (r: ListRow): ShareList => ({
	id: r.id,
	userId: r.user_id,
	title: r.title,
	promptId: r.prompt_id,
	design: r.design,
	theme: (isThemeKey(r.theme) ? r.theme : "ember") as ThemeKey,
	items: (r.items ?? []).map((i) => ({
		media_type: i.media_type,
		tmdb_id: Number(i.tmdb_id),
	})),
	visibility: r.visibility,
	remixedFrom: r.remixed_from,
	contentHash: r.content_hash,
	createdAt: new Date(r.created_at).toISOString(),
	updatedAt: new Date(r.updated_at).toISOString(),
})

export async function getList(id: string): Promise<ShareList | null> {
	if (!/^[0-9A-Za-z]{10}$/.test(id)) return null
	const [row] = await select<ListRow>(
		`SELECT ${LIST_COLUMNS} FROM doc.user_list WHERE id = ? AND deleted_at IS NULL`,
		[id],
	)
	return row ? fromRow(row) : null
}

export async function getProfileByUserId(
	userId: string,
): Promise<Profile | null> {
	const [row] = await select<{ user_id: string; handle: string }>(
		"SELECT user_id, handle FROM doc.user_profile WHERE user_id = ? AND deleted_at IS NULL",
		[userId],
	)
	return row ? { userId: row.user_id, handle: row.handle } : null
}

export interface ListView {
	list: ShareList
	owner: Profile
	titles: CardTitle[]
}

type ViewResult =
	| { found: true; list: ShareList; owner: Profile; titles: CardTitle[] }
	| { found: false }
const VIEW_CACHE = {
	name: "share-list-view-v1",
	ttlMinutes: 5,
	staleMinutes: 5,
} as const
declareResettableCache(VIEW_CACHE)
const PROFILE_CACHE = {
	name: "share-profile-by-user-v1",
	ttlMinutes: 5,
	staleMinutes: 0,
} as const
const PROFILE_PAGE_CACHE = {
	name: "share-profile-page-v1",
	ttlMinutes: 5,
	staleMinutes: 5,
} as const
declareResettableCache(PROFILE_CACHE)
declareResettableCache(PROFILE_PAGE_CACHE)

type ProfileResult = { found: true; profile: Profile } | { found: false }
type ProfilePage = { profile: Profile; lists: ShareList[]; titles: CardTitle[] }
type ProfilePageResult = ({ found: true } & ProfilePage) | { found: false }

export async function getCachedProfileByUserId(
	userId: string,
): Promise<Profile | null> {
	const result = await cached({
		...PROFILE_CACHE,
		params: { userId },
		target: async (): Promise<ProfileResult> => {
			const profile = await getProfileByUserId(userId)
			return profile ? { found: true, profile } : { found: false }
		},
	})
	return result.found ? result.profile : null
}

export async function getProfileByHandle(
	handle: string,
): Promise<Profile | null> {
	const normalized = normalizeHandle(handle)
	if (handleProblem(normalized)) return null
	const [row] = await select<{ user_id: string; handle: string }>(
		"SELECT user_id, handle FROM doc.user_profile WHERE handle = ? AND deleted_at IS NULL",
		[normalized],
	)
	return row ? { userId: row.user_id, handle: row.handle } : null
}

export async function publicListsByUser(userId: string): Promise<ShareList[]> {
	const rows = await select<ListRow>(
		`SELECT ${LIST_COLUMNS} FROM doc.user_list WHERE user_id = ? AND visibility = 'public' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 200`,
		[userId],
	)
	return rows.map(fromRow)
}

export async function getProfilePage(
	rawHandle: string,
): Promise<ProfilePage | null> {
	const handle = normalizeHandle(rawHandle)
	if (handleProblem(handle)) return null
	const result = await cached({
		...PROFILE_PAGE_CACHE,
		params: { handle },
		target: async (): Promise<ProfilePageResult> => {
			const profile = await getProfileByHandle(handle)
			if (!profile) return { found: false }
			const lists = await publicListsByUser(profile.userId)
			const titles = await resolveCardTitles(
				lists.flatMap((list) => list.items),
			)
			return { found: true, profile, lists, titles }
		},
	})
	return result.found
		? { profile: result.profile, lists: result.lists, titles: result.titles }
		: null
}

export async function resetProfileViews(userId: string): Promise<void> {
	let handle: string | undefined
	try {
		const [row] = await select<{ handle: string }>(
			"SELECT handle FROM doc.user_profile WHERE user_id = ?",
			[userId],
		)
		handle = row?.handle
	} catch (error) {
		console.error("Looking up profile for cache reset failed:", error)
	}
	await resetCacheConfirmed({ name: PROFILE_CACHE.name, params: { userId } })
	if (handle)
		await resetCacheConfirmed({
			name: PROFILE_PAGE_CACHE.name,
			params: { handle: normalizeHandle(handle) },
		})
}

async function readListView(id: string): Promise<ViewResult> {
	const list = await getList(id)
	if (!list) return { found: false }
	const [owner, titles] = await Promise.all([
		getProfileByUserId(list.userId),
		resolveCardTitles(list.items),
	])
	return owner ? { found: true, list, owner, titles } : { found: false }
}

export async function resetListView(id: string): Promise<void> {
	// The stored page of this list, in this process (see docs/page-cache.md for other processes).
	resetPageCache((path) => path.endsWith(`/lists/${id}`))
	await resetCacheConfirmed({ name: VIEW_CACHE.name, params: { id } })
	try {
		const [row] = await select<{ user_id: string }>(
			"SELECT user_id FROM doc.user_list WHERE id = ?",
			[id],
		)
		if (row) await resetProfileViews(row.user_id)
	} catch (error) {
		console.error("Looking up list owner for cache reset failed:", error)
	}
}

export async function getListView(id: string): Promise<ListView | null> {
	if (!/^[0-9A-Za-z]{10}$/.test(id)) return null
	// No viewer, country or language affects this value today. Future localized titles must
	// add country and language to the key (owner decision in map 237).
	// Resets now reach other processes. 5 + 5 minutes costs one refresh per five minutes
	// under load and bounds manual DB changes, timed-out writes landing later, and unconfirmed resets.
	const result = await cached({
		...VIEW_CACHE,
		params: { id },
		target: () => readListView(id),
	})
	return result.found
		? { list: result.list, owner: result.owner, titles: result.titles }
		: null
}
