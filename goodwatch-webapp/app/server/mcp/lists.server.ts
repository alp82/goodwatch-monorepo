import { DEFAULT_DESIGN } from "../../ui/share-card/designs"
import { myListsPath, shareListPath } from "../../ui/share-card/links"
import { canonicalTitleId } from "../../utils/title-identity"
import { titleKey } from "../../utils/title-key"
import {
	createList,
	getList,
	getProfileByUserId,
	listsByUser,
	ShareListError,
	updateList,
	type ShareList,
} from "../share-lists/store.server"
import { entryKey } from "../share-lists/titles.server"
import { getDisplayFields } from "../title-cards.server"
import { runAction } from "./actions.server"
import { page, resolve, summary } from "./data.server"
import { editListKeys } from "./lists"
import type { ReadArgs } from "./tools.server"
import type { WriteArgs } from "./write-tools.server"

async function listSummary(userId: string, origin: string, list: ShareList) {
	const owner = await getProfileByUserId(userId)
	const url = owner
		? new URL(shareListPath(owner.handle, list.id), origin).href
		: null
	return {
		list_id: list.id,
		name: list.title,
		visibility: list.visibility,
		title_count: list.items.length,
		created_at: list.createdAt,
		updated_at: list.updatedAt,
		share_url: url,
		page_url: url,
	}
}

async function listResult(userId: string, origin: string, list: ShareList) {
	const display = await getDisplayFields(
		list.items.map((item) => titleKey(item.media_type, item.tmdb_id)),
	)
	return {
		...(await listSummary(userId, origin, list)),
		items: list.items.map((item, i) => {
			const title = display.get(titleKey(item.media_type, item.tmdb_id))
			return title
				? { ...summary(title, origin), rank: i + 1 }
				: {
						id: entryKey(item),
						rank: i + 1,
						status: "title_unavailable",
						// Don't invent a title, year or slug for a deleted catalog record.
					}
		}),
	}
}

export async function readLists(
	userId: string,
	origin: string,
	args: ReadArgs,
): Promise<Record<string, unknown>> {
	if (args.list_id) {
		const list = await getList(args.list_id)
		if (!list || list.userId !== userId)
			return { status: "list_not_found", message: "No matching list of yours" }
		return listResult(userId, origin, list)
	}
	const selected = page(await listsByUser(userId), args)
	return {
		...selected,
		items: await Promise.all(
			selected.items.map((list) => listSummary(userId, origin, list)),
		),
		page_url: new URL(myListsPath, origin).href,
	}
}

export async function changeList(
	userId: string,
	origin: string,
	name: "create_list" | "update_list_titles",
	args: WriteArgs,
	hash: string,
) {
	return runAction(
		userId,
		args.action_id,
		hash,
		async () => {
			try {
				const existing = args.list_id ? await getList(args.list_id) : null
				if (
					name === "update_list_titles" &&
					(!existing || existing.userId !== userId)
				)
					return { outcome: "refused", message: "No matching list of yours" }
				const keys: string[] = []
				for (const selector of args.titles ?? args.add_titles ?? []) {
					const found = await resolve(selector, origin)
					if ("result" in found)
						return { ...found.result, outcome: "unresolved" }
					keys.push(`${found.title.media_type}:${found.title.tmdb_id}`)
				}
				const remove = (args.remove_title_ids ?? []).map((id) => {
					const [kind, raw] = id.split(":")
					const type = kind === "show" ? "show" : "movie"
					return `${type}:${canonicalTitleId(type, Number(raw))}`
				})
				const before = existing
					? await listResult(userId, origin, existing)
					: null
				let items = keys
				if (existing) {
					try {
						items = editListKeys(existing.items.map(entryKey), keys, remove)
					} catch (error) {
						return { outcome: "refused", message: (error as Error).message }
					}
					if (
						JSON.stringify(items) ===
						JSON.stringify(existing.items.map(entryKey))
					)
						return {
							outcome: "unchanged",
							before,
							after: before,
							page_url: before?.page_url,
						}
				}
				const list = existing
					? await updateList(
							userId,
							existing.id,
							{
								title: existing.title,
								promptId: existing.promptId,
								design: existing.design,
								theme: existing.theme,
								items,
								visibility: existing.visibility,
							},
							{
								expectedContentHash: existing.contentHash,
								expectedUpdatedAt: existing.updatedAt,
							},
						)
					: await createList(userId, {
							title: args.list_name!,
							promptId: null,
							design: DEFAULT_DESIGN,
							theme: "ember",
							items,
							visibility: args.visibility ?? "public",
						})
				const after = await listResult(userId, origin, list)
				return {
					outcome: "applied",
					before,
					after,
					list_id: list.id,
					share_url: after.share_url,
					page_url: after.page_url,
				}
			} catch (error) {
				if (error instanceof ShareListError)
					return {
						outcome: error.status === 409 ? "conflict" : "refused",
						message: error.message,
						...(error.code === "handle_required"
							? {
									status: error.code,
									page_url: new URL(myListsPath, origin).href,
								}
							: {}),
					}
				throw error
			}
		},
		{ tool: name, list_id: args.list_id, list_name: args.list_name },
	)
}
