import {
	createList,
	deleteList,
	getList,
	newListId,
	contentHash,
	ShareListError,
} from "../share-lists/store.server.ts"
import { run, type itemRows } from "./store.server.ts"
type Item = Awaited<ReturnType<typeof itemRows>>[number]
async function persist(importId: string, item: Item) {
	item.payload = { ...item.payload, customList: item.customList }
	await run(
		"UPDATE doc.user_import_item SET payload = ? WHERE import_id = ? AND row_index = ?",
		[JSON.stringify(item.payload), importId, item.index],
	)
}
export async function applyImportedList(
	userId: string,
	importId: string,
	item: Item,
): Promise<"added"> {
	const list = item.customList
	if (!list) throw new Error("The import list has no contents.")
	const entries = list.entries.filter(
		({ entry }) => entry.tmdbId != null && !entry.problem,
	)
	const keys = entries.map(({ entry }) => `${entry.mediaType}:${entry.tmdbId}`)
	const collection = {
		importedBy: { importId, item: item.index },
		description: list.description,
		entryNotes: entries.map((item) => item.note),
	}
	const input = {
		title: list.name.trim(),
		promptId: null,
		design: "podium",
		theme: "ember",
		items: keys,
		visibility: "private" as const,
		collection,
	}
	if (!list.createdId || !list.createdContentHash) {
		list.createdId ??= newListId()
		list.createdContentHash = contentHash({
			...input,
			theme: "ember",
			items: entries.map(({ entry }) => ({
				media_type: entry.mediaType,
				tmdb_id: entry.tmdbId!,
			})),
		})
		await persist(importId, item)
	}
	await createList(userId, input, { id: list.createdId })
	return "added"
}
export async function undoImportedList(
	userId: string,
	importId: string,
	item: Item,
) {
	const id = item.customList?.createdId
	if (!id) return "not_restored" as const
	const list = await getList(id)
	if (!list) return "reverted" as const
	const reason =
		list.userId !== userId
			? "This list is no longer owned by you. Undo kept it."
			: list.visibility !== "private"
				? "This list has been shared. Undo kept it."
				: !item.customList?.createdContentHash
					? "The original list fingerprint is missing. Undo kept it."
					: list.contentHash !== item.customList.createdContentHash
						? "This list changed after import. Undo kept it."
						: null
	if (reason) {
		item.customList!.undoReason = reason
		await persist(importId, item)
		return "not_restored" as const
	}
	try {
		await deleteList(userId, id, {
			contentHash: item.customList!.createdContentHash!,
			visibility: "private",
		})
	} catch (error) {
		if (error instanceof ShareListError && error.status === 404)
			return "reverted" as const
		if (
			!(error instanceof ShareListError) ||
			![403, 409].includes(error.status)
		)
			throw error
		item.customList!.undoReason =
			"This list changed after import. Undo kept it."
		await persist(importId, item)
		return "not_restored" as const
	}
	return "reverted" as const
}
