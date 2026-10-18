import { z } from "zod"
import type {
	ImportItem,
	ImportObservation,
	WishlistMatchErrorCode,
	WishlistMatchEvidenceVariant,
	WishlistMatchGroup,
	WishlistOriginalObservation,
} from "../../domain/imports.ts"
import { WISHLIST_MATCH_ERROR_MESSAGES } from "../../domain/wishlist-match-copy.ts"
import { canonicalTitleId } from "../../utils/title-identity.ts"
import { createParsedPreview } from "./preview.server.ts"
import {
	NativeImportError,
	chunks,
	getImportItem,
	getImportRow,
	itemRows,
	listItems,
	marks,
	select,
} from "./store.server.ts"
import {
	isUnknownWishlistSource as eligible,
	wishlistSourceGroup,
} from "./wishlist-evidence.server.ts"

export class WishlistMatchError extends NativeImportError {
	declare code: WishlistMatchErrorCode
	constructor(status: number, code: WishlistMatchErrorCode) {
		super(status, WISHLIST_MATCH_ERROR_MESSAGES[code])
		this.code = code
	}
}
function fail(code: WishlistMatchErrorCode, status = 400): never {
	throw new WishlistMatchError(status, code)
}

const targetSchema = z
	.object({
		mediaType: z.enum(["movie", "show"]),
		tmdbId: z.number().int().safe().positive(),
	})
	.strict()
const schema = z
	.object({
		choices: z
			.array(
				z
					.object({
						index: z.number().int().safe().min(0).max(49_999),
						target: targetSchema.nullable(),
					})
					.strict(),
			)
			.min(1)
			.max(100),
	})
	.strict()
type Target = z.infer<typeof targetSchema>
type Catalog = {
	tmdb_id: number
	imdb_id: string | null
	title: string
	release_year: number | null
}
const ref = (target: Target) =>
	`${target.mediaType}:${canonicalTitleId(target.mediaType, target.tmdbId)}`

async function ownedPreview(userId: string, id: string) {
	const parent = await getImportRow(userId, id)
	if (parent.source !== "wishlist" || parent.status !== "preview")
		fail("wishlist_preview_required", 409)
	return parent
}
function projection(
	original: WishlistOriginalObservation,
	resolution?: ImportObservation["wishlistResolution"],
	catalogImdbId: string | null = null,
): ImportObservation {
	const snapshot = structuredClone(original)
	return {
		...snapshot,
		mediaType:
			resolution?.mediaType ??
			(original.mediaType === "show" ? "show" : "movie"),
		tmdbId: resolution?.tmdbId ?? original.tmdbId,
		imdbId: resolution ? catalogImdbId : original.imdbId,
		wishlistOriginal: snapshot,
		...(resolution
			? { wishlistResolution: structuredClone(resolution), problem: undefined }
			: {}),
	}
}
function preservedIssue(item: ImportItem): ImportObservation {
	if (
		item.kind === "want" &&
		!["invalid", "unsupported"].includes(item.outcome)
	)
		fail("wishlist_snapshot_required", 409)
	return {
		key: item.key,
		kind: item.kind,
		mediaType: item.mediaType,
		title: item.title,
		year: item.year,
		tmdbId: item.tmdbId,
		imdbId: item.imdbId,
		...(item.wishlistEvidence
			? { wishlistEvidence: structuredClone(item.wishlistEvidence) }
			: {}),
		problem: item.problem
			? structuredClone(item.problem)
			: {
					outcome: item.outcome === "invalid" ? "invalid" : "unsupported",
					reason:
						item.reason ??
						WISHLIST_MATCH_ERROR_MESSAGES.wishlist_row_not_resolvable,
				},
	}
}

export async function resolveWishlistImport(
	userId: string,
	id: string,
	input: unknown,
) {
	const request = schema.safeParse(input)
	if (!request.success) fail("wishlist_resolution_invalid")
	const parent = await ownedPreview(userId, id)
	const stored = await itemRows(userId, id)
	const rows = stored.map((item) =>
		item.wishlistOriginal
			? projection(item.wishlistOriginal, item.wishlistResolution)
			: preservedIssue(item),
	)
	const choices = new Map<string, { target: Target | null; index: number }>()
	const requestedIndexes = new Set<number>()
	for (const choice of request.data.choices) {
		if (requestedIndexes.has(choice.index)) fail("wishlist_resolution_invalid")
		requestedIndexes.add(choice.index)
		const row = rows[choice.index]
		if (!row) fail("wishlist_row_not_resolvable")
		if (!row.wishlistOriginal) {
			if (
				row.problem?.outcome === "invalid" ||
				row.problem?.outcome === "unsupported" ||
				row.kind === "unsupported" ||
				row.wishlistEvidence?.mediaType !== "unknown"
			)
				fail("wishlist_row_not_resolvable")
			fail("wishlist_snapshot_required", 409)
		}
		if (!eligible(row.wishlistOriginal)) fail("wishlist_row_not_resolvable")
		const group = wishlistSourceGroup(row.wishlistOriginal, choice.index)
		const previous = choices.get(group)
		if (
			previous &&
			((previous.target === null) !== (choice.target === null) ||
				(previous.target &&
					choice.target &&
					ref(previous.target) !== ref(choice.target)))
		)
			fail("wishlist_source_choice_conflict")
		choices.set(group, { target: choice.target, index: choice.index })
	}
	const effective = new Map<
		number,
		{ target: Target | null; selected: boolean; index: number }
	>()
	for (const [index, row] of rows.entries()) {
		if (!eligible(row.wishlistOriginal)) continue
		const choice = choices.get(wishlistSourceGroup(row.wishlistOriginal, index))
		if (choice)
			effective.set(index, {
				target: choice.target,
				selected: true,
				index: choice.index,
			})
		else if (row.wishlistResolution)
			effective.set(index, {
				target: row.wishlistResolution,
				selected: false,
				index,
			})
	}
	const targets = new Map<string, Catalog>()
	for (const mediaType of ["movie", "show"] as const) {
		const ids = [
			...new Set(
				[...effective.values()].flatMap(({ target }) =>
					target?.mediaType === mediaType
						? [canonicalTitleId(mediaType, target.tmdbId)]
						: [],
				),
			),
		]
		for (const batch of chunks(ids, 800)) {
			const found = await select<Catalog>(
				`SELECT tmdb_id, imdb_id, title, release_year FROM ${mediaType} WHERE tmdb_id IN (${marks(batch.length)})`,
				batch,
			)
			for (const row of found)
				targets.set(`${mediaType}:${Number(row.tmdb_id)}`, row)
		}
	}
	for (const [index, choice] of effective) {
		const row = rows[index]
		const original = row.wishlistOriginal
		if (!original) fail("wishlist_snapshot_required", 409)
		if (!choice.target) {
			rows[index] = projection(original)
			continue
		}
		const catalog = targets.get(ref(choice.target))
		if (!catalog) fail("wishlist_target_missing")
		const provenance = choice.selected
			? {
					selectedAt: new Date().toISOString(),
					parentImportId: id,
					parentRowIndex: choice.index,
				}
			: row.wishlistResolution
		if (!provenance) fail("wishlist_resolution_invalid")
		rows[index] = projection(
			original,
			{
				basis: "member",
				mediaType: choice.target.mediaType,
				tmdbId: Number(catalog.tmdb_id),
				title: catalog.title,
				year: catalog.release_year,
				selectedAt: provenance.selectedAt,
				parentImportId: provenance.parentImportId,
				parentRowIndex: provenance.parentRowIndex,
			},
			catalog.imdb_id,
		)
	}
	for (const [index, row] of rows.entries())
		row.wishlistParent = { importId: id, rowIndex: index }
	const preview = await createParsedPreview(userId, parent.file_name ?? "", {
		source: "wishlist",
		observations: rows,
		warnings: JSON.parse(parent.warnings ?? "[]"),
	})
	return { import: preview, parentImportId: id }
}

async function matchingGroups(
	userId: string,
	id: string,
): Promise<WishlistMatchGroup[]> {
	await ownedPreview(userId, id)
	const { items } = await listItems(userId, id, undefined, 0, 50_000)
	const groups = new Map<string, WishlistMatchGroup>()
	for (const item of items) {
		const original = item.wishlistOriginal
		if (!eligible(original)) continue
		const key = wishlistSourceGroup(original, item.index)
		const evidence: WishlistMatchEvidenceVariant = {
			title: original.title,
			year: original.year,
			...(original.wishlistEvidence.sourceId
				? { sourceId: original.wishlistEvidence.sourceId }
				: {}),
			...(original.wishlistEvidence.sourceUrl
				? { sourceUrl: original.wishlistEvidence.sourceUrl }
				: {}),
		}
		const group = groups.get(key)
		if (!group) {
			groups.set(key, {
				representativeIndex: item.index,
				item,
				entryCount: 1,
				evidenceVariants: [evidence],
				hasMoreEvidence: false,
			})
			continue
		}
		group.entryCount++
		if (
			group.evidenceVariants.some(
				(variant) => JSON.stringify(variant) === JSON.stringify(evidence),
			)
		)
			continue
		if (group.evidenceVariants.length < 3) group.evidenceVariants.push(evidence)
		else group.hasMoreEvidence = true
	}
	return [...groups.values()]
}
export async function getWishlistMatchingGroups(
	userId: string,
	id: string,
	offset = 0,
) {
	if (!Number.isSafeInteger(offset) || offset < 0 || offset > 50_000)
		fail("wishlist_search_invalid")
	const all = await matchingGroups(userId, id)
	return {
		groups: all.slice(offset, offset + 50),
		total: all.length,
		offset,
		hasMore: offset + 50 < all.length,
	}
}
export async function getWishlistMatchGroup(
	userId: string,
	id: string,
	index: number,
) {
	if (!Number.isSafeInteger(index) || index < 0 || index > 49_999)
		fail("wishlist_search_invalid")
	await ownedPreview(userId, id)
	const row = await getImportItem(userId, id, index)
	if (
		!row ||
		row.problem?.outcome === "invalid" ||
		(row.kind === "unsupported" && !row.wishlistOriginal)
	)
		fail("wishlist_row_not_resolvable")
	if (!row.wishlistOriginal) fail("wishlist_snapshot_required", 409)
	if (!eligible(row.wishlistOriginal)) fail("wishlist_row_not_resolvable")
	const key = wishlistSourceGroup(row.wishlistOriginal, index)
	const group = (await matchingGroups(userId, id)).find(
		(group) =>
			group.item.wishlistOriginal &&
			wishlistSourceGroup(
				group.item.wishlistOriginal,
				group.representativeIndex,
			) === key,
	)
	if (!group) fail("wishlist_row_not_resolvable")
	return { group }
}

const searchSchema = z
	.object({
		index: z.number().int().safe().min(0).max(49_999),
		query: z
			.string()
			.trim()
			.min(2)
			.max(100)
			.refine((value) => ![...value].some((c) => c.charCodeAt(0) < 32)),
		mediaType: z.enum(["movie", "show"]).optional(),
	})
	.strict()
export async function searchWishlistMatches(
	userId: string,
	id: string,
	input: unknown,
) {
	const request = searchSchema.safeParse(input)
	if (!request.success) fail("wishlist_search_invalid")
	await ownedPreview(userId, id)
	const row = await getImportItem(userId, id, request.data.index)
	if (!row) fail("wishlist_row_not_resolvable")
	if (!row.wishlistOriginal) {
		if (
			row.problem?.outcome === "invalid" ||
			row.problem?.outcome === "unsupported" ||
			row.kind === "unsupported" ||
			row.wishlistEvidence?.mediaType !== "unknown"
		)
			fail("wishlist_row_not_resolvable")
		fail("wishlist_snapshot_required", 409)
	}
	if (!eligible(row.wishlistOriginal)) fail("wishlist_row_not_resolvable")
	const { withBackendTimeout } = await import("../../utils/backend-timeout.ts")
	const { searchQuery } = await import("../combined-search/catalog.server.ts")
	type Candidate = {
		tmdb_id: number
		title: string
		release_year: number | null
		poster_path: string | null
	}
	try {
		const groups = await withBackendTimeout(
			"Wishlist catalog search",
			1500,
			async (signal) =>
				Promise.all(
					(["movie", "show"] as const)
						.filter(
							(type) =>
								!request.data.mediaType || type === request.data.mediaType,
						)
						.map(async (mediaType) => {
							const rows = await searchQuery<Candidate>(
								`SELECT tmdb_id,title,release_year,poster_path FROM ${mediaType} WHERE MATCH((title,original_title), ?) AND (adult IS NULL OR adult = false) ORDER BY _score DESC, popularity DESC, tmdb_id ASC LIMIT 10`,
								[request.data.query],
								signal,
							)
							return rows.map((candidate) => ({
								mediaType,
								tmdbId: canonicalTitleId(mediaType, Number(candidate.tmdb_id)),
								title: candidate.title,
								year: candidate.release_year,
								posterPath: candidate.poster_path,
							}))
						}),
				),
		)
		const seen = new Set<string>()
		const candidates = groups
			.flat()
			.filter((candidate) => {
				const key = ref(candidate)
				if (seen.has(key)) return false
				seen.add(key)
				return true
			})
			.slice(0, 20)
		return { index: request.data.index, candidates }
	} catch {
		fail("wishlist_search_unavailable", 503)
	}
}

export const WISHLIST_RESOLUTION_MAX_BODY_BYTES = 32 * 1024
export async function readWishlistResolutionBody(
	request: Request,
): Promise<unknown> {
	const length = Number(request.headers.get("Content-Length"))
	if (Number.isFinite(length) && length > WISHLIST_RESOLUTION_MAX_BODY_BYTES)
		fail("wishlist_body_too_large", 413)
	const reader = request.body?.getReader()
	if (!reader) fail("wishlist_resolution_invalid")
	const parts: Uint8Array[] = []
	let size = 0
	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			size += value.byteLength
			if (size > WISHLIST_RESOLUTION_MAX_BODY_BYTES) {
				await reader.cancel()
				fail("wishlist_body_too_large", 413)
			}
			parts.push(value)
		}
		return JSON.parse(
			new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(parts)),
		)
	} catch (error) {
		if (error instanceof WishlistMatchError) throw error
		fail("wishlist_resolution_invalid")
	} finally {
		reader.releaseLock()
	}
}
