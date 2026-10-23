import {
	createList,
	deleteList,
	getList,
	newListId,
} from "../share-lists/store.server.ts"
import { run, type itemRows } from "./store.server.ts"
type Item = Awaited<ReturnType<typeof itemRows>>[number]
export async function applyImportedList(
	userId: string,
	importId: string,
	item: Item,
): Promise<"added"> {
	const list = item.customList
	if (!list) throw new Error("The import list has no contents.")
	if (!list.createdId) {
		list.createdId = newListId()
		item.payload = { ...item.payload, customList: list }
		await run(
			"UPDATE doc.user_import_item SET payload = ? WHERE import_id = ? AND row_index = ?",
			[JSON.stringify(item.payload), importId, item.index],
		)
	}
	const entries = list.entries.filter(
		({ entry }) => entry.tmdbId != null && !entry.problem,
	)
	const keys = entries.map(({ entry }) => `${entry.mediaType}:${entry.tmdbId}`)
	await createList(
		userId,
		{
			title: list.name,
			promptId: null,
			design: "podium",
			theme: "ember",
			items: keys,
			visibility: "private",
			collection: {
				importedBy: { importId, item: item.index },
				description: list.description,
				entryNotes: entries.map((item) => item.note),
				notes: Object.fromEntries(
					entries.map((item, at) => [keys[at], item.note]),
				),
			},
		},
		{ id: list.createdId },
	)
	return "added"
}
export async function undoImportedList(userId: string, item: Item) {
	const id = item.customList?.createdId
	if (!id) return "not_restored" as const
	const list = await getList(id)
	if (!list) return "reverted" as const
	if (list.userId !== userId) return "not_restored" as const
	await deleteList(userId, id)
	return "reverted" as const
}
