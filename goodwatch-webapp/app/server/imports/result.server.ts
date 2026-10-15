// The result of a native import and of its Undo, per title, from the journal its rows keep in `payload` and the
// watch plan each title keeps in its `state` row.
import {
	type ImportResult,
	type ImportResultEntry,
	type ImportResultKind,
	type ImportResultSectionKey,
	type ImportResultShowState,
	type ImportResultTitle,
	type ImportResultWatches,
	groupImportResult,
} from "~/domain/import-result"
import type {
	ImportItem,
	ImportKind,
	ImportOptions,
	ImportSource,
} from "~/domain/imports"
import { firstRows, sectionPage } from "./result-catalog.server.ts"
import { getImportRow, select, summarize } from "./store.server.ts"
import { type ImportTrackingPlan, importWatchId } from "./tracking.server.ts"

type Snapshot = {
	exists: boolean
	score?: number | null
	review?: string | null
}
type Operation = ImportResult["operation"]
type Journal = {
	before: Snapshot
	after: Snapshot
	cleared?: { table: "user_not_interested" }[]
}

interface ResultRow {
	row_index: number
	kind: ImportItem["kind"] | "state"
	source_key: string | null
	payload: string | null
	outcome: ImportItem["outcome"]
	reason: string | null
	tmdb_id: number | null
	media_type: "movie" | "show" | null
	apply_state: ImportItem["applyState"]
	watch_id: string | null
	undo_outcome: "reverted" | "left" | null
}

const parse = <T>(value: string | null, fallback: T): T => {
	try {
		return value ? (JSON.parse(value) as T) : fallback
	} catch {
		return fallback
	}
}
const written = (state: ImportItem["applyState"]) =>
	state === "added" || state === "updated" || state === "undone"
const KEPT: Record<ImportResultKind, string> = {
	rating: "You changed it in GoodWatch after the preview.",
	review: "You changed it in GoodWatch after the preview.",
	watch: "Already in your watch log.",
	want: "Already on Want to See, or already watched.",
	favorite: "Already a favorite.",
	show_status: "Your show status in GoodWatch stays.",
	unsupported: "GoodWatch can't import this.",
}
const SKIPPED = ["unmatched", "unsupported", "invalid"]
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)

function watchesOf(
	watches: ImportTrackingPlan["watches"],
): ImportResultWatches {
	const days = watches
		.flatMap((watch) =>
			watch.watched_at_precision === "unknown" || watch.watched_at === null
				? []
				: [watch.watched_at],
		)
		.sort((a, b) => a - b)
	const episodes = watches
		.flatMap((watch) =>
			watch.season_number === null || watch.episode_number === null
				? []
				: [{ season: watch.season_number, episode: watch.episode_number }],
		)
		.sort((a, b) => a.season - b.season || a.episode - b.episode)
	return {
		count: watches.length,
		first: episodes[0] ?? null,
		last: episodes.at(-1) ?? null,
		firstDay: days.length ? day(days[0]) : null,
		lastDay: days.length ? day(days[days.length - 1]) : null,
		undated: watches.length - days.length,
	}
}

/**
 * What one title's watch plan did: the watches that landed, the show status and the lists it cleared. After Undo,
 * what Undo did with them, by the outcome it recorded on the plan's row.
 */
function planEntries(
	operation: Operation,
	source: ImportSource,
	plan: ImportTrackingPlan,
	planRow: ResultRow,
	rows: ResultRow[],
	title: ImportResultTitle,
) {
	const key = `${title.mediaType}:${title.tmdbId}`
	const titleRows = rows.filter(
		(row) =>
			row.kind !== "state" &&
			row.media_type === title.mediaType &&
			Number(row.tmdb_id) === title.tmdbId,
	)
	const landed = new Set(
		titleRows.flatMap((row) => (row.watch_id ? [row.watch_id] : [])),
	)
	const statusApplied = titleRows.some(
		(row) => row.kind === "show_status" && written(row.apply_state),
	)
	const fromRows = new Set(
		plan.addedKeys.map((rowKey) => importWatchId(source, rowKey)),
	)
	// A whole-show completion adds watches that no row names; they land with its status.
	const watches = plan.watches.filter((watch) =>
		fromRows.has(watch.watch_id) ? landed.has(watch.watch_id) : statusApplied,
	)
	if (!watches.length && !statusApplied) return []
	const from = (plan.beforeState?.state ?? null) as ImportResultShowState | null
	const to = (plan.afterState?.state ?? null) as ImportResultShowState | null
	const status = title.mediaType === "show" && from !== to ? { from, to } : null
	const entries: ImportResultEntry[] = []
	// Undo puts back what a status without watches cleared (tracking model section 7), and nothing else.
	const undoRestores = !!plan.statusItem && !plan.watches.length
	const list = (table: string) =>
		table === "user_wishlist" ? "Want to See" : "Not interested"
	if (operation === "undo") {
		const left = planRow.undo_outcome === "left"
		const back = status && !left ? { from: status.to, to: status.from } : null
		if (watches.length)
			entries.push({
				key,
				title,
				change: {
					type: "watches-removed",
					watches: watchesOf(watches),
					status: back,
				},
			})
		else if (back)
			entries.push({
				key,
				title,
				change: { type: "status-restored", status: back },
			})
		for (const clear of plan.clear)
			entries.push({
				key,
				title,
				change:
					undoRestores && !left && clear.updatedAt != null
						? { type: "list-restored", list: list(clear.table) }
						: { type: "not-restored", list: list(clear.table) },
			})
		if (left)
			entries.push({
				key,
				title,
				change: { type: "left", kind: "show_status" },
			})
		return entries
	}
	if (watches.length)
		entries.push({
			key,
			title,
			change: { type: "watches-added", watches: watchesOf(watches), status },
		})
	else if (status)
		entries.push({ key, title, change: { type: "status-set", status } })
	for (const clear of plan.clear)
		entries.push({
			key,
			title,
			change: {
				type: "list-cleared",
				list: list(clear.table),
				because: watches.length ? "watched" : "status",
				undoRestores: undoRestores && clear.updatedAt != null,
			},
		})
	return entries
}

/** What stayed as it was, and the rows that weren't imported, for the kinds the member chose. */
function unchangedEntry(
	row: ResultRow,
	options: ImportOptions | null,
	title: () => ImportResultTitle,
): ImportResultEntry | null {
	if (row.kind === "state") return null
	const kind = row.kind as ImportResultKind
	if (SKIPPED.includes(row.outcome)) {
		const payload = parse<Partial<ImportItem>>(row.payload, {})
		const label = payload.year
			? `${payload.title ?? ""} (${payload.year})`
			: (payload.title ?? "")
		return {
			key: `row:${row.row_index}`,
			title: null,
			change: {
				type: "skipped",
				kind,
				label,
				row: Number(row.row_index) + 1,
				reason: row.reason ?? "GoodWatch can't import this row.",
			},
		}
	}
	if (!options?.kinds.includes(kind as ImportKind) || row.tmdb_id === null)
		return null
	const reason =
		row.outcome === "unchanged"
			? "Already the same in GoodWatch."
			: row.outcome === "conflict" && options.conflictChoice === "keep"
				? "You chose to keep what GoodWatch has."
				: row.apply_state === "kept"
					? (row.reason ?? KEPT[kind])
					: null
	if (!reason) return null
	const kept = title()
	return {
		key: `${kept.mediaType}:${kept.tmdbId}`,
		title: kept,
		change: { type: "kept", kind, reason },
	}
}

/** What Undo did with one rating, review, Want to See or favorite row. */
function undoEntries(
	row: ResultRow,
	journal: Journal | undefined,
	key: string,
	title: ImportResultTitle,
) {
	const entries: ImportResultEntry[] = []
	const kind = row.kind as ImportResultKind
	const want = row.kind === "want" || row.kind === "show_status"
	for (const cleared of journal?.cleared ?? [])
		if (cleared.table === "user_not_interested")
			entries.push({
				key,
				title,
				change: { type: "not-restored", list: "Not interested" },
			})
	if (!journal) return entries
	// Imports undone before Undo recorded its outcomes count as taken back.
	if (row.undo_outcome === "left")
		entries.push({ key, title, change: { type: "left", kind } })
	else if (row.kind === "rating" && typeof journal.after.score === "number") {
		const before = journal.before.exists ? journal.before.score : null
		entries.push({
			key,
			title,
			change:
				typeof before === "number"
					? { type: "rating-restored", from: journal.after.score, to: before }
					: { type: "rating-removed", score: journal.after.score },
		})
	} else if (row.kind === "review")
		entries.push({
			key,
			title,
			change: {
				type:
					journal.before.exists && journal.before.review
						? "review-restored"
						: "review-removed",
			},
		})
	else if (want || row.kind === "favorite")
		entries.push({
			key,
			title,
			change: {
				type: "list-removed",
				list: want ? "Want to See" : "Favorites",
			},
		})
	return entries
}

function entriesOf(
	operation: Operation,
	source: ImportSource,
	options: ImportOptions | null,
	rows: ResultRow[],
): ImportResultEntry[] {
	const entries: ImportResultEntry[] = []
	const titles = new Map<string, ImportResultTitle>()
	const order = new Map<string, number>()
	const titleOf = (row: ResultRow): ImportResultTitle => {
		const key = `${row.media_type}:${Number(row.tmdb_id)}`
		const known = titles.get(key)
		if (known) return known
		const payload =
			row.kind === "state" ? {} : parse<Partial<ImportItem>>(row.payload, {})
		const title: ImportResultTitle = {
			tmdbId: Number(row.tmdb_id),
			mediaType: row.media_type ?? "movie",
			title: payload.title ?? "",
			year: payload.year ?? null,
			posterPath: null,
		}
		titles.set(key, title)
		order.set(key, Number(row.row_index))
		return title
	}
	const matched = (row: ResultRow) => row.tmdb_id !== null && !!row.media_type
	// Rows before plans: a title is named by its first row in the export.
	for (const row of rows) if (row.kind !== "state" && matched(row)) titleOf(row)
	for (const row of rows) {
		if (!matched(row)) {
			const skipped = unchangedEntry(row, options, () => titleOf(row))
			if (skipped && operation === "import") {
				order.set(skipped.key, Number(row.row_index))
				entries.push(skipped)
			}
			continue
		}
		if (row.kind === "state") {
			const plan = row.apply_state
				? parse<ImportTrackingPlan | null>(row.payload, null)
				: null
			if (plan)
				entries.push(
					...planEntries(operation, source, plan, row, rows, titleOf(row)),
				)
			continue
		}
		if (!written(row.apply_state)) {
			if (operation === "undo") continue
			const unchanged = unchangedEntry(row, options, () => titleOf(row))
			if (unchanged) entries.push(unchanged)
			continue
		}
		const payload = parse<Partial<ImportItem> & { journal?: Journal }>(
			row.payload,
			{},
		)
		const title = titleOf(row)
		const key = `${title.mediaType}:${title.tmdbId}`
		const journal = payload.journal
		if (operation === "undo") {
			entries.push(...undoEntries(row, journal, key, title))
			continue
		}
		if (
			row.kind === "rating" &&
			journal &&
			typeof journal.after.score === "number"
		) {
			const before = journal.before.exists ? journal.before.score : null
			entries.push({
				key,
				title,
				change:
					typeof before === "number"
						? { type: "rating-replaced", from: before, to: journal.after.score }
						: { type: "rating-added", score: journal.after.score },
			})
		}
		if (row.kind === "review" && journal)
			entries.push({
				key,
				title,
				change: {
					type:
						journal.before.exists && journal.before.review
							? "review-replaced"
							: "review-added",
				},
			})
		const want =
			row.kind === "want" ||
			(row.kind === "show_status" && payload.showStatus === "plan_to_watch")
		if ((want || row.kind === "favorite") && journal)
			entries.push({
				key,
				title,
				change: {
					type: "list-added",
					list: want ? "Want to See" : "Favorites",
				},
			})
		for (const cleared of journal?.cleared ?? [])
			if (cleared.table === "user_not_interested")
				entries.push({
					key,
					title,
					change: {
						type: "list-cleared",
						list: "Not interested",
						because: "want",
						undoRestores: false,
					},
				})
	}
	// Titles in the order the export first names them.
	return entries
		.map((entry, index) => ({ entry, index }))
		.sort(
			(a, b) =>
				(order.get(a.entry.key) ?? 0) - (order.get(b.entry.key) ?? 0) ||
				a.index - b.index,
		)
		.map(({ entry }) => entry)
}

async function groupedResult(
	userId: string,
	id: string,
): Promise<ImportResult> {
	const importRow = await getImportRow(userId, id)
	const rows = await select<ResultRow>(
		"SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, apply_state, watch_id, undo_outcome FROM doc.user_import_item WHERE import_id = ? AND user_id = ? ORDER BY row_index LIMIT 100001",
		[id, userId],
	)
	const summary = summarize(importRow)
	const operation = summary.status === "undone" ? "undo" : "import"
	return groupImportResult(
		operation,
		entriesOf(operation, importRow.source, summary.options, rows),
	)
}

/** The result with the first titles of each section. */
export const importResult = async (userId: string, id: string) =>
	firstRows(select, await groupedResult(userId, id))

/** More titles of one section. */
export const importResultPage = async (
	userId: string,
	id: string,
	section: ImportResultSectionKey,
	offset: number,
	limit: number,
) =>
	sectionPage(select, await groupedResult(userId, id), section, offset, limit)
