import { createHash } from "node:crypto"
import type {
	ImportItem,
	ImportObservation,
	ImportSummary,
} from "../../domain/imports.ts"
import { connectionCleanup } from "./connect-runtime.server.ts"
import { createTvdbParentLookup } from "./episode-resolver-data.server.ts"
import {
	createParsedPreview,
	createPreview,
	matchCatalog,
} from "./preview.server.ts"
import {
	ResolutionBudget,
	type ResolutionContext,
	type ResolutionJob,
	type ResolutionStep,
	ResolutionStopped,
	createResolutionJobs,
	jobKey,
} from "./resolution-job.server.ts"
import {
	flushResolutionCache,
	refreshResolution,
	resolutionRecordsPage,
	resolutionSourcePage,
	resolutionStore,
} from "./resolution-store.server.ts"
import { resolutionTmdb } from "./resolution-tmdb.server.ts"
import {
	NativeImportError,
	getImportRow,
	run,
	select,
	summarize,
} from "./store.server.ts"
import {
	type TvdbLookup,
	TvdbLookupBudgetExceeded,
} from "./tvdb-lookup.server.ts"
import { createTvtimeCatalogLookup } from "./tvtime-catalog.server.ts"
import {
	type TvtimeMovieEvidence,
	type TvtimeMovieSuggestion,
	normalizeTvtimeTitle,
	suggestTvtimeMovie,
} from "./tvtime-suggestions.server.ts"

type Group = {
	member: string
	root: string
	representativeIndex: number
	entryCount: number
	lastIndex: number
	evidence: TvtimeMovieEvidence
	suggestion?: TvtimeMovieSuggestion
}
type PageCheckpoint = { rows: Record<string, ImportObservation> }
type Link = {
	parentImportId?: string
	root: string
	member: string
	published: boolean
	generation: number
}
let testNetwork:
	| ((
			ctx: ResolutionContext,
			path: string,
			params?: Record<string, string>,
	  ) => Promise<unknown>)
	| undefined
const timers = new Set<ReturnType<typeof setTimeout>>()
export function setResolutionNetworkForTest(value?: typeof testNetwork) {
	testNetwork = value
	for (const timer of timers) clearTimeout(timer)
	timers.clear()
}
const request = (
	ctx: ResolutionContext,
	path: string,
	params?: Record<string, string>,
) =>
	testNetwork
		? testNetwork(ctx, path, params)
		: resolutionTmdb.get(ctx, path, params)
export function resolutionGroupKey(
	root: string,
	row: ImportObservation,
	index: number,
) {
	const source =
		row.wishlistOriginal?.tvtimeMovie?.sourceId ??
		row.tvtimeMovie?.sourceId ??
		`row:${index}`
	return `group/${root}/${createHash("sha256").update(source).digest("hex")}`
}
const restore = (row: ImportItem): ImportObservation => {
	const copy: ImportObservation = row.resolutionOriginal
		? {
				...structuredClone(row.resolutionOriginal),
				resolutionOriginal: structuredClone(row.resolutionOriginal),
			}
		: structuredClone(row)
	if (
		[
			"tvtime_lookup_pending",
			"tvtime_lookup_budget_exhausted",
			"tvtime_lookup_unavailable",
			"tvtime_show_unmatched",
		].includes(copy.problem?.code ?? "")
	)
		copy.problem = undefined
	return copy
}
async function resolve(ctx: ResolutionContext, rows: ImportObservation[]) {
	const pending = new Map<number, ReturnType<TvdbLookup>>()
	const lookup: TvdbLookup = (id) => {
		let value = pending.get(id)
		if (!value) {
			value = request(ctx, `/find/${id}`, { external_source: "tvdb_id" })
				.then((x) => x as Awaited<ReturnType<TvdbLookup>>)
				.catch((e) => {
					pending.delete(id)
					if (e instanceof ResolutionBudget)
						throw new TvdbLookupBudgetExceeded()
					throw e
				})
			pending.set(id, value)
		}
		return value
	}
	await matchCatalog("tvtime", rows, lookup)
}
async function addGroup(ctx: ResolutionContext, row: ImportItem) {
	const key = resolutionGroupKey(ctx.job.root, row, row.index)
	const stored = await resolutionStore.read(key)
	let g = stored?.value as Group | undefined
	if (g && g.lastIndex >= row.index) return
	const source = row.wishlistOriginal ?? row
	const raw = source.tvtimeMovie?.releaseDate ?? ""
	const validDate =
		/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(
			raw,
		) && Number.isFinite(Date.parse(raw))
	const date = validDate ? raw.slice(0, 10) : ""
	const country = source.tvtimeMovie?.country
	g = g ?? {
		member: ctx.job.member,
		root: ctx.job.root,
		representativeIndex: row.index,
		entryCount: 0,
		lastIndex: -1,
		evidence: { titles: [], dates: [], countries: [] },
	}
	g.evidence.titles = [
		...new Set([...g.evidence.titles, normalizeTvtimeTitle(source.title)]),
	].slice(0, 2)
	if (raw)
		g.evidence.dates = [...new Set([...g.evidence.dates, date])].slice(0, 2)
	if (country)
		g.evidence.countries = [
			...new Set([...g.evidence.countries, country]),
		].slice(0, 2)
	g.entryCount++
	g.lastIndex = row.index
	await ctx.commit(key, g)
}
function count(result: ResolutionStep, row: ImportObservation) {
	result.processed++
	if (row.tmdbId && !row.problem) result.matched++
	else {
		result.held++
		const code =
			row.problem?.code ??
			(row.problem?.outcome === "unsupported"
				? "tvtime_unsupported"
				: "tvtime_unmatched")
		result.failed[code] = (result.failed[code] ?? 0) + 1
	}
}
async function step(ctx: ResolutionContext): Promise<ResolutionStep> {
	const result: ResolutionStep = {
		done: false,
		processed: 0,
		matched: 0,
		held: 0,
		failed: {},
	}
	if (ctx.job.phase === "movies") {
		await refreshResolution()
		const groups = await resolutionRecordsPage(
			`group/${ctx.job.root}/`,
			ctx.job.cursor,
			4,
		)
		result.done = groups.length < 4
		result.cursor = groups.at(-1)?.source_key ?? ctx.job.cursor
		for (let i = 0; i < groups.length; i += 4)
			await Promise.all(
				groups.slice(i, i + 4).map(async (row) => {
					const g = JSON.parse(row.payload) as Group
					if (!g.suggestion) {
						g.suggestion = await suggestTvtimeMovie(g.evidence, {
							get: (path, params) => request(ctx, path, params),
							catalog: async (id) => {
								const rows = await select<{
									title: string
									release_year: number | null
									poster_path: string | null
								}>(
									"SELECT tmdb_id, title, release_year, poster_path FROM movie WHERE tmdb_id IN (?)",
									[id],
								)
								if (rows.length !== 1) return null
								return {
									title: rows[0].title,
									year: rows[0].release_year,
									posterPath: rows[0].poster_path,
								}
							},
							now: Date.now,
						})
						await ctx.commit(row.source_key, g)
					}
					result.processed += g.entryCount
					result.held += g.entryCount
					const reason = g.suggestion.reason ?? "tvtime_movie_review_required"
					result.failed[reason] = (result.failed[reason] ?? 0) + g.entryCount
				}),
			)
		return result
	}
	const page = await resolutionSourcePage(
		ctx.job.member,
		ctx.job.root,
		ctx.job.cursor ? Number(ctx.job.cursor) : -1,
	)
	result.done = page.length < 200
	result.cursor = String(page.at(-1)?.index ?? ctx.job.cursor)
	const pageKey = String(page[0]?.index ?? 0)
	const selected = page.filter((row) =>
		ctx.job.phase === "other_parents"
			? !(row.kind === "watch" && row.mediaType === "show")
			: row.kind === "watch" && row.mediaType === "show",
	)
	if (ctx.job.phase === "watched_parents") {
		const parents = selected.map((row) => {
			const copy = restore(row)
			copy.kind = "want"
			copy.episodeTvdbId = undefined
			copy.episodeTmdbId = undefined
			copy.season = undefined
			copy.episode = undefined
			copy.episodeNumbering = undefined
			copy.episodeName = undefined
			return copy
		})
		const episodeOnly = selected
			.map((row, i) => ({ row: restore(row), parent: parents[i] }))
			.filter(
				({ row }) => !row.showTvdbId && !row.tmdbId && !!row.episodeTvdbId,
			)
		if (episodeOnly.length) {
			const cache = await createTvtimeCatalogLookup(
				episodeOnly.map((x) => x.row),
				async (id) =>
					(await request(ctx, `/find/${id}`, {
						external_source: "tvdb_id",
					})) as Awaited<ReturnType<TvdbLookup>>,
			)
			const lookup = createTvdbParentLookup(cache)
			for (const { row, parent } of episodeOnly) {
				const result = await lookup(`episode:${row.episodeTvdbId}`)
				if (result.status === "matched") parent.tmdbId = result.showId
				else if (result.status === "unavailable")
					parent.problem = result.problem
			}
		}
		await resolve(ctx, parents)
		await ctx.commit(`parent/${ctx.job.root}/${pageKey}`, {
			rows: Object.fromEntries(
				selected.map((row, i) => [row.index, parents[i]]),
			),
		} satisfies PageCheckpoint)
		return result
	}
	const parents =
		ctx.job.phase === "episodes"
			? ((await resolutionStore.read(`parent/${ctx.job.root}/${pageKey}`))
					?.value as PageCheckpoint | undefined)
			: undefined
	const rows: ImportObservation[] = []
	const indexes: number[] = []
	for (const row of selected) {
		if (
			ctx.job.phase === "other_parents" &&
			row.wishlistOriginal?.manualMatchScope === "tvtime_movie"
		) {
			await addGroup(ctx, row)
			continue
		}
		const copy = restore(row)
		if (ctx.job.phase === "episodes") {
			const parent = parents?.rows[row.index]
			if (parent) {
				copy.tmdbId = parent.tmdbId
				if (parent.problem) copy.problem = parent.problem
			}
		}
		rows.push(copy)
		indexes.push(row.index)
	}
	await resolve(ctx, rows)
	const previous = (
		await resolutionStore.read(`enrich/${ctx.job.root}/${pageKey}`)
	)?.value as PageCheckpoint | undefined
	await ctx.commit(`enrich/${ctx.job.root}/${pageKey}`, {
		rows: {
			...previous?.rows,
			...Object.fromEntries(rows.map((row, i) => [indexes[i], row])),
		},
	} satisfies PageCheckpoint)
	for (const row of rows) count(result, row)
	return result
}
const childId = (job: ResolutionJob, purpose = "matched") => {
	const h = createHash("sha256")
		.update(`${job.nonce}:${job.generation}:${purpose}`)
		.digest("hex")
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}
async function publish(ctx: ResolutionContext) {
	const j = await ctx.check()
	const id = childId(j)
	await ctx.commit(`family/${j.root}/${id}`, { id })
	await ctx.commit(`link/${id}`, {
		root: j.root,
		member: j.member,
		published: false,
		generation: j.generation,
	} satisfies Link)
	const existing = (
		await select<{ id: string; user_id: string }>(
			"SELECT status, user_id FROM doc.user_import WHERE id = ?",
			[id],
		)
	)[0]
	if (existing) {
		if (existing.user_id !== j.member) throw new ResolutionStopped()
		return id
	}
	await ctx.check()
	await run("DELETE FROM doc.user_import_item WHERE import_id = ?", [id])
	const observations: ImportObservation[] = []
	let after = -1
	for (;;) {
		await ctx.check()
		const page = await resolutionSourcePage(j.member, j.activePreviewId, after)
		if (!page.length) break
		const checkpoint = (
			await resolutionStore.read(`enrich/${j.root}/${page[0].index}`)
		)?.value as PageCheckpoint | undefined
		for (const item of page) {
			const enriched = checkpoint?.rows[item.index]
			observations.push(
				item.wishlistResolution
					? structuredClone(item)
					: !enriched
						? restore(item)
						: {
								...structuredClone(enriched),
								...(item.wishlistOriginal
									? { wishlistOriginal: structuredClone(item.wishlistOriginal) }
									: {}),
							},
			)
		}
		after = page.at(-1)?.index ?? after
		if (observations.length > 50000) throw new ResolutionBudget()
	}
	const root = await getImportRow(j.member, j.activePreviewId)
	await ctx.check()
	await createParsedPreview(
		j.member,
		root.file_name ?? "",
		{
			source: "tvtime",
			observations,
			warnings: JSON.parse(root.warnings ?? "[]"),
		},
		undefined,
		{
			cachedOnly: true,
			id,
			unpublished: true,
			guard: async () => {
				await ctx.check()
			},
		},
	)
	return id
}
export const resolutionJobs = createResolutionJobs({
	store: resolutionStore,
	step,
	publish,
	finished: cleanupResolution,
	flushCache: flushResolutionCache,
})
export function scheduleResolution(root: string) {
	if (testNetwork) return
	const timer = setTimeout(() => {
		timers.delete(timer)
		void resolutionJobs.run(root).catch(() => {})
	}, 0)
	timers.add(timer)
	timer.unref()
}
export async function resolutionRoot(member: string, id: string) {
	const direct = await resolutionJobs.read(id)
	if (direct?.member === member) return id
	const link = (await resolutionStore.read(`link/${id}`))?.value as
		| Link
		| undefined
	return link?.member === member ? link.root : null
}
export async function resolutionVisible(member: string, id: string) {
	const link = (await resolutionStore.read(`link/${id}`))?.value as
		| Link
		| undefined
	if (!link) return true
	if (link.member !== member) return false
	const j = await resolutionJobs.read(link.root)
	const visible =
		!!j &&
		(link.published || j.activePreviewId === id || j.replacementId === id)
	if (visible && !link.published) {
		const stored = await resolutionStore.read(`link/${id}`)
		if (stored)
			await resolutionStore.cas(`link/${id}`, stored.version, {
				...link,
				published: true,
			})
	}
	return visible
}
/** Only roots have a job row. Resume its published active preview, never a staged child. */
export async function resumableTvtimePreview(
	member: string,
): Promise<ImportSummary | null> {
	const roots = await select<{ id: string }>(
		"SELECT i.id FROM doc.user_import i INNER JOIN doc.user_import_item j ON i.id = j.import_id WHERE i.user_id = ? AND i.source = 'tvtime' AND j.kind = 'resolution' AND j.row_index = -1 ORDER BY i.created_at DESC, i.id DESC LIMIT 1",
		[member],
	)
	if (!roots[0]) return null
	const job = await resolutionJobs.read(roots[0].id)
	if (!job || job.member !== member || job.state === "cancelled") return null
	const row = await getImportRow(member, job.activePreviewId)
	if (row.status !== "preview") return null
	return {
		...summarize(row),
		resolution: await resolutionSummary(member, row.id),
	}
}

export async function resolutionSummary(member: string, id: string) {
	const root = await resolutionRoot(member, id)
	if (!root) return undefined
	const j = await resolutionJobs.read(root)
	if (!j) return undefined
	return {
		jobId: j.root,
		state: j.state,
		phase: j.phase,
		total: j.total,
		processed: j.processed,
		matched: j.matched,
		held: j.held,
		pending: Math.max(0, j.total - j.processed),
		heldByCode: j.failed,
		failedByCode: Object.fromEntries(
			Object.entries(j.failed).filter(([code]) =>
				[
					"tvtime_lookup_unavailable",
					"tvtime_suggestion_unavailable",
					"tvtime_resolution_failed",
				].includes(code),
			),
		),
		failed: Object.entries(j.failed)
			.filter(([code]) =>
				[
					"tvtime_lookup_unavailable",
					"tvtime_suggestion_unavailable",
					"tvtime_resolution_failed",
				].includes(code),
			)
			.reduce((sum, [, count]) => sum + count, 0),
		attempts: j.attempts,
		updatedAt: new Date(j.updatedAt).toISOString(),
		deadline: new Date(j.deadline).toISOString(),
		replacementId: j.replacementId,
	}
}
export async function previewTvtime(
	member: string,
	name: string,
	bytes: Uint8Array,
) {
	const initial = await createPreview(
		member,
		"tvtime",
		name,
		bytes,
		undefined,
		{ cachedOnly: true, pending: true },
	)
	try {
		await resolutionJobs.admit(member, initial.id, initial.counts.rows)
	} catch (error) {
		if (
			error instanceof NativeImportError &&
			[
				"tvtime_resolution_member_busy",
				"tvtime_resolution_global_busy",
				"tvtime_resolution_busy",
			].includes(error.code ?? "")
		) {
			await run("DELETE FROM doc.user_import_item WHERE import_id = ?", [
				initial.id,
			])
			await run(
				"DELETE FROM doc.user_import WHERE id = ? AND user_id = ? AND status = 'preview'",
				[initial.id, member],
			)
		}
		throw error
	}
	scheduleResolution(initial.id)
	return {
		...initial,
		resolution: await resolutionSummary(member, initial.id),
	}
}
export async function cancelResolution(member: string, id: string) {
	const row = await getImportRow(member, id)
	if (row.status !== "preview") return resolutionSummary(member, id)
	const root = await resolutionRoot(member, id)
	if (root) {
		await resolutionJobs.cancel(member, root)
		const job = await resolutionJobs.read(root)
		if (job) await cleanupResolution(job)
	}
	return resolutionSummary(member, id)
}
type DiscardCheckpoint = {
	legacyLinks?: boolean
	member: string
	root: string
	id: string
	activePreviewId: string
}
/** Discard unconfirmed projections and their auxiliary evidence; Confirm only cancels work. */
export async function discardResolution(member: string, id: string) {
	const row = await getImportRow(member, id)
	if (row.status !== "preview") return resolutionSummary(member, id)
	const root = await resolutionRoot(member, id)
	if (!root) return undefined
	await cancelResolution(member, id)
	const summary = await resolutionSummary(member, id)
	const j = await resolutionJobs.read(root)
	if (!j || j.state !== "cancelled") return summary
	const checkpoint = {
		member,
		root,
		id,
		activePreviewId: j.activePreviewId,
		legacyLinks: !j.familyIndexed,
	}
	await resolutionStore.cas(`discard/${root}`, null, checkpoint)
	await finishDiscard(checkpoint)
	return summary
}
async function finishDiscard({
	member,
	root,
	id,
	activePreviewId,
	legacyLinks,
}: DiscardCheckpoint) {
	await refreshResolution()
	const ids = new Set([root, id, activePreviewId])
	let after = ""
	for (;;) {
		const page = await resolutionRecordsPage(`family/${root}/`, after)
		if (!page.length) break
		for (const record of page)
			ids.add((JSON.parse(record.payload) as { id: string }).id)
		after = page.at(-1)?.source_key ?? after
	}
	if (legacyLinks) {
		let cursor = ""
		for (;;) {
			const page = await resolutionRecordsPage("link/", cursor)
			if (!page.length) break
			for (const record of page) {
				const link = JSON.parse(record.payload) as Link
				if (link.root === root && link.member === member)
					ids.add(record.source_key.slice("link/".length))
			}
			cursor = page.at(-1)?.source_key ?? cursor
		}
	}

	for (const child of ids) {
		const removed = await run(
			"DELETE FROM doc.user_import WHERE id = ? AND user_id = ? AND status = 'preview'",
			[child, member],
		)
		// A replay may find the import header already deleted; retain any confirmed journal.
		const remaining = (
			await select<{ status: string }>(
				"SELECT status, user_id FROM doc.user_import WHERE id = ?",
				[child],
			)
		)[0]
		if (removed.rowcount || !remaining)
			await run("DELETE FROM doc.user_import_item WHERE import_id = ?", [child])
		await run("DELETE FROM doc.user_import_item WHERE import_id = ?", [
			`resolution:link/${child}`,
		])
	}
	for (const prefix of [
		"cache",
		"parent",
		"enrich",
		"group",
		"decision",
		"accept",
		"family",
	])
		await run("DELETE FROM doc.user_import_item WHERE import_id LIKE ?", [
			`resolution:${prefix}/${root}/%`,
		])
	await resolutionJobs.forget(member, root)
	await run("DELETE FROM doc.user_import_item WHERE import_id = ?", [
		`resolution:discard/${root}`,
	])
	await refreshResolution()
	await run("REFRESH TABLE doc.user_import", [])
}
export async function reconcileImportResolution() {
	await refreshResolution()
	let after = ""
	for (;;) {
		const page = await resolutionRecordsPage("discard/", after)
		if (!page.length) break
		for (const row of page)
			await finishDiscard(JSON.parse(row.payload) as DiscardCheckpoint)
		after = page.at(-1)?.source_key ?? after
	}
	await resolutionJobs.reconcile(false)
}

export async function editResolution(
	member: string,
	id: string,
	build: (
		mode?: Parameters<typeof createParsedPreview>[4],
	) => Promise<{ import: ImportSummary; parentImportId: string }>,
	fixedId?: string,
) {
	const root = await resolutionRoot(member, id)
	if (!root) return build()
	let result: Awaited<ReturnType<typeof build>> | undefined
	await resolutionJobs.edit(
		member,
		root,
		async () => {
			const j = await resolutionJobs.read(root)
			if (!j) throw new ResolutionStopped()
			const generation = j.generation
			const child = fixedId ?? childId(j, "choice")
			const guard = async () => {
				const current = await resolutionJobs.read(root)
				if (current?.generation !== generation || current.state !== "editing")
					throw new ResolutionStopped()
			}
			await guard()
			await resolutionStore.cas(`family/${root}/${child}`, null, { id: child })
			await guard()
			await resolutionStore.cas(`link/${child}`, null, {
				parentImportId: id,
				root,
				member,
				published: false,
				generation,
			} satisfies Link)
			const existing = (
				await select<{ user_id: string }>(
					"SELECT status, user_id FROM doc.user_import WHERE id = ?",
					[child],
				)
			)[0]
			if (existing) {
				if (existing.user_id !== member) throw new ResolutionStopped()
				result = {
					import: summarize(await getImportRow(member, child, true)),
					parentImportId: id,
				}
			} else {
				await guard()
				await run("DELETE FROM doc.user_import_item WHERE import_id = ?", [
					child,
				])
				result = await build({
					cachedOnly: true,
					id: child,
					unpublished: true,
					guard,
				})
			}
			await guard()
			return result.import.id
		},
		id,
	)
	if (!result) throw new ResolutionStopped()
	const link = await resolutionStore.read(`link/${result.import.id}`)
	if (link)
		await resolutionStore.cas(`link/${result.import.id}`, link.version, {
			...(link.value as Link),
			published: true,
		})
	scheduleResolution(root)
	return result
}
export const startImportResolutionReconciler = connectionCleanup(
	"import-resolution",
	reconcileImportResolution,
	() => !!process.env.TMDB_API_KEY,
	"Import matching recovery is unavailable; pending work will be retried.",
)

function matchingError(
	message: string,
	code = "tvtime_suggestion_stale",
	status = 409,
): never {
	const error = new NativeImportError(status, message)
	error.code = code
	throw error
}
export async function choiceProof(
	member: string,
	id: string,
	row: ImportObservation,
	target: { mediaType: string; tmdbId: number },
) {
	const root = await resolutionRoot(member, id)
	if (!root) return undefined
	const group = (await resolutionStore.read(resolutionGroupKey(root, row, 0)))
		?.value as Group | undefined
	const suggestion = group?.suggestion
	return target.mediaType === "movie" &&
		suggestion?.proposal?.tmdbId === target.tmdbId
		? suggestion.proof
		: undefined
}
export async function recordMemberChoices(
	member: string,
	id: string,
	childId: string,
	input: unknown,
) {
	const root = await resolutionRoot(member, childId)
	if (!root) return
	const j = await resolutionJobs.read(root)
	const link = (await resolutionStore.read(`link/${childId}`))?.value as
		| Link
		| undefined
	if (!j || j.generation !== link?.generation || j.activePreviewId !== childId)
		return
	const choices = (input as { choices: { index: number; target: unknown }[] })
		.choices
	const { getImportItem } = await import("./store.server.ts")
	for (const choice of choices) {
		const row = await getImportItem(member, id, choice.index)
		if (!row)
			matchingError("These suggestions have changed. Review them again.")
		const key = resolutionGroupKey(root, row, row.index)
		const decisionKey = `decision/${root}/${key.split("/").at(-1)}`
		const stored = await resolutionStore.read(decisionKey)
		if (
			stored &&
			(stored.value as { generation: number }).generation > j.generation
		)
			continue
		const current = await resolutionJobs.read(root)
		if (current?.generation !== j.generation) return
		await resolutionStore.cas(decisionKey, stored?.version ?? null, {
			generation: j.generation,
			target: choice.target,
		})
	}
	await refreshResolution()
}
async function memberDecisions(root: string) {
	const decisions = new Map<string, { target: unknown }>()
	let after = ""
	for (;;) {
		const page = await resolutionRecordsPage(`decision/${root}/`, after)
		if (!page.length) return decisions
		for (const row of page) {
			decisions.set(
				row.source_key.split("/").at(-1) ?? "",
				JSON.parse(row.payload) as { target: unknown },
			)
			if (decisions.size > 50000)
				matchingError(
					"This import has too many match groups.",
					"tvtime_suggestion_limit",
				)
		}
		after = page.at(-1)?.source_key ?? after
	}
}
export async function resolutionSuggestions(
	member: string,
	id: string,
	offset = 0,
): Promise<import("../../domain/imports.ts").WishlistSuggestions | undefined> {
	const root = await resolutionRoot(member, id)
	if (!root) return undefined
	const j = await resolutionJobs.refreshSnapshot(member, root, id)
	if (!j || j.member !== member) return undefined

	const decisions = await memberDecisions(root)

	const groups: import("../../domain/imports.ts").WishlistSuggestion[] = []
	const indexes: { index: number; key: string }[] = []
	const suggestionFor = async (
		g: Group,
		key: string,
	): Promise<TvtimeMovieSuggestion> => {
		const decision = decisions.get(key.split("/").at(-1) ?? "")
		return decision
			? {
					state: decision.target ? "already_resolved" : "manual",
					reason: decision.target ? undefined : "tvtime_suggestion_rejected",
				}
			: (g.suggestion ?? {
					state: "manual",
					reason:
						j.state === "limited"
							? "tvtime_lookup_budget_exhausted"
							: "tvtime_suggestion_pending",
				})
	}
	let after = ""
	let eligibleCount = 0
	for (;;) {
		const page = await resolutionRecordsPage(`group/${root}/`, after)
		if (!page.length) break
		for (const row of page) {
			const g = JSON.parse(row.payload) as Group
			indexes.push({ index: g.representativeIndex, key: row.source_key })
			if (indexes.length > 50000)
				matchingError(
					"This import has too many match groups.",
					"tvtime_suggestion_limit",
				)
			if ((await suggestionFor(g, row.source_key)).state === "suggested")
				eligibleCount++
		}
		after = page.at(-1)?.source_key ?? after
	}
	indexes.sort((a, b) => a.index - b.index)
	for (const entry of indexes.slice(offset, offset + 10)) {
		const g = (await resolutionStore.read(entry.key))?.value as
			| Group
			| undefined
		if (g)
			groups.push({
				representativeIndex: entry.index,
				...(await suggestionFor(g, entry.key)),
				suggestionId: entry.key.split("/").at(-1),
			})
	}
	const total = indexes.length

	const expires = j.updatedAt + 30 * 60_000
	const ready =
		["completed", "limited"].includes(j.state) &&
		j.activePreviewId === id &&
		expires > Date.now()
	return {
		groups,
		total,
		offset,
		hasMore: offset + groups.length < total,
		nextOffset: offset + groups.length < total ? offset + groups.length : null,
		bulkAccept: {
			token: ready && eligibleCount ? j.snapshot : null,
			eligibleCount,
			previewId: j.activePreviewId,
			generation: j.generation,
			expiresAt: new Date(expires).toISOString(),
		},
	}
}
export async function acceptResolutionSuggestions(
	member: string,
	id: string,
	input: unknown,
) {
	await getImportRow(member, id)
	if (
		!input ||
		typeof input !== "object" ||
		Array.isArray(input) ||
		Object.keys(input).length !== 1 ||
		typeof (input as { token?: unknown }).token !== "string" ||
		(input as { token: string }).token.length > 256
	)
		matchingError(
			"Choose a current set of suggestions to accept.",
			"tvtime_suggestion_request_invalid",
			400,
		)
	const token = (input as { token: string }).token
	const root = await resolutionRoot(member, id)
	if (!root) matchingError("These suggestions have changed. Review them again.")
	const acceptedKey = `accept/${root}/${createHash("sha256").update(token).digest("hex")}`
	const saved = await resolutionStore.read(acceptedKey)
	const record = saved?.value as
		| {
				id: string
				member: string
				parentImportId: string
				acceptedCount: number
		  }
		| undefined
	if (record?.member === member && record.parentImportId !== id)
		matchingError("These suggestions have changed. Review them again.")
	if (record?.member === member)
		return {
			import: summarize(await getImportRow(member, record.id)),
			parentImportId: record.parentImportId,
			acceptedCount: record.acceptedCount,
			skippedCount: 0,
		}
	const j = await resolutionJobs.read(root)
	if (!j || j.member !== member)
		matchingError("These suggestions have changed. Review them again.")
	const h = createHash("sha256")
		.update(`${j.nonce}:accept:${token}`)
		.digest("hex")
	const fixed = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
	const published = (await resolutionStore.read(`link/${fixed}`))?.value as
		| Link
		| undefined
	if (
		published?.member === member &&
		published.parentImportId === id &&
		(published.published || j.activePreviewId === fixed)
	) {
		// Publication may survive a process stop before its acceptance receipt.
		// Recover only this snapshot's choices from the durable child projection.
		const recovered = new Map<
			string,
			{ index: number; target: { mediaType: "movie"; tmdbId: number } }
		>()
		let cursor = -1
		for (;;) {
			const page = await resolutionSourcePage(member, fixed, cursor)
			if (!page.length) break
			for (const row of page) {
				const choice = row.wishlistResolution
				if (
					choice?.parentImportId === id &&
					choice.mediaType === "movie" &&
					choice.suggestionProof
				)
					recovered.set(resolutionGroupKey(root, row, row.index), {
						index: row.index,
						target: { mediaType: "movie", tmdbId: choice.tmdbId },
					})
			}
			cursor = page.at(-1)?.index ?? cursor
		}
		const choices = [...recovered.values()]
		await recordMemberChoices(member, id, fixed, { choices })
		await resolutionStore.cas(acceptedKey, null, {
			id: fixed,
			member,
			parentImportId: id,
			acceptedCount: choices.length,
		})
		return {
			import: summarize(await getImportRow(member, fixed)),
			parentImportId: id,
			acceptedCount: choices.length,
			skippedCount: 0,
		}
	}

	if (
		!j ||
		j.member !== member ||
		j.snapshot !== token ||
		j.activePreviewId !== id ||
		!["completed", "limited"].includes(j.state) ||
		j.updatedAt + 30 * 60_000 <= Date.now()
	)
		matchingError("These suggestions have changed. Review them again.")
	const decisions = await memberDecisions(root)
	const choices: {
		index: number
		target: { mediaType: "movie"; tmdbId: number }
	}[] = []
	let after = ""
	for (;;) {
		const page = await resolutionRecordsPage(`group/${root}/`, after)
		if (!page.length) break
		for (const row of page) {
			const g = JSON.parse(row.payload) as Group
			const decision = decisions.get(row.source_key.split("/").at(-1) ?? "")
			if (
				!decision &&
				g.suggestion?.state === "suggested" &&
				g.suggestion.proposal &&
				g.suggestion.proof
			) {
				if (
					g.suggestion.proof.sourceFingerprint !==
					(
						await import("./tvtime-suggestions.server.ts")
					).tvtimeEvidenceFingerprint(g.evidence)
				)
					matchingError("These suggestions have changed. Review them again.")
				choices.push({
					index: g.representativeIndex,
					target: { mediaType: "movie", tmdbId: g.suggestion.proposal.tmdbId },
				})
			}
		}
		after = page.at(-1)?.source_key ?? after
	}
	if (!choices.length)
		matchingError(
			"There are no suggestions left to accept.",
			"tvtime_suggestion_empty",
		)

	const result = await editResolution(
		member,
		id,
		async (mode) =>
			(await import("./wishlist-resolution.server.ts")).resolveSuggestedChoices(
				member,
				id,
				{ choices },
				mode,
			),
		fixed,
	)
	await resolutionStore.cas(acceptedKey, null, {
		id: result.import.id,
		member,
		parentImportId: id,
		acceptedCount: choices.length,
	})
	await recordMemberChoices(member, id, result.import.id, { choices })
	return { ...result, acceptedCount: choices.length, skippedCount: 0 }
}

async function cleanupResolution(job: ResolutionJob) {
	for (const prefix of ["cache", "parent", "enrich"])
		await run("DELETE FROM doc.user_import_item WHERE import_id LIKE ?", [
			`resolution:${prefix}/${job.root}/%`,
		])
}
