// Viewer-independent share-list reads. Store writes invalidate the combined view after refreshing Crate.
import {
	type CardTitle,
	type ThemeKey,
	isThemeKey,
} from "~/ui/share-card/model"
import {
	cachePhysicalTtlSeconds,
	cached,
	resetCacheConfirmed,
} from "~/utils/cache"
import { query } from "~/utils/crate"
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
const NAME = "share-list-view-v1"
const MAX_UNCONFIRMED_RESETS = 1000
const unconfirmed = new Map<string, { until: number; retryAt: number }>()

export function resetUnconfirmedListResetsForTest(): void {
	unconfirmed.clear()
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
	// Mark before awaiting DEL so concurrent reads also bypass a reset still awaiting confirmation.
	const pending = {
		until: Date.now() + cachePhysicalTtlSeconds(5, 5) * 1000,
		retryAt: Date.now() + 5000,
	}
	unconfirmed.delete(id)
	if (unconfirmed.size >= MAX_UNCONFIRMED_RESETS) {
		unconfirmed.delete(unconfirmed.keys().next().value as string)
	}
	unconfirmed.set(id, pending)
	if (await resetCacheConfirmed({ name: NAME, params: { id } })) {
		if (unconfirmed.get(id) === pending) unconfirmed.delete(id)
	}
}

export async function getListView(id: string): Promise<ListView | null> {
	if (!/^[0-9A-Za-z]{10}$/.test(id)) return null
	const pending = unconfirmed.get(id)
	const now = Date.now()
	let result: ViewResult
	if (pending && pending.until > now) {
		if (pending.retryAt <= now) {
			pending.retryAt = now + 5000
			void resetCacheConfirmed({ name: NAME, params: { id } }).then(
				(confirmed) => {
					if (confirmed && unconfirmed.get(id) === pending)
						unconfirmed.delete(id)
				},
			)
		}
		result = await readListView(id)
	} else {
		if (pending) unconfirmed.delete(id)
		// No viewer, country or language affects this value today. Future localized titles must
		// add country and language to the key (owner decision in map 237).
		// 5 + 5 minutes costs one refresh per five minutes under load and bounds manual DB
		// changes, timed-out writes landing later, and resets in another process (one today).
		result = await cached({
			name: NAME,
			params: { id },
			ttlMinutes: 5,
			staleMinutes: 5,
			target: () => readListView(id),
		})
	}
	return result.found
		? { list: result.list, owner: result.owner, titles: result.titles }
		: null
}
