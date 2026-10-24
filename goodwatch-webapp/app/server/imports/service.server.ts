import type { ImportResultSectionKey } from "~/domain/import-result"
import type {
	ImportOptions,
	ImportOutcome,
	ImportSource,
	ImportSummary,
	ParsedImport,
} from "~/domain/imports"
import { confirmImport, questionStates, undoImport } from "./apply.server.ts"
import type { ImportTitleRef } from "./result-catalog.server.ts"
import {
	getImportRow,
	listImportRows,
	listItems,
	select,
	skippedCsv,
	summarize,
} from "./store.server.ts"

export const previewImport = async (
	userId: string,
	source: ImportSource,
	fileName: string,
	bytes: Uint8Array,
	wishlist?: Uint8Array,
) =>
	source === "tvtime"
		? (await import("./resolution-runtime.server.ts")).previewTvtime(
				userId,
				fileName,
				bytes,
			)
		: (await import("./preview.server.ts")).createPreview(
				userId,
				source,
				fileName,
				bytes,
				wishlist,
			)
/** Server-only normalized adapter boundary, sharing the upload preview/apply/receipt/undo. */
export const previewParsedImport = async (
	userId: string,
	fileName: string,
	parsed: ParsedImport,
	fileHash?: string,
) =>
	(await import("./preview.server.ts")).createParsedPreview(
		userId,
		fileName,
		structuredClone(parsed),
		fileHash,
	)

export const listImports = async (userId: string): Promise<ImportSummary[]> => {
	const [history, preview] = await Promise.all([
		listImportRows(userId),
		import("./resolution-runtime.server.ts").then((runtime) =>
			runtime.resumableTvtimePreview(userId),
		),
	])
	return [...(preview ? [preview] : []), ...history.map(summarize)]
}
export const getImport = async (userId: string, id: string) => {
	const row = await getImportRow(userId, id)
	const summary = summarize(row)
	const tally =
		row.status !== "preview" && summary.options?.ask
			? await questionStates(id)
			: null
	const watchTally =
		tally && summary.options?.ask?.includes("undated")
			? await questionStates(id, true)
			: null
	return {
		...summary,
		...(tally
			? {
					questions: (summary.options?.ask ?? []).map((kind) => ({
						kind,
						waiting: Number(
							(kind === "undated" ? (watchTally ?? []) : tally).find(
								(state) => state.apply_state === `waiting:${kind}`,
							)?.n ?? 0,
						),
						applying: Number(
							(kind === "undated" ? (watchTally ?? []) : tally).find(
								(state) => state.apply_state === `approved:${kind}`,
							)?.n ?? 0,
						),
						answer: summary.options?.answers?.[kind] ?? null,
					})),
				}
			: {}),
		...(row.source === "tvtime"
			? {
					resolution: await (
						await import("./resolution-runtime.server.ts")
					).resolutionSummary(userId, id),
				}
			: {}),
	}
}
export const getImportItems = (
	userId: string,
	id: string,
	outcome: ImportOutcome | undefined,
	offset: number,
	limit: number,
	followsChoice = false,
	waiting?: "conflict" | "rewatch" | "wholeShow" | "undated",
) => listItems(userId, id, outcome, offset, limit, followsChoice, waiting)
/** The outcomes whose titles the poster rows show, in the order they are filled. */
const POSTER_OUTCOMES: ImportOutcome[] = ["new", "conflict", "unchanged"]
/** Rows read per outcome to find the titles for a poster row; a title can have many rows. */
const POSTER_ROWS = 200
/** Posters of the titles an import brings: new ones first, then those that differ, then those already the same. */
export const getImportPosters = async (
	userId: string,
	id: string,
	outcome: ImportOutcome | undefined,
	limit: number,
) => {
	const { importPosters } = await import("./result-catalog.server.ts")
	const refs: ImportTitleRef[] = []
	for (const each of outcome ? [outcome] : POSTER_OUTCOMES) {
		if (
			new Set(refs.map((ref) => `${ref.mediaType}:${ref.tmdbId}`)).size >=
			limit * 2
		)
			break
		const { items } = await listItems(userId, id, each, 0, POSTER_ROWS)
		for (const item of items)
			if (item.tmdbId !== null)
				refs.push({
					mediaType: item.mediaType,
					tmdbId: item.tmdbId,
					title: item.wishlistResolution?.title ?? item.title,
				})
	}
	return { posters: await importPosters(select, refs, limit) }
}
/** What the import changed, or what its Undo changed back, grouped by title. */
export const getImportResult = async (userId: string, id: string) =>
	(await import("./result.server.ts")).importResult(userId, id)
export const getImportResultPage = async (
	userId: string,
	id: string,
	section: ImportResultSectionKey,
	offset: number,
	limit: number,
) =>
	(await import("./result.server.ts")).importResultPage(
		userId,
		id,
		section,
		offset,
		limit,
	)
export const getSkippedCsv = (userId: string, id: string) =>
	skippedCsv(userId, id)
export { decideImport } from "./apply.server.ts"
export { confirmImport, undoImport }
export type { ImportOptions }

/** Fetch adapters return only observations, never credentials or raw API responses. */
export const previewFetchedImport = (
	userId: string,
	displayName: string,
	observations: ParsedImport,
) => previewParsedImport(userId, displayName, observations)

/** A member's explicit catalog choices produce a new immutable preview. */
export const resolveWishlistImport = async (
	userId: string,
	id: string,
	input: unknown,
) =>
	(await import("./wishlist-resolution.server.ts")).resolveWishlistImport(
		userId,
		id,
		input,
	)

export const getWishlistMatchingGroups = async (
	userId: string,
	id: string,
	offset = 0,
) =>
	(await import("./wishlist-resolution.server.ts")).getWishlistMatchingGroups(
		userId,
		id,
		offset,
	)
export const searchWishlistMatches = async (
	userId: string,
	id: string,
	input: unknown,
) =>
	(await import("./wishlist-resolution.server.ts")).searchWishlistMatches(
		userId,
		id,
		input,
	)

export const getWishlistMatchGroup = async (
	userId: string,
	id: string,
	index: number,
) =>
	(await import("./wishlist-resolution.server.ts")).getWishlistMatchGroup(
		userId,
		id,
		index,
	)

/** Read-only proposals; only explicit member choices change an import preview. */
export const getWishlistSuggestions = async (
	userId: string,
	id: string,
	offset = 0,
	signal?: AbortSignal,
) =>
	(await import("./wishlist-suggestions.server.ts")).getWishlistSuggestions(
		userId,
		id,
		offset,
		signal,
	)

export const acceptSuggestedImport = (
	userId: string,
	id: string,
	input: unknown,
) =>
	import("./resolution-runtime.server.ts").then((runtime) =>
		runtime.acceptResolutionSuggestions(userId, id, input),
	)
export const discardImport = (userId: string, id: string) =>
	import("./resolution-runtime.server.ts").then((runtime) =>
		runtime.discardResolution(userId, id),
	)
