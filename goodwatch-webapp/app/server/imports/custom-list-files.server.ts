import type {
	ImportCustomList,
	ImportObservation,
} from "../../domain/imports.ts"
import { parseCsv } from "../imdb-import/file.server.ts"

export function customListObservation(
	list: ImportCustomList,
): ImportObservation {
	return {
		key: `list:${list.sourceId}`,
		kind: "list",
		title: list.name,
		year: null,
		mediaType: "movie",
		tmdbId: null,
		imdbId: null,
		customList: list,
	}
}
const tableRows = (table: string[][], header: number) => {
	const columns = table[header].map((name) => name.trim().toLowerCase())
	return table
		.slice(header + 1)
		.map((row) =>
			Object.fromEntries(columns.map((column, at) => [column, row[at] ?? ""])),
		)
}
export function letterboxdLists(
	entries: { name: string; data: Uint8Array }[],
): ImportObservation[] {
	return entries
		.filter((file) => /^lists\/.+\.csv$/i.test(file.name))
		.map((file) => {
			const table = parseCsv(
				new TextDecoder("utf-8", { fatal: true }).decode(file.data),
			)
			const header = table.findIndex(
				(row) =>
					row.some((cell) => cell.toLowerCase() === "position") &&
					row.some((cell) => cell.toLowerCase() === "name"),
			)
			const metaAt = table.findIndex(
				(row) =>
					row.some((cell) => cell.toLowerCase() === "date") &&
					row.some((cell) => cell.toLowerCase() === "name"),
			)
			const metadata =
				metaAt >= 0
					? tableRows(table.slice(0, metaAt + 2), metaAt)[0]
					: undefined
			const name =
				metadata?.name ||
				file.name
					.split("/")
					.at(-1)!
					.replace(/\.csv$/i, "")
			const list = customListObservation({
				sourceId: file.name,
				name,
				description: metadata?.description ?? "",
				entries:
					header < 0
						? []
						: tableRows(table, header)
								.map((row, index) => ({
									position:
										Number.isSafeInteger(Number(row.position)) &&
										Number(row.position) > 0
											? Number(row.position)
											: index + 1,
									note: row.description ?? "",
									entry: {
										key: `letterboxd:list:${file.name}:${index}`,
										kind: "want" as const,
										mediaType: "movie" as const,
										title: row.name ?? "",
										year: /^\d{4}$/.test(row.year) ? Number(row.year) : null,
										tmdbId: null,
										imdbId: null,
									},
								}))
								.sort((a, b) => a.position - b.position),
			})
			if (header < 0)
				list.problem = {
					outcome: "unsupported",
					reason: "This Letterboxd list has no recognizable entries table.",
				}
			return list
		})
}

const record = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}
export const isTraktCustomListFile = (name: string) =>
	/^lists-(?!watchlist\.json$|favorites\.json$|collaborations\.json$).+\.json$/i.test(
		name,
	)
export function traktLists(
	files: { name: string; values: unknown[] }[],
): ImportObservation[] {
	const result: ImportObservation[] = []
	const consumed = new Set<string>()
	for (const file of files) {
		for (const [index, value] of file.values.entries()) {
			const raw = record(value),
				metadata = raw.list ? record(raw.list) : raw
			if (typeof metadata.name !== "string" || !metadata.name.trim()) continue
			consumed.add(file.name)
			const ids = record(metadata.ids)
			const split = files.find(
				(candidate) =>
					candidate.name !== file.name &&
					[ids.trakt, ids.slug].some(
						(id) =>
							id != null &&
							candidate.name.toLowerCase() === `lists-${id}.json`.toLowerCase(),
					),
			)
			if (split) consumed.add(split.name)
			const items = Array.isArray(raw.items)
				? raw.items
				: Array.isArray(metadata.items)
					? metadata.items
					: split?.values
			const list = customListObservation({
				sourceId: `trakt:${ids.trakt ?? ids.slug ?? `${file.name}:${index}`}`,
				name: metadata.name,
				description:
					typeof metadata.description === "string" ? metadata.description : "",
				entries: (items ?? [])
					.map((value, at) => {
						const item = record(value),
							type = item.type,
							title = record(item[String(type)]),
							titleIds = record(title.ids)
						const entry: ImportObservation = {
							key: `trakt:list:${file.name}:${index}:${at}`,
							kind: "want",
							mediaType: type === "show" ? "show" : "movie",
							title:
								typeof title.title === "string"
									? title.title
									: typeof title.name === "string"
										? title.name
										: "",
							year: typeof title.year === "number" ? title.year : null,
							tmdbId:
								Number.isSafeInteger(titleIds.tmdb) && Number(titleIds.tmdb) > 0
									? Number(titleIds.tmdb)
									: null,
							imdbId:
								typeof titleIds.imdb === "string" &&
								/^tt\d+$/.test(titleIds.imdb)
									? titleIds.imdb
									: null,
						}
						if (type !== "movie" && type !== "show")
							entry.problem = {
								outcome: "unsupported",
								reason: `Trakt ${String(type)} entries cannot be stored as movie/show list items.`,
							}
						return {
							position:
								Number.isSafeInteger(item.rank) && Number(item.rank) > 0
									? Number(item.rank)
									: at + 1,
							note: typeof item.notes === "string" ? item.notes : "",
							entry,
						}
					})
					.sort((a, b) => a.position - b.position),
			})
			if (!items) {
				list.kind = "unsupported"
				list.problem = {
					outcome: "unsupported",
					reason:
						"This archive describes custom Trakt lists but has no items for this list. No list was created.",
				}
			}
			result.push(list)
		}
	}
	for (const file of files)
		if (!consumed.has(file.name) && file.values.length)
			result.push({
				...customListObservation({
					sourceId: file.name,
					name: file.name,
					description: "",
					entries: [],
				}),
				kind: "unsupported",
				problem: {
					outcome: "unsupported",
					reason:
						"This Trakt list items file has no matching named list metadata. No list was created.",
				},
			})
	return result
}
